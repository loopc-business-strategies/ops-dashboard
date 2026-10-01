import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchMe,
  login as apiLogin,
  recordAttendanceLogin,
  recordAttendanceLogout,
  type LoginMethod,
  type LoginResponse,
  type MeResponse,
} from '@/src/api/auth'
import { setAuthToken, setUnauthorizedHandler } from '@/src/api/client'
import { toApiError, userFacingMessage } from '@/src/api/errors'
import { registerDevice } from '@/src/api/floor'
import { getSelectedDepartment, getSessionLoginAt, markSessionExpiredNotice } from '@/src/auth/sessionPrefs'
import {
  primarySession,
  recordLogout,
  removeSession,
  upsertSession,
  type FloorSession,
  type FloorUser,
  type LoggedOutEntry,
} from '@/src/auth/sessionList'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { getDeviceId } from '@/src/device/deviceIdentity'
import { setSenderTokenResolver } from '@/src/offline/sync'

export type { FloorSession, FloorUser } from '@/src/auth/sessionList'

/** Single-session token saved by builds before multi-employee login (migrated on start). */
const LEGACY_TOKEN_KEY = 'mg_floor_session_token'
/** Non-secret list of logged-in employees (tokens live in SecureStore per employee). */
const SESSIONS_KEY = 'mg_floor_sessions_v1'
const LOGGED_OUT_KEY = 'mg_floor_logged_out_v1'
const tokenKey = (userId: string) => `mg_floor_session_tok_${userId}`

type StoredSession = Omit<FloorSession, 'token'>

type LoginOptions = {
  /** Return an error message to refuse this employee (e.g. wrong department) before they are added. */
  validate?: (session: FloorSession) => string | null
  method?: LoginMethod
}

type AuthState = {
  loading: boolean
  /** Primary session (manager if one is logged in, otherwise the first employee). */
  token: string | null
  user: FloorUser | null
  shift: unknown
  permissions: Record<string, boolean>
  hydrateError: string | null
  /** Everyone logged in on this tablet. */
  sessions: FloorSession[]
  /** Employees who logged out of this tablet today. */
  loggedOut: LoggedOutEntry[]
  login: (name: string, password: string, opts?: LoginOptions) => Promise<FloorSession>
  logoutUser: (userId: string) => Promise<void>
  /** Logs out every employee on this tablet. */
  logout: () => Promise<void>
  refresh: () => Promise<void>
  retryHydrate: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

async function secureGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key)
  } catch {
    return null
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value)
  } catch {
    // Device storage unavailable — keep the session in memory only for this process.
  }
}

async function secureDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key)
  } catch {
    // ignore
  }
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

function sessionFromMe(token: string, me: MeResponse, loginAt: string, loginMethod: LoginMethod): FloorSession {
  if (String(me.tenant || '').toLowerCase() !== 'mg') throw new Error('Session is not MG')
  return {
    token,
    loginAt,
    loginMethod,
    shift: me.shift,
    permissions: me.permissions || {},
    user: {
      id: String(me.user.id),
      name: me.user.name,
      role: me.user.role,
      department: me.user.department,
      floorDepartment: me.user.floorDepartment || '',
      productionRole: me.productionRole,
      employeeCode: me.user.employeeCode || '',
    },
  }
}

