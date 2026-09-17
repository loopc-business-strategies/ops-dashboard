import { useCallback, useEffect, useRef, useState } from 'react'
import { productionControlApi } from '../../api/productionControl'
import hrAPI from '../../api/hr'
import { useAuth } from '../../context/AuthContext'
import { buildDashboardModel, dayKey, addDays } from './buildDashboardModel'

/** Sum department-performance rows into a period totals object. */
export function summarizeDeptPerf(res) {
  const rows = res?.rows || res?.report?.rows || []
  if (!Array.isArray(rows) || !rows.length) return null
  const totals = rows.reduce(
    (acc, r) => {
      const weightOut = Number(r.weight) || 0
      const loss = Number(r.loss) || 0
      const scrap = Number(r.scrap) || 0
      acc.jobs += Number(r.jobs) || 0
      acc.completed += Number(r.completed) || 0
      acc.pending += Number(r.pending) || 0
      acc.weightOut += weightOut
      acc.scrap += scrap
      acc.loss += loss
      // Approx input when only output weights exist on dept rows
      acc.weightIn += weightOut + loss + scrap
      return acc
    },
    { jobs: 0, completed: 0, pending: 0, weightIn: 0, weightOut: 0, scrap: 0, loss: 0 },
  )
  return totals
}

function rangeDates(fromOffsetDays, lengthDays) {
  const end = addDays(new Date(), -fromOffsetDays)
  const start = addDays(end, -(lengthDays - 1))
  return {
    fromDate: dayKey(start),
    toDate: dayKey(end),
  }
}

function monthRanges() {
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
  const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1)
  return {
    thisMonth: { fromDate: dayKey(thisMonthStart), toDate: dayKey(now) },
    lastMonth: { fromDate: dayKey(lastMonthStart), toDate: dayKey(lastMonthEnd) },
  }
}

/**
 * Progressive Production Dashboard loader.
 * Wave A paints fast; week uses 2 range APIs; month is lazy.
 */
