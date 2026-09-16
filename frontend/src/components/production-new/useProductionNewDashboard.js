import { useCallback, useEffect, useRef, useState } from 'react'
import { productionControlApi } from '../../api/productionControl'

const FALLBACK_STAGES = [
  { key: 'melting', label: 'Melting', process: 'melting' },
  { key: 'casting', label: 'Casting', process: 'casting' },
  { key: 'rolling', label: 'Rolling', process: 'rolling' },
  { key: 'bangle_division', label: 'Bangle Division', process: 'bangle_division' },
  { key: 'stamping', label: 'Stamping', process: 'stamping' },
  { key: 'polishing', label: 'Polishing', process: 'polishing' },
  { key: 'quality_control', label: 'Quality Control', process: 'quality_control' },
  { key: 'packing', label: 'Packaging', process: 'packing' },
]

const VAULT_KEYS = new Set(['vault', 'vault_return'])

const ACTIVE_BATCH_STATUSES = new Set([
  'IN_PROGRESS', 'PROCESSING', 'ACTIVE', 'STARTED', 'ISSUED', 'IN_PROCESS',
  'WAITING', 'AWAITING_ISSUE', 'CREATED', 'QUEUED', 'ON_HOLD', 'HOLD',
])

function dayKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function numOrNull(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function mapProductionStatus(batch, processRun, delayed) {
  if (delayed) return 'Delayed'
  const st = String(processRun?.status || batch?.status || '').toUpperCase()
  if (!st) return 'No Data'
  if (['COMPLETED', 'DONE', 'CLOSED', 'RETURNED'].includes(st)) return 'Completed'
  if (['BATCH_OVER', 'FINISHED'].includes(st)) return 'Batch Over'
  if (['LOADING', 'LOAD'].includes(st)) return 'Loading'
  if (['PROCESSING', 'IN_PROCESS', 'RUNNING'].includes(st)) return 'Processing'
  if (['IN_PROGRESS', 'ACTIVE', 'STARTED', 'ISSUED'].includes(st)) return 'In Progress'
  if (['WAITING', 'AWAITING_ISSUE', 'QUEUED', 'CREATED'].includes(st)) return 'Waiting'
  if (['ON_HOLD', 'HOLD'].includes(st)) return 'Waiting'
  if (batch?.startedAt) return 'Batch Started'
  return 'Not Started'
}

function metalOutConfirmLabel(batch) {
  const st = String(batch?.status || '').toUpperCase()
  if (['RECEIVED', 'COMPLETED', 'RETURNED'].includes(st) && (batch?.receivedWeight != null || batch?.processOutputWeight != null)) {
    return 'Confirmed'
  }
  if (batch?.processOutputWeight != null || batch?.currentWeight != null) {
    return 'Pending'
  }
  return '—'
}

function pickStages(flow) {
  const stages = Array.isArray(flow?.stages) ? flow.stages : []
  const processStages = stages
    .filter((s) => s?.key && !VAULT_KEYS.has(String(s.key)))
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
  if (processStages.length >= 1) return processStages.slice(0, 8)
  return FALLBACK_STAGES
}

function buildDeptCard(stage, { activeBatches, departments, delayedIds, reportByDept }) {
  const key = stage.key
  const label = stage.label || stage.process || key
  const deptMeta = (departments || []).find((d) => d.key === key || d.department === key) || {}
  const reportDept = (reportByDept || []).find((d) => d.department === key || d.key === key) || {}
  const batchesHere = (activeBatches || []).filter(
    (b) => String(b.currentDepartment || b.department || '') === key
      || String(b.currentProcess || b.process || '') === key,
  )
  const primary = batchesHere[0] || null
  const delayed = primary && delayedIds.has(String(primary._id || primary.id))
  const metalIn = numOrNull(
    primary?.processInputWeight
      ?? primary?.issuedWeight
      ?? primary?.initialWeight
      ?? reportDept.weightIn
      ?? deptMeta.inputWeight,
  )
  const metalOut = numOrNull(
    primary?.processOutputWeight
      ?? primary?.receivedWeight
      ?? reportDept.weightOut
      ?? deptMeta.outputWeight,
  )
  const metalLoss = numOrNull(
    primary?.lossWeight
      ?? reportDept.loss
      ?? deptMeta.loss
      ?? (metalIn != null && metalOut != null ? Math.max(0, metalIn - metalOut) : null),
  )
  const startedAt = primary?.startedAt || primary?.processStartTime || null
  const completedAt = primary?.completedAt || primary?.processEndTime || null
  let timeTakenMin = null
  if (startedAt) {
    const end = completedAt ? new Date(completedAt) : new Date()
    const ms = end - new Date(startedAt)
    if (Number.isFinite(ms) && ms >= 0) timeTakenMin = Math.round(ms / 60000)
  }
  if (timeTakenMin == null && deptMeta.averageProcessingMinutes != null) {
    timeTakenMin = numOrNull(deptMeta.averageProcessingMinutes)
  }

  return {
    key,
    name: label,
    quantity: numOrNull(primary?.currentWeight ?? primary?.initialWeight) ?? (batchesHere.length > 0 ? batchesHere.length : null),
    batchNumber: primary?.batchNumber || '—',
    employee: primary?.currentHolderName || primary?.operatorName || '—',
    timeTakenMin,
    timePerBatchMin: numOrNull(deptMeta.averageProcessingMinutes),
    meltingTimeMin: key === 'melting' ? timeTakenMin : null,
    employeeRating: '—',
    metalLoss,
    totalProcessed: numOrNull(reportDept.weightOut ?? deptMeta.outputWeight ?? primary?.processOutputWeight),
    batchStarted: Boolean(startedAt),
    batchOver: Boolean(completedAt) || ['COMPLETED', 'RETURNED', 'CLOSED'].includes(String(primary?.status || '').toUpperCase()),
    loadingStatus: mapProductionStatus(primary, null, delayed) === 'Loading' ? 'Loading' : (primary ? '—' : 'No Data'),
    productionStatus: mapProductionStatus(primary, null, delayed),
    metalIn,
    metalOut,
    floorManagerConfirm: metalOutConfirmLabel(primary),
    startedAt,
    statusRaw: primary?.status || null,
    hasData: Boolean(primary) || metalIn != null || metalOut != null || reportDept.jobs != null,
  }
}

/**
 * Read-only aggregator for Production New dashboard.
 * Uses production-control GET APIs only — no writes.
 */
export function useProductionNewDashboard({ refreshMs = 45000 } = {}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [details, setDetails] = useState(null)
  const [cards, setCards] = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)
  const abortRef = useRef(null)

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

      const [summaryRes, boardRes, widgetsRes, flowRes, deptsRes, todayReport, yesterdayReport, weekReports] = await Promise.all([
        productionControlApi.getLiveFloorSummary({ signal: ac.signal }).catch(() => null),
        productionControlApi.getLiveFloorBoard({ signal: ac.signal }).catch(() => null),
        productionControlApi.getLiveFloorWidgets({ signal: ac.signal }).catch(() => null),
        productionControlApi.getFlow({ signal: ac.signal }).catch(() => null),
        productionControlApi.listDepartments({ signal: ac.signal }).catch(() => null),
        productionControlApi.reportDaily({ date: today }, { signal: ac.signal }).catch(() => null),
        productionControlApi.reportDaily({ date: yesterday }, { signal: ac.signal }).catch(() => null),
        Promise.all(
          Array.from({ length: 7 }, (_, i) => {
            const d = dayKey(addDays(new Date(), -i))
            return productionControlApi.reportDaily({ date: d }, { signal: ac.signal })
              .then((r) => ({ date: d, report: r }))
              .catch(() => ({ date: d, report: null }))
          }),
        ),
      ])

      if (ac.signal.aborted) return

      if (!summaryRes && !boardRes && !widgetsRes) {
        setError('Unable to load production floor data')
        setDetails(null)
        setCards(FALLBACK_STAGES.map((s) => buildDeptCard(s, { activeBatches: [], departments: [], delayedIds: new Set(), reportByDept: [] })))
        return
      }

      const kpis = summaryRes?.kpis || {}
      const shift = widgetsRes?.currentShift || summaryRes?.currentShift || null
      const managers = widgetsRes?.managersPresent || summaryRes?.managersPresent || []
      const operators = widgetsRes?.operatorsPresent || summaryRes?.operatorsPresent || []
      const activeBatches = boardRes?.activeBatches || summaryRes?.activeBatches || []
      const departments = deptsRes?.departments || widgetsRes?.departments || summaryRes?.departments || []
      const delayedIds = new Set(
        (summaryRes?.delayedBatchIds || boardRes?.delayedBatchIds || [])
          .map((id) => String(id)),
      )
      // Mark delayed from KPI count is not per-id; leave set as-is if empty.

      const todayOut = numOrNull(todayReport?.summary?.weightOut ?? todayReport?.weightOut)
      const yesterdayOut = numOrNull(yesterdayReport?.summary?.weightOut ?? yesterdayReport?.weightOut)
      const weekCompleted = (weekReports || []).reduce((sum, row) => {
        const n = numOrNull(row?.report?.summary?.completed ?? row?.report?.completed)
        return sum + (n || 0)
      }, 0)
      const weekJobs = (weekReports || []).reduce((sum, row) => {
        const n = numOrNull(row?.report?.summary?.jobs ?? row?.report?.jobs)
        return sum + (n || 0)
      }, 0)

      const floorManagerName = Array.isArray(managers) && managers.length
        ? (typeof managers[0] === 'string' ? managers[0] : managers[0]?.name || managers[0]?.userName || '—')
        : (summaryRes?.floorManagerName || '—')

      setDetails({
        employeesNumber: Array.isArray(operators) ? operators.length : null,
        floorManager: floorManagerName,
        shiftName: shift?.name || shift?.shiftName || '—',
        shiftElapsedMin: numOrNull(shift?.timeElapsedMinutes),
        shiftRemainingMin: numOrNull(shift?.timeRemainingMinutes),
        totalProductionToday: numOrNull(kpis.completedToday ?? todayReport?.summary?.completed ?? todayReport?.completed),
        underProduction: numOrNull(kpis.activeBatches ?? activeBatches.length),
        metalInProduction: numOrNull(kpis.metalInProduction),
        totalOutput: todayOut ?? numOrNull(kpis.metalInProduction),
        timeComparison: shift
          ? { elapsedMin: numOrNull(shift.timeElapsedMinutes), remainingMin: numOrNull(shift.timeRemainingMinutes) }
          : null,
        yesterdayVsToday: {
          today: numOrNull(todayReport?.summary?.completed ?? todayReport?.completed ?? kpis.completedToday),
          yesterday: numOrNull(yesterdayReport?.summary?.completed ?? yesterdayReport?.completed),
          todayWeightOut: todayOut,
          yesterdayWeightOut: yesterdayOut,
        },
        weeklyComparison: {
          completed: weekJobs || weekCompleted ? weekCompleted : null,
          jobs: weekJobs || null,
        },
      })

      const stages = pickStages(flowRes?.flow || flowRes)
      const reportByDept = todayReport?.byDepartment || []
      setCards(stages.map((stage) => buildDeptCard(stage, { activeBatches, departments, delayedIds, reportByDept })))
      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || ac.signal.aborted) return
      setError(err?.response?.data?.message || err?.message || 'Failed to load Production New')
    } finally {
      if (!soft && !ac.signal.aborted) setLoading(false)
    }
  }, [])

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

  return {
    loading,
    error,
    details,
    cards,
    lastUpdated,
    refresh: () => load({ soft: false }),
    softRefresh: () => load({ soft: true }),
  }
}
