import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

function errMsg(err, fallback) {
  return err?.response?.data?.message || err?.message || fallback
}

/**
 * Progressive Production Dashboard loader + floor actions.
 */
export function useProductionDashboard({ refreshMs = 45000 } = {}) {
  const { company, user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [model, setModel] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [connection, setConnection] = useState('OFFLINE')
  const [periodLoading, setPeriodLoading] = useState({ month: false })
  const [stockLedger, setStockLedger] = useState([])
  const [stockLedgerLoading, setStockLedgerLoading] = useState(false)
  const [metalMovements, setMetalMovements] = useState([])
  const [selectedDeptKey, setSelectedDeptKey] = useState(null)
  const [selectedBatchId, setSelectedBatchId] = useState(null)
  const [batchDetail, setBatchDetail] = useState(null)
  const [deptDetail, setDeptDetail] = useState(null)
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
    const movements = payload.metalMovements
      || payload.movementsRes?.movements
      || (Array.isArray(payload.movementsRes) ? payload.movementsRes : [])
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
      weightVarianceRes: payload.weightVarianceRes,
      metalMovements: movements,
    })
  }, [user])

  const publish = useCallback((partial) => {
    payloadRef.current = { ...payloadRef.current, ...partial }
    setModel(assemble(payloadRef.current))
    setLastUpdated(new Date())
    if (partial.metalMovements || partial.movementsRes) {
      const moves = partial.metalMovements
        || partial.movementsRes?.movements
        || (Array.isArray(partial.movementsRes) ? partial.movementsRes : null)
      if (moves) setMetalMovements(moves)
    }
  }, [assemble])

  const refreshLedgerAndStock = useCallback(async (signal) => {
    setStockLedgerLoading(true)
    const [stockMoveRes, movementsRes, stockOverview, weightVarianceRes, floorSessions, alertsRes, passesRes] = await Promise.all([
      productionControlApi.reportStockMovement({ limit: 120 }, { signal }).catch(() => null),
      productionControlApi.listMovements({ limit: 80 }, { signal }).catch(() => null),
      productionControlApi.getStockOverview({ signal }).catch(() => null),
      productionControlApi.reportWeightVariance({ limit: 100 }, { signal }).catch(() => null),
      productionControlApi.listFloorSessions({ status: 'OPEN' }, { signal }).catch(() => null),
      productionControlApi.listAlerts({ limit: 20, status: 'OPEN' }, { signal }).catch(() => null),
      productionControlApi.listPasses({ limit: 50 }, { signal }).catch(() => null),
    ])
    if (signal?.aborted) return
    const ledger = stockMoveRes?.report?.ledger || stockMoveRes?.ledger || []
    setStockLedger(Array.isArray(ledger) ? ledger : [])
    setStockLedgerLoading(false)
    publish({
      stockOverview,
      weightVarianceRes,
      floorSessions,
      alertsRes,
      passesRes,
      movementsRes,
      metalMovements: movementsRes?.movements || [],
    })
  }, [publish])

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

      const [yesterdayReport, deptsRes, floorSessions, employeesRes, passesRes, processesRes, stockOverview, alertsRes, weightVarianceRes, movementsRes] = await Promise.all([
        productionControlApi.reportDaily({ date: dayKey(addDays(new Date(), -1)) }, { signal: ac.signal }).catch(() => null),
        productionControlApi.listDepartments({ signal: ac.signal }).catch(() => null),
        productionControlApi.listFloorSessions({ status: 'OPEN' }, { signal: ac.signal }).catch(() => null),
        hrAPI.getEmployees().catch(() => null),
        productionControlApi.listPasses({ limit: 50 }, { signal: ac.signal }).catch(() => null),
        productionControlApi.listProcesses({ limit: 50 }, { signal: ac.signal }).catch(() => null),
        productionControlApi.getStockOverview({ signal: ac.signal }).catch(() => null),
        productionControlApi.listAlerts({ limit: 20, status: 'OPEN' }, { signal: ac.signal }).catch(() => null),
        productionControlApi.reportWeightVariance({ limit: 100 }, { signal: ac.signal }).catch(() => null),
        productionControlApi.listMovements({ limit: 80 }, { signal: ac.signal }).catch(() => null),
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
        weightVarianceRes,
        movementsRes,
        metalMovements: movementsRes?.movements || [],
      })

      setStockLedgerLoading(true)
      const stockMoveRes = await productionControlApi
        .reportStockMovement({ limit: 120 }, { signal: ac.signal })
        .catch(() => null)
      if (!ac.signal.aborted) {
        const ledger = stockMoveRes?.report?.ledger || stockMoveRes?.ledger || []
        setStockLedger(Array.isArray(ledger) ? ledger : [])
        setStockLedgerLoading(false)
      }

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

  const afterWrite = useCallback(async () => {
    await softRefreshFloor()
    await refreshLedgerAndStock()
  }, [softRefreshFloor, refreshLedgerAndStock])

  const withAction = useCallback(async (fn) => {
    setActionBusy(true)
    setActionError(null)
    try {
      const result = await fn()
      await afterWrite()
      return result
    } catch (err) {
      const message = errMsg(err, 'Action failed')
      setActionError(message)
      throw err
    } finally {
      setActionBusy(false)
    }
  }, [afterWrite])

  const selectBatch = useCallback(async (batchId) => {
    setSelectedBatchId(batchId || null)
    setBatchDetail(null)
    if (!batchId) return null
    try {
      const [batchRes, traceRes] = await Promise.all([
        productionControlApi.getBatch(batchId).catch(() => null),
        productionControlApi.getTraceability({ batchId }).catch(() => null),
      ])
      const batch = batchRes?.batch || batchRes
      const detail = {
        batch,
        trace: traceRes?.trace || traceRes?.report || traceRes || null,
        movements: (metalMovements || []).filter(
          (m) => String(m.batchId) === String(batchId)
            || String(m.batchNumber) === String(batch?.batchNumber || ''),
        ),
      }
      setBatchDetail(detail)
      return detail
    } catch (err) {
      setActionError(errMsg(err, 'Failed to load batch'))
      return null
    }
  }, [metalMovements])

  const viewDepartment = useCallback(async (deptKey) => {
    if (!deptKey) {
      setDeptDetail(null)
      return null
    }
    setSelectedDeptKey(deptKey)
    try {
      const res = await productionControlApi.getDepartment(deptKey).catch(() => null)
      const detail = res?.department || res || { key: deptKey }
      setDeptDetail(detail)
      return detail
    } catch (err) {
      setActionError(errMsg(err, 'Failed to load department'))
      return null
    }
  }, [])

  const actions = useMemo(() => ({
    selectDepartment: (key) => {
      setSelectedDeptKey(key || null)
      if (!key) setDeptDetail(null)
    },
    clearDepartment: () => {
      setSelectedDeptKey(null)
      setDeptDetail(null)
    },
    viewDepartment,
    selectBatch,
    metalTransfer: ({ batchId, fromDepartment, toDepartment, weight, receiveWeight, mode }) => withAction(async () => {
      if (mode === 'receive' || mode === 'in') {
        const open = (payloadRef.current.passesRes?.passes || [])
          .find((p) => {
            const st = String(p.status || '').toUpperCase()
            if (!['ISSUED', 'IN_TRANSIT', 'APPROVED'].includes(st)) return false
            if (batchId && String(p.batchId) !== String(batchId)) return false
            if (toDepartment && String(p.toDepartment || '').toLowerCase() !== String(toDepartment).toLowerCase()) return false
            return true
          })
        if (!open?._id && !open?.id) throw new Error('No open pass to receive for this department/batch')
        const passId = open._id || open.id
        return productionControlApi.receivePass(passId, {
          receivedWeight: Number(receiveWeight ?? weight),
        })
      }
      const { pass } = await productionControlApi.createPass({
        batchId,
        fromDepartment: fromDepartment || undefined,
        toDepartment,
        weight: Number(weight),
      })
      const passId = pass._id || pass.id
      try {
        await productionControlApi.approvePass(passId)
      } catch {
        /* approve may already be done or not required for role */
      }
      await productionControlApi.issuePass(passId, {})
      return pass
    }),
    receiveOpenPass: ({ passId, receivedWeight }) => withAction(async () => (
      productionControlApi.receivePass(passId, { receivedWeight: Number(receivedWeight) })
    )),
    operatorIn: ({ employeeId } = {}) => withAction(async () => (
      productionControlApi.floorLogin({ employeeId: employeeId || undefined })
    )),
    operatorOut: () => withAction(async () => (
      productionControlApi.floorLogout({})
    )),
    issueMetal: ({ batchId, inventoryItemId, weight, purpose }) => withAction(async () => (
      productionControlApi.issueFromVault(batchId, {
        inventoryItemId: inventoryItemId || undefined,
        weight: Number(weight),
        purpose: purpose || 'Dashboard vault issue',
      })
    )),
    createBatchForIssue: ({ metalType, purity, targetWeight, inventoryItemId }) => withAction(async () => (
      productionControlApi.createBatch({
        metalType: metalType || 'Gold',
        purity: purity || '',
        initialWeight: Number(targetWeight),
        inventoryItemId: inventoryItemId || undefined,
      })
    )),
    acknowledgeAlert: (id) => withAction(async () => productionControlApi.acknowledgeAlert(id)),
    resolveAlert: (id) => withAction(async () => productionControlApi.resolveAlert(id)),
    listAwaitingBatches: async () => {
      const res = await productionControlApi.listBatches({ status: 'AWAITING_ISSUE', limit: 40 }).catch(() => null)
      const created = await productionControlApi.listBatches({ status: 'CREATED', limit: 40 }).catch(() => null)
      const a = res?.batches || res?.data || []
      const b = created?.batches || created?.data || []
      const map = new Map()
      ;[...a, ...b].forEach((row) => map.set(String(row._id || row.id), row))
      return [...map.values()]
    },
  }), [withAction, viewDepartment, selectBatch])

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
    actionError,
    actionBusy,
    clearActionError: () => setActionError(null),
    model,
    lastUpdated,
    connection,
    periodLoading,
    stockLedger,
    stockLedgerLoading,
    metalMovements,
    selectedDeptKey,
    selectedBatchId,
    batchDetail,
    deptDetail,
    actions,
    ensurePeriod,
    refresh: () => {
      monthLoadedRef.current = false
      return loadCore({ soft: false })
    },
    softRefresh: () => softRefreshFloor(),
  }
}