export function useProductionDashboard({ refreshMs = 45000 } = {}) {
  const { company, user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [model, setModel] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [connection, setConnection] = useState('OFFLINE')
  const [periodLoading, setPeriodLoading] = useState({ month: false })
  const abortRef = useRef(null)
  const softTimerRef = useRef(null)
  const payloadRef = useRef({})
  const monthLoadedRef = useRef(false)

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
      weekReports: [],
      lastWeekReports: [],
      monthReports: [],
      lastMonthReports: [],
      weekSummary: payload.weekSummary || null,
      lastWeekSummary: payload.lastWeekSummary || null,
      monthSummary: payload.monthSummary || null,
      lastMonthSummary: payload.lastMonthSummary || null,
      employees: payload.employeesRes,
      passes,
      processes,
      me,
      stockOverview: payload.stockOverview,
      alertsRes: payload.alertsRes,
    })
  }, [user])

  const publish = useCallback((partial) => {
    payloadRef.current = { ...payloadRef.current, ...partial }
    setModel(assemble(payloadRef.current))
    setLastUpdated(new Date())
  }, [assemble])

  const loadCore = useCallback(async ({ soft = false } = {}) => {
    if (abortRef.current) abortRef.current.abort()
    const ac = new AbortController()
    abortRef.current = ac
    if (!soft) {
      setLoading(true)
      setError(null)
    }
    try {
      const today = dayKey()

      // Wave A — first paint
      const [summaryRes, boardRes, widgetsRes, shiftRes, flowRes, todayReport, meRes] = await Promise.all([
        productionControlApi.getLiveFloorSummary({ signal: ac.signal }).catch(() => null),
        productionControlApi.getLiveFloorBoard({ signal: ac.signal }).catch(() => null),
        productionControlApi.getLiveFloorWidgets({ signal: ac.signal }).catch(() => null),
        productionControlApi.getCurrentShift({ signal: ac.signal }).catch(() => null),
        productionControlApi.getFlow({ signal: ac.signal }).catch(() => null),
        productionControlApi.reportDaily({ date: today }, { signal: ac.signal }).catch(() => null),
        productionControlApi.me({ signal: ac.signal }).catch(() => null),
      ])
      if (ac.signal.aborted) return

      if (!summaryRes && !boardRes && !widgetsRes) {
        setError('Unable to load production floor data')
      } else {
        setError(null)
      }

      publish({
        summaryRes,
        boardRes,
        widgetsRes,
        shiftRes,
        flowRes,
        todayReport,
        meRes,
      })
      if (!soft) setLoading(false)

      // Wave B — enrich
      const [yesterdayReport, deptsRes, floorSessions, employeesRes, passesRes, processesRes, stockOverview, alertsRes] = await Promise.all([
        productionControlApi.reportDaily({ date: dayKey(addDays(new Date(), -1)) }, { signal: ac.signal }).catch(() => null),
        productionControlApi.listDepartments({ signal: ac.signal }).catch(() => null),
        productionControlApi.listFloorSessions({ status: 'OPEN' }, { signal: ac.signal }).catch(() => null),
        hrAPI.getEmployees().catch(() => null),
        productionControlApi.listPasses({ limit: 50 }, { signal: ac.signal }).catch(() => null),
        productionControlApi.listProcesses({ limit: 50 }, { signal: ac.signal }).catch(() => null),
        productionControlApi.getStockOverview({ signal: ac.signal }).catch(() => null),
        productionControlApi.listAlerts({ limit: 20, status: 'OPEN' }, { signal: ac.signal }).catch(() => null),
      ])
      if (ac.signal.aborted) return
      publish({
        yesterdayReport,
        deptsRes,
        floorSessions,
        employeesRes,
        passesRes,
        processesRes,
        stockOverview,
        alertsRes,
      })

      // Wave C — week comparisons (2 range APIs, not 14 daily)
      const thisWeekRange = rangeDates(0, 7)
      const lastWeekRange = rangeDates(7, 7)
      const [thisWeekPerf, lastWeekPerf] = await Promise.all([
        productionControlApi.reportDepartmentPerformance(thisWeekRange, { signal: ac.signal }).catch(() => null),
        productionControlApi.reportDepartmentPerformance(lastWeekRange, { signal: ac.signal }).catch(() => null),
      ])
      if (ac.signal.aborted) return
      publish({
        weekSummary: summarizeDeptPerf(thisWeekPerf),
        lastWeekSummary: summarizeDeptPerf(lastWeekPerf),
      })
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || ac.signal.aborted) return
      setError(err?.response?.data?.message || err?.message || 'Failed to load Production Dashboard')
      if (!soft) setLoading(false)
    }
  }, [publish])

  const softRefreshFloor = useCallback(async () => {
    const ac = new AbortController()
    // Don't abort core loads mid-flight for soft refresh; use a separate short fetch
    try {
      const [summaryRes, boardRes, widgetsRes, shiftRes] = await Promise.all([
        productionControlApi.getLiveFloorSummary({ signal: ac.signal }).catch(() => null),
        productionControlApi.getLiveFloorBoard({ signal: ac.signal }).catch(() => null),
        productionControlApi.getLiveFloorWidgets({ signal: ac.signal }).catch(() => null),
        productionControlApi.getCurrentShift({ signal: ac.signal }).catch(() => null),
      ])
      if (!summaryRes && !boardRes && !widgetsRes) return
      publish({ summaryRes, boardRes, widgetsRes, shiftRes })
    } catch {
      /* ignore soft refresh errors */
    }
  }, [publish])

  const ensurePeriod = useCallback(async (period) => {
    if (period !== 'month') return
    if (monthLoadedRef.current) return
    if (periodLoading.month) return
    setPeriodLoading((p) => ({ ...p, month: true }))
    try {
      const { thisMonth, lastMonth } = monthRanges()
      const [thisMonthPerf, lastMonthPerf] = await Promise.all([
        productionControlApi.reportDepartmentPerformance(thisMonth).catch(() => null),
        productionControlApi.reportDepartmentPerformance(lastMonth).catch(() => null),
      ])
      monthLoadedRef.current = true
      publish({
        monthSummary: summarizeDeptPerf(thisMonthPerf),
        lastMonthSummary: summarizeDeptPerf(lastMonthPerf),
      })
    } finally {
      setPeriodLoading((p) => ({ ...p, month: false }))
    }
  }, [periodLoading.month, publish])

  useEffect(() => {
    loadCore({ soft: false })
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [loadCore])

  useEffect(() => {
    if (!refreshMs || refreshMs < 5000) return undefined
    const id = setInterval(() => softRefreshFloor(), refreshMs)
    return () => clearInterval(id)
  }, [softRefreshFloor, refreshMs])

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
          softTimerRef.current = setTimeout(() => softRefreshFloor(), 300)
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
  }, [company, user?.company, softRefreshFloor])

  return {
    loading,
    error,
    model,
    lastUpdated,
    connection,
    periodLoading,
    ensurePeriod,
    refresh: () => {
      monthLoadedRef.current = false
      return loadCore({ soft: false })
    },
    softRefresh: () => softRefreshFloor(),
  }
}