const toStored = ({ token: _token, ...rest }: FloorSession): StoredSession => rest

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<FloorSession[]>([])
  const sessionsRef = useRef<FloorSession[]>([])
  const [loggedOut, setLoggedOut] = useState<LoggedOutEntry[]>([])
  const loggedOutRef = useRef<LoggedOutEntry[]>([])
  const [hydrateError, setHydrateError] = useState<string | null>(null)

  /** Updates the list, the API client's default token and storage together so no request uses a stale token. */
  const commit = useCallback((next: FloorSession[]) => {
    sessionsRef.current = next
    setSessions(next)
    setAuthToken(primarySession(next)?.token ?? null)
    writeJson(SESSIONS_KEY, next.map(toStored)).catch(() => {})
  }, [])

  const noteLogout = useCallback((session: FloorSession) => {
    const next = recordLogout(loggedOutRef.current, session)
    loggedOutRef.current = next
    setLoggedOut(next)
    writeJson(LOGGED_OUT_KEY, next).catch(() => {})
  }, [])

  const dropSession = useCallback(
    async (session: FloorSession, { tellServer }: { tellServer: boolean }) => {
      commit(removeSession(sessionsRef.current, session.user.id))
      noteLogout(session)
      await secureDelete(tokenKey(session.user.id))
      if (tellServer) await recordAttendanceLogout(session.token).catch(() => {})
    },
    [commit, noteLogout],
  )

  const addSession = useCallback(
    async (data: LoginResponse, method: LoginMethod, opts?: LoginOptions) => {
      if (!data.token) throw new Error('Login failed — no token')
      const me = await fetchMe(data.token)
      const session = sessionFromMe(data.token, me, new Date().toISOString(), opts?.method || method)
      const refused = opts?.validate?.(session)
      if (refused) throw new Error(refused)

      const wasEmpty = sessionsRef.current.length === 0
      await secureSet(tokenKey(session.user.id), session.token)
      commit(upsertSession(sessionsRef.current, session))
      setHydrateError(null)

      recordAttendanceLogin(session.token, { loginMethod: session.loginMethod }).catch(() => {})
      if (wasEmpty) {
        ;(async () => {
          await registerDevice({
            deviceId: await getDeviceId(),
            appVersion: Constants.expoConfig?.version || '1.0.0',
            os: Platform.OS,
            model: Platform.OS,
            department:
              (await getSelectedDepartment()) || session.user.floorDepartment || session.user.department || '',
          })
        })().catch(() => {})
      }
      return sessionsRef.current.find((s) => s.user.id === session.user.id) || session
    },
    [commit],
  )

  const login = useCallback(
    async (name: string, password: string, opts?: LoginOptions) => addSession(await apiLogin(name, password), 'password', opts),
    [addSession],
  )

  const logoutUser = useCallback(
    async (userId: string) => {
      const session = sessionsRef.current.find((s) => s.user.id === userId)
      if (session) await dropSession(session, { tellServer: true })
    },
    [dropSession],
  )

  const logout = useCallback(async () => {
    const all = [...sessionsRef.current]
    for (const s of all) await dropSession(s, { tellServer: true })
    setHydrateError(null)
    await secureDelete(LEGACY_TOKEN_KEY)
  }, [dropSession])

  const refresh = useCallback(async () => {
    const current = sessionsRef.current
    if (!current.length) return
    const next: FloorSession[] = []
    for (const s of current) {
      try {
        next.push(sessionFromMe(s.token, await fetchMe(s.token), s.loginAt, s.loginMethod))
      } catch {
        next.push(s)
      }
    }
    commit(next.filter((s) => sessionsRef.current.some((c) => c.user.id === s.user.id)))
  }, [commit])

  const hydrate = useCallback(async () => {
    const log = (await readJson<LoggedOutEntry[]>(LOGGED_OUT_KEY, [])).filter(Boolean)
    loggedOutRef.current = log
    setLoggedOut(log)

    const stored = (await readJson<StoredSession[]>(SESSIONS_KEY, [])).filter((s) => s?.user?.id)
    const restored: FloorSession[] = []
    for (const entry of stored) {
      const token = await secureGet(tokenKey(entry.user.id))
      if (!token) continue
      try {
        restored.push(sessionFromMe(token, await fetchMe(token), entry.loginAt, entry.loginMethod))
      } catch (err) {
        if (toApiError(err).kind === 'AUTH_ERROR') {
          await secureDelete(tokenKey(entry.user.id))
          continue
        }
        // Offline start: keep working with the saved details; requests retry when the network is back.
        restored.push({ ...entry, token })
      }
    }

    if (!stored.length) {
      const legacy = await secureGet(LEGACY_TOKEN_KEY)
      if (legacy) {
        try {
          const loginAt = (await getSessionLoginAt()) || new Date().toISOString()
          const session = sessionFromMe(legacy, await fetchMe(legacy), loginAt, 'password')
          await secureSet(tokenKey(session.user.id), legacy)
          await secureDelete(LEGACY_TOKEN_KEY)
          restored.push(session)
        } catch (err) {
          if (toApiError(err).kind === 'AUTH_ERROR') await secureDelete(LEGACY_TOKEN_KEY)
          else setHydrateError(userFacingMessage(err) || 'Unable to restore session')
        }
      }
    }
    commit(restored)
  }, [commit])

  const retryHydrate = useCallback(async () => {
    setLoading(true)
    setHydrateError(null)
    try {
      await hydrate()
    } finally {
      setLoading(false)
    }
  }, [hydrate])

  useEffect(() => {
    let cancelled = false
    setUnauthorizedHandler((badToken) => {
      const session = sessionsRef.current.find((s) => s.token === badToken)
      if (!session) return
      markSessionExpiredNotice().catch(() => {})
      dropSession(session, { tellServer: false }).catch(() => {})
    })
    setSenderTokenResolver((userId) => sessionsRef.current.find((s) => s.user.id === userId)?.token ?? null)
    getDeviceId().catch(() => {})
    ;(async () => {
      try {
        await hydrate()
      } catch {
        if (!cancelled) setHydrateError('Unable to read stored session')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      setUnauthorizedHandler(null)
      setSenderTokenResolver(null)
    }
  }, [hydrate, dropSession])

  const primary = primarySession(sessions)

  const value = useMemo<AuthState>(
    () => ({
      loading,
      token: primary?.token ?? null,
      user: primary?.user ?? null,
      shift: primary?.shift ?? null,
      permissions: primary?.permissions ?? {},
      hydrateError,
      sessions,
      loggedOut,
      login,
      logoutUser,
      logout,
      refresh,
      retryHydrate,
    }),
    [loading, primary, hydrateError, sessions, loggedOut, login, logoutUser, logout, refresh, retryHydrate],
  )

  return React.createElement(AuthContext.Provider, { value }, children)
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth requires AuthProvider')
  return ctx
}
