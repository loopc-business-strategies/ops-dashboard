import { useCallback, useEffect, useRef, useState } from 'react'
import { productionControlApi } from '../../api/productionControl'
import hrAPI from '../../api/hr'
import { useAuth } from '../../context/AuthContext'
import { buildDashboardModel, dayKey, addDays } from './buildDashboardModel'

async function fetchDailyRange(fromOffset, count, signal) {
  const n = Math.max(0, Math.min(Number(count) || 0, 31))
  if (!n) return []
  const rows = await Promise.all(
    Array.from({ length: n }, (_, i) => {
      const d = dayKey(addDays(new Date(), -(fromOffset + i)))
      return productionControlApi.reportDaily({ date: d }, { signal })
        .then((r) => r)
        .catch(() => null)
    }),
  )
  return rows.filter(Boolean)
}

function monthWindow() {
  const now = new Date()
  const thisMonthDays = now.getDate()
  const lastMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate()
  return { thisMonthDays, lastMonthDays }
}

/**
 * Aggregates existing PCC + HR read APIs into the Production Dashboard model.
 * Soft-refreshes on Socket.IO /production and polling fallback.
 */
export function useProductionDashboard({ refreshMs = 45000 } = {}) {
  const { company, user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [model, setModel] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [connection, setConnection] = useState('OFFLINE')
  const abortRef = useRef(null)
  const softTimerRef = useRef(null)
  const corePayloadRef = useRef(null)

  const assemble = useCallback((payload) => {
    const me = payload.meRes
      ? { ...(payload.meRes.user || {}), productionRole: payload.meRes.productionRole || payload.meRes.user?.productionRole }
      : user
    const passes = payload.passesRes?.passes || payload.passesRes?.data || (Array.isArray(payload.passesRes) ? payload.passesRes : [])
    const processes = payload.processesRes?.processes || payload.processesRes?.data || (Array.isArray(payload.processesRes) ? payload.processesRes : [])
    return buildDashboardModel({
      summaryRes: payload.summaryRes,
      boardRes: payload.boardRes,
      widgetsRes: payload.widgetsRes,
      flowRes: payload.flowRes,
      deptsRes: payload.deptsRes,
      shiftRes: payload.shiftRes,
      floorSessions: payload.floorSessions,
      todayReport: payload.todayReport,
      yesterdayReport: payload.yesterdayReport,
      weekReports: payload.weekReports || [],
      lastWeekReports: payload.lastWeekReports || [],
      monthReports: payload.monthReports || [],
      lastMonthReports: payload.lastMonthReports || [],
      employees: payload.employeesRes,
      passes,
      processes,
      me,
    })
  }, [user])

  const load = useCallback(async ({ soft = false } = {}) => {
    if (abortRef.current) abortRef.current.abort()
    const ac = new AbortController()
    abortRef.current = ac
    if (!soft) {
      setLoading(true)
      setError(null)
    }
    try {
      const today = dayKey()
      const yesterday = dayKey(addDays(new Date(), -1))

      const [
        summaryRes,
        boardRes,
        widgetsRes,
        flowRes,
        deptsRes,
        shiftRes,
        floorSessions,
        todayReport,
        yesterdayReport,
        weekReports,
        lastWeekReports,
        employeesRes,
        passesRes,
        processesRes,
        meRes,
      ] = await Promise.all([
        productionControlApi.getLiveFloorSummary({ signal: ac.signal }).catch(() => null),
        productionControlApi.getLiveFloorBoard({ signal: ac.signal }).catch(() => null),
        productionControlApi.getLiveFloorWidgets({ signal: ac.signal }).catch(() => null),
        productionControlApi.getFlow({ signal: ac.signal }).catch(() => null),
        productionControlApi.listDepartments({ signal: ac.signal }).catch(() => null),
        productionControlApi.getCurrentShift({ signal: ac.signal }).catch(() => null),
        productionControlApi.listFloorSessions({ status: 'OPEN' }, { signal: ac.signal }).catch(() => null),
        productionControlApi.reportDaily({ date: today }, { signal: ac.signal }).catch(() => null),
        productionControlApi.reportDaily({ date: yesterday }, { signal: ac.signal }).catch(() => null),
        fetchDailyRange(0, 7, ac.signal),
        fetchDailyRange(7, 7, ac.signal),
        hrAPI.getEmployees().catch(() => null),
        productionControlApi.listPasses({ limit: 50 }, { signal: ac.signal }).catch(() => null),
        productionControlApi.listProcesses({ limit: 50 }, { signal: ac.signal }).catch(() => null),
        productionControlApi.me({ signal: ac.signal }).catch(() => null),
      ])

      if (ac.signal.aborted) return

      if (!summaryRes && !boardRes && !widgetsRes) {
        setError('Unable to load production floor data')
      }

      const core = {
        summaryRes,
        boardRes,
        widgetsRes,
        flowRes,
        deptsRes,
        shiftRes,
        floorSessions,
        todayReport,
        yesterdayReport,
        weekReports,
        lastWeekReports,
        monthReports: [],
        lastMonthReports: [],
        employeesRes,
        passesRes,
        processesRes,
        meRes,
      }
      corePayloadRef.current = core
      setModel(assemble(core))
      setLastUpdated(new Date())
      if (summaryRes || boardRes || widgetsRes) setError(null)
      if (!soft) setLoading(false)

      // Month comparisons load in a second wave to keep first paint fast
      const { thisMonthDays, lastMonthDays } = monthWindow()
      const [monthReports, lastMonthReports] = await Promise.all([
        fetchDailyRange(0, thisMonthDays, ac.signal),
        fetchDailyRange(thisMonthDays, lastMonthDays, ac.signal),
      ])
      if (ac.signal.aborted) return
      const withMonth = { ...core, monthReports, lastMonthReports }
      corePayloadRef.current = withMonth
      setModel(assemble(withMonth))
      setLastUpdated(new Date())
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || ac.signal.aborted) return
      setError(err?.response?.data?.message || err?.message || 'Failed to load Production Dashboard')
      if (!soft) setLoading(false)
    }
  }, [assemble])

  useEffect(() => {
    load({ soft: false })
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [load])

  useEffect(() => {
    if (!refreshMs || refreshMs < 5000) return undefined
    const id = setInterval(() => load({ soft: true }), refreshMs)
    return () => clearInterval(id)
  }, [load, refreshMs])

  useEffect(() => {
    let socket
    let cancelled = false
    ;(async () => {
      try {
        const { io } = await import('socket.io-client')
        const { API_ORIGIN } = await import('../../api/client')
        if (cancelled) return
        socket = io(`${API_ORIGIN}/production`, {
          withCredentials: true,
          transports: ['websocket', 'polling'],
          auth: { token: 'browser-session' },
          reconnection: true,
          reconnectionAttempts: Infinity,
        })
        socket.on('connect', () => {
          setConnection('LIVE')
          socket.emit('subscribe:tenant', company || user?.company || undefined)
        })
        socket.on('disconnect', () => setConnection('OFFLINE'))
        socket.io.on('reconnect_attempt', () => setConnection('RECONNECTING'))
        socket.io.on('reconnect', () => setConnection('LIVE'))
        socket.on('production:update', () => {
          if (softTimerRef.current) clearTimeout(softTimerRef.current)
          softTimerRef.current = setTimeout(() => load({ soft: true }), 300)
        })
      } catch {
        setConnection('OFFLINE')
      }
    })()
    return () => {
      cancelled = true
      if (softTimerRef.current) clearTimeout(softTimerRef.current)
      try { socket?.disconnect() } catch { /* ignore */ }
    }
  }, [company, user?.company, load])

  return {
    loading,
    error,
    model,
    lastUpdated,
    connection,
    refresh: () => load({ soft: false }),
    softRefresh: () => load({ soft: true }),
  }
}
