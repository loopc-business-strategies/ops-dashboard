import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  departmentLogin as apiDepartmentLogin,
  employeeLogin as apiEmployeeLogin,
  fetchMe,
  refreshBiometricToken,
} from '@/src/api/factory'
import { setAuthToken, setUnauthorizedHandler } from '@/src/api/client'
import { userFacingMessage } from '@/src/api/errors'

const DEPT_TOKEN_KEY = 'mg_factory_department_token'
const EMP_TOKEN_KEY = 'mg_factory_employee_token'
const BIOMETRIC_TOKEN_KEY = 'mg_factory_biometric_token'
const DEPT_META_KEY = 'mg_factory_department_meta'

type DepartmentInfo = { key: string; label: string }

type FactoryUser = {
  id: string
  name: string
  role: string
  department?: string
  productionRole?: string | null
}

type AuthState = {
  loading: boolean
  departmentToken: string | null
  employeeToken: string | null
  department: DepartmentInfo | null
  user: FactoryUser | null
  permissions: Record<string, boolean>
  biometricAvailable: boolean
  biometricEnrolled: boolean
  hydrateError: string | null
  unlockDepartment: (key: string, password: string) => Promise<void>
  loginEmployee: (name: string, password: string) => Promise<void>
  loginWithBiometric: () => Promise<void>
  enrollBiometric: () => Promise<void>
  logoutEmployee: () => Promise<void>
  logoutDepartment: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

async function safeGet(key: string) {
  try {
    return await SecureStore.getItemAsync(key)
  } catch {
    return null
  }
}

async function safeSet(key: string, value: string) {
  try {
    await SecureStore.setItemAsync(key, value)
  } catch {
    // memory-only session
  }
}

async function safeDel(key: string) {
  try {
    await SecureStore.deleteItemAsync(key)
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [departmentToken, setDepartmentToken] = useState<string | null>(null)
  const [employeeToken, setEmployeeToken] = useState<string | null>(null)
  const [department, setDepartment] = useState<DepartmentInfo | null>(null)
  const [user, setUser] = useState<FactoryUser | null>(null)
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricEnrolled, setBiometricEnrolled] = useState(false)
  const [hydrateError, setHydrateError] = useState<string | null>(null)

  const clearEmployeeState = useCallback(async () => {
    setAuthToken(null)
    setEmployeeToken(null)
    setUser(null)
    setPermissions({})
    await safeDel(EMP_TOKEN_KEY)
  }, [])

  const logoutEmployee = useCallback(async () => {
    await clearEmployeeState()
  }, [clearEmployeeState])

  const logoutDepartment = useCallback(async () => {
    await clearEmployeeState()
    setDepartmentToken(null)
    setDepartment(null)
    setBiometricEnrolled(false)
    setHydrateError(null)
    await safeDel(DEPT_TOKEN_KEY)
    await safeDel(DEPT_META_KEY)
    await safeDel(BIOMETRIC_TOKEN_KEY)
  }, [clearEmployeeState])

  const hydrateEmployee = useCallback(async (tok: string, dept?: DepartmentInfo | null) => {
    setAuthToken(tok)
    const me = await fetchMe(tok)
    setEmployeeToken(tok)
    setHydrateError(null)
    setDepartment(dept || me.department)
    setUser({
      id: String(me.user.id),
      name: me.user.name,
      role: me.user.role,
      department: me.user.department,
      productionRole: me.user.productionRole,
    })
    setPermissions(me.permissions || {})
  }, [])

  const unlockDepartment = useCallback(async (key: string, password: string) => {
    const data = await apiDepartmentLogin(key.trim().toLowerCase(), password)
    if (!data.departmentToken) throw new Error(data.message || 'Department login failed')
    await safeSet(DEPT_TOKEN_KEY, data.departmentToken)
    await safeSet(DEPT_META_KEY, JSON.stringify(data.department))
    setDepartmentToken(data.departmentToken)
    setDepartment(data.department)
    await clearEmployeeState()
  }, [clearEmployeeState])

  const loginEmployee = useCallback(
    async (name: string, password: string) => {
      if (!departmentToken) throw new Error('Unlock department first')
      const data = await apiEmployeeLogin(departmentToken, name.trim(), password)
      if (!data.token) throw new Error(data.message || 'Employee login failed')
      await safeSet(EMP_TOKEN_KEY, data.token)
      await hydrateEmployee(data.token, data.department)
      try {
        const bio = await refreshBiometricToken(data.token)
        if (bio.token) {
          await safeSet(BIOMETRIC_TOKEN_KEY, bio.token)
          setBiometricEnrolled(true)
        }
      } catch {
        // biometric enroll optional
      }
    },
    [departmentToken, hydrateEmployee],
  )

  const enrollBiometric = useCallback(async () => {
    if (!employeeToken) throw new Error('Sign in with password first')
    const compatible = await LocalAuthentication.hasHardwareAsync()
    const enrolled = await LocalAuthentication.isEnrolledAsync()
    if (!compatible || !enrolled) throw new Error('Biometrics not available on this device')
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Enable Face ID for MG Factory',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    })
    if (!result.success) throw new Error('Biometric enrollment cancelled')
    const bio = await refreshBiometricToken(employeeToken)
    if (!bio.token) throw new Error('Could not create biometric token')
    await safeSet(BIOMETRIC_TOKEN_KEY, bio.token)
    setBiometricEnrolled(true)
  }, [employeeToken])

  const loginWithBiometric = useCallback(async () => {
    if (!departmentToken) throw new Error('Unlock department first')
    const stored = await safeGet(BIOMETRIC_TOKEN_KEY)
    if (!stored) throw new Error('No Face ID credentials — sign in with password once')
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Employee Face ID',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    })
    if (!result.success) throw new Error('Face ID cancelled')
    await safeSet(EMP_TOKEN_KEY, stored)
    await hydrateEmployee(stored, department)
  }, [departmentToken, department, hydrateEmployee])

  const refresh = useCallback(async () => {
    if (!employeeToken) return
    await hydrateEmployee(employeeToken, department)
  }, [employeeToken, department, hydrateEmployee])

  useEffect(() => {
    let cancelled = false
    setUnauthorizedHandler(() => {
      clearEmployeeState()
    })
    ;(async () => {
      try {
        const [hasHw, enrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ])
        if (!cancelled) setBiometricAvailable(Boolean(hasHw && enrolled))

        const storedDept = await safeGet(DEPT_TOKEN_KEY)
        const storedMeta = await safeGet(DEPT_META_KEY)
        const storedEmp = await safeGet(EMP_TOKEN_KEY)
        const storedBio = await safeGet(BIOMETRIC_TOKEN_KEY)
        if (cancelled) return

        if (storedDept) {
          setDepartmentToken(storedDept)
          if (storedMeta) {
            try {
              setDepartment(JSON.parse(storedMeta) as DepartmentInfo)
            } catch {
              // ignore
            }
          }
        }
        if (storedBio) setBiometricEnrolled(true)

        if (storedEmp) {
          try {
            let meta: DepartmentInfo | null = null
            if (storedMeta) meta = JSON.parse(storedMeta) as DepartmentInfo
            await hydrateEmployee(storedEmp, meta)
          } catch (err) {
            if (!cancelled) {
              setHydrateError(userFacingMessage(err) || 'Unable to restore employee session')
            }
          }
        }
      } catch {
        if (!cancelled) setHydrateError('Unable to restore session')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      setUnauthorizedHandler(null)
    }
  }, [clearEmployeeState, hydrateEmployee])

  const value = useMemo(
    () => ({
      loading,
      departmentToken,
      employeeToken,
      department,
      user,
      permissions,
      biometricAvailable,
      biometricEnrolled,
      hydrateError,
      unlockDepartment,
      loginEmployee,
      loginWithBiometric,
      enrollBiometric,
      logoutEmployee,
      logoutDepartment,
      refresh,
    }),
    [
      loading,
      departmentToken,
      employeeToken,
      department,
      user,
      permissions,
      biometricAvailable,
      biometricEnrolled,
      hydrateError,
      unlockDepartment,
      loginEmployee,
      loginWithBiometric,
      enrollBiometric,
      logoutEmployee,
      logoutDepartment,
      refresh,
    ],
  )

  return React.createElement(AuthContext.Provider, { value }, children)
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth requires AuthProvider')
  return ctx
}
