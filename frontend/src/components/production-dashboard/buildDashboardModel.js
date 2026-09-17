import { canPcc } from '../production-control/shared'
import { numOrNull, metalLoss, lossPercent, completionPercent, percentChange, shiftProgressPercent, elapsedMinutes, dayKey, addDays } from './safeMath'
import {
  ASSEMBLY_TABLE_COUNT,
  DASHBOARD_DEPARTMENTS,
  MATERIAL_FLOW_STEPS,
  matchDashboardDeptKey,
  parseAssemblyTableIndex,
} from './departmentConfig'

const VAULT_KEYS = new Set(['vault', 'vault_return'])

const FALLBACK_STAGES = [
  { key: 'melting', label: 'Melting', process: 'melting' },
  { key: 'casting', label: 'Casting', process: 'casting' },
  { key: 'rolling', label: 'Rolling', process: 'rolling' },
  { key: 'bangle_division', label: 'Bangle Division', process: 'bangle_division' },
  { key: 'stamping', label: 'Stamping', process: 'stamping' },
  { key: 'polishing', label: 'Polishing', process: 'polishing' },
  { key: 'quality_control', label: 'Quality Control', process: 'quality_control' },
  { key: 'packing', label: 'Packing', process: 'packing' },
]

const TIMELINE_KEYS = [
  { key: 'started', label: 'Batch Started' },
  { key: 'melting', label: 'Melting' },
  { key: 'processing', label: 'Processing' },
  { key: 'quality', label: 'Quality / Checking' },
  { key: 'completed', label: 'Completed' },
]

export function pickStages(flow) {
  const stages = Array.isArray(flow?.stages) ? flow.stages : []
  const processStages = stages
    .filter((s) => s?.key && !VAULT_KEYS.has(String(s.key)))
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
  if (processStages.length >= 1) return processStages
  return FALLBACK_STAGES
}

export function mapBatchStatus(batch, delayed) {
  if (!batch) return 'Pending'
  if (delayed) return 'Delayed'
  const st = String(batch.status || '').toUpperCase()
  if (['CANCELLED', 'FAULT', 'ERROR', 'STOPPED'].includes(st)) return 'Stopped'
  if (['COMPLETED', 'RETURNED_TO_VAULT', 'DONE', 'CLOSED'].includes(st)) return 'Completed'
  if (['HOLD', 'ON_HOLD'].includes(st)) return 'Stopped'
  if (['CREATED', 'AWAITING_ISSUE', 'WAITING', 'QUEUED'].includes(st)) return 'Pending'
  if (['IN_PROCESS', 'IN_PROGRESS', 'ISSUED', 'RECEIVED', 'IN_TRANSIT', 'QC', 'REWORK', 'PROCESSING'].includes(st)) {
    return 'In Progress'
  }
  if (batch.startedAt) return 'In Progress'
  return 'Pending'
}

function personName(p) {
  if (!p) return null
  if (typeof p === 'string') return p
  return p.name || p.userName || p.employeeName || null
}

function reportSummary(report) {
  const s = report?.summary || report || {}
  return {
    jobs: numOrNull(s.jobs),
    completed: numOrNull(s.completed),
    pending: numOrNull(s.pending),
    weightIn: numOrNull(s.weightIn),
    weightOut: numOrNull(s.weightOut),
    scrap: numOrNull(s.scrap),
    loss: numOrNull(s.loss),
    byDepartment: report?.byDepartment || s.byDepartment || [],
  }
}

function sumReports(reports) {
  const rows = (reports || []).map(reportSummary).filter((r) => r.jobs != null || r.weightOut != null || r.completed != null)
  if (!rows.length) return null
  return rows.reduce(
    (acc, r) => ({
      jobs: (acc.jobs || 0) + (r.jobs || 0),
      completed: (acc.completed || 0) + (r.completed || 0),
      pending: (acc.pending || 0) + (r.pending || 0),
      weightIn: (acc.weightIn || 0) + (r.weightIn || 0),
      weightOut: (acc.weightOut || 0) + (r.weightOut || 0),
      scrap: (acc.scrap || 0) + (r.scrap || 0),
      loss: (acc.loss || 0) + (r.loss || 0),
    }),
    { jobs: 0, completed: 0, pending: 0, weightIn: 0, weightOut: 0, scrap: 0, loss: 0 },
  )
}

function avgProcessMinutes(report) {
  const s = report?.summary || report || {}
  return numOrNull(s.avgMinutes ?? s.averageProcessingMinutes ?? s.avgProcessingMinutes)
}

function buildComparison(current, previous) {
  if (!current && !previous) {
    return { available: false, metrics: null }
  }
  if (!current || !previous) {
    return { available: false, metrics: null }
  }
  const metrics = [
    { key: 'processed', label: 'Total Processed', current: current.weightIn, previous: previous.weightIn },
    { key: 'output', label: 'Total Output', current: current.weightOut, previous: previous.weightOut },
    { key: 'loss', label: 'Metal Loss', current: current.loss, previous: previous.loss },
    { key: 'batches', label: 'Batches', current: current.jobs, previous: previous.jobs },
    {
      key: 'completion',
      label: 'Completion',
      current: completionPercent(current.completed, current.jobs),
      previous: completionPercent(previous.completed, previous.jobs),
      isPercent: true,
    },
    {
      key: 'avgTime',
      label: 'Avg Processing Time',
      current: null,
      previous: null,
    },
  ].map((m) => ({
    ...m,
    delta: percentChange(m.current, m.previous),
  }))
  return { available: true, metrics, current, previous }
}

function matchEmployee(employees, nameOrId) {
  if (!nameOrId || !employees?.length) return null
  const needle = String(nameOrId).trim().toLowerCase()
  return employees.find((e) => {
    const code = String(e.employeeCode || e.idNumber || e.employeeId || '').toLowerCase()
    const name = String(e.name || '').toLowerCase()
    return code === needle || name === needle || name.includes(needle) || needle.includes(name)
  }) || null
}

function metalConfirmState(batch, pass) {
  const passSt = String(pass?.status || '').toUpperCase()
  if (['RECEIVED', 'COMPLETED'].includes(passSt)) return 'Approved'
  if (['ISSUED', 'IN_TRANSIT', 'APPROVED'].includes(passSt)) return 'Entered'
  const st = String(batch?.status || '').toUpperCase()
  if (['RECEIVED', 'COMPLETED', 'RETURNED_TO_VAULT'].includes(st)
    && (batch?.receivedWeight != null || batch?.processOutputWeight != null)) {
    return 'Approved'
  }
  if (batch?.processInputWeight != null || batch?.issuedWeight != null || batch?.processOutputWeight != null) {
    return 'Entered'
  }
  if (batch?.currentWeight != null || batch?.initialWeight != null) return 'Calculated'
  return null
}

function timelineState(batch, stages) {
  if (!batch) {
    return TIMELINE_KEYS.map((t) => ({ ...t, state: 'pending' }))
  }
  const st = String(batch.status || '').toUpperCase()
  const dept = String(batch.currentDepartment || batch.currentProcess || '').toLowerCase()
  const stageKeys = (stages || []).map((s) => String(s.key).toLowerCase())
  const meltingIdx = stageKeys.findIndex((k) => k.includes('melt'))

  let current = 'started'
  if (['COMPLETED', 'RETURNED_TO_VAULT'].includes(st)) current = 'completed'
  else if (st === 'QC' || st === 'QC_FAILED' || dept.includes('quality') || dept.includes('qc')) current = 'quality'
  else if (dept.includes('melt') || (meltingIdx >= 0 && dept === stageKeys[meltingIdx])) current = 'melting'
  else if (batch.startedAt || ['IN_PROCESS', 'RECEIVED', 'ISSUED', 'IN_TRANSIT', 'REWORK'].includes(st)) current = 'processing'
  else if (['CREATED', 'AWAITING_ISSUE', 'WAITING'].includes(st)) current = 'started'

  const order = ['started', 'melting', 'processing', 'quality', 'completed']
  const curIdx = order.indexOf(current)
  return TIMELINE_KEYS.map((t, i) => {
    let state = 'pending'
    if (i < curIdx) state = 'done'
    else if (i === curIdx) state = 'active'
    if (current === 'completed') state = 'done'
    return { ...t, state }
  })
}

function processProgress(batch, status) {
  if (status === 'Completed') return { mode: 'determinate', percent: 100 }
  if (status === 'Pending') return { mode: 'determinate', percent: 0 }
  if (status === 'Stopped' || status === 'Delayed') return { mode: 'indeterminate', percent: null, warn: status === 'Delayed', error: status === 'Stopped' }
  const start = batch?.startedAt || batch?.processStartTime
  const targetMin = numOrNull(batch?.expectedDurationMinutes ?? batch?.targetDurationMinutes)
  if (start && targetMin && targetMin > 0) {
    const elapsed = elapsedMinutes(start)
    if (elapsed != null) {
      return { mode: 'determinate', percent: Math.min(99, Math.round((elapsed / targetMin) * 100)) }
    }
  }
  return { mode: 'indeterminate', percent: null }
}

/** Map internal batch status to reference card labels. */
function displayDeptStatus(mapped, hasBatch) {
  if (!hasBatch) return 'Idle'
  if (mapped === 'Completed') return 'Completed'
  if (mapped === 'In Progress') return 'Running'
  if (mapped === 'Pending' || mapped === 'Delayed') return 'Waiting'
  if (mapped === 'Stopped') return 'Idle'
  return 'Idle'
}

function batchMatchesDept(batch, dept) {
  const keys = [dept.key, ...(dept.aliases || [])]
  const candidates = [
    batch.currentDepartment,
    batch.department,
    batch.currentProcess,
    batch.process,
    batch.currentLocation,
  ]
  for (const c of candidates) {
    const matched = matchDashboardDeptKey(c)
    if (matched === dept.key) return true
    const token = String(c || '').toLowerCase()
    if (keys.some((k) => token === String(k).toLowerCase() || token.includes(String(k).toLowerCase().replace(/_/g, ' ')))) {
      return true
    }
  }
  return false
}

function alertSeverityTone(severity) {
  const s = String(severity || '').toLowerCase()
  if (s === 'critical' || s === 'error') return 'critical'
  if (s === 'warning' || s === 'attention') return 'warning'
  if (s === 'success' || s === 'ok') return 'success'
  return 'info'
}

function stockBucketGrams(stock, keys) {
  if (!stock || typeof stock !== 'object') return null
  for (const k of keys) {
    const node = stock[k]
    if (node == null) continue
    const g = numOrNull(node.weight ?? node.totalWeight ?? node.grams ?? node.quantity)
    if (g != null) return g
    if (typeof node === 'number') return numOrNull(node)
  }
  return null
}

export function buildDashboardModel({
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
  monthReports,
  lastMonthReports,
  weekSummary = null,
  lastWeekSummary = null,
  monthSummary = null,
  lastMonthSummary = null,
  employees,
  passes,
  processes,
  me,
  stockOverview = null,
  alertsRes = null,
}) {
  const kpis = summaryRes?.kpis || {}
  const statusCountsRaw = summaryRes?.statusCounts || {}
  const shift = shiftRes?.shift || shiftRes || widgetsRes?.currentShift || summaryRes?.currentShift || null
  const managers = widgetsRes?.managersPresent || summaryRes?.managersPresent || []
  const operators = widgetsRes?.operatorsPresent || summaryRes?.operatorsPresent || []
  const activeBatches = boardRes?.activeBatches || summaryRes?.activeBatches || []
  const departments = deptsRes?.departments || widgetsRes?.departments || summaryRes?.departments || []
  const delayedIds = new Set(
    (summaryRes?.delayedBatchIds || boardRes?.delayedBatchIds || []).map((id) => String(id)),
  )

  const floorManager = (() => {
    const open = (floorSessions?.sessions || floorSessions || []).find?.((s) => String(s.status || '').toUpperCase() === 'OPEN')
      || (Array.isArray(floorSessions) ? floorSessions.find((s) => String(s.status || '').toUpperCase() === 'OPEN') : null)
    if (open) return personName(open) || open.name || null
    if (Array.isArray(managers) && managers.length) return personName(managers[0])
    return summaryRes?.floorManagerName || null
  })()

  const empList = Array.isArray(employees) ? employees : (employees?.employees || employees?.data || [])
  const activeEmployees = empList.filter((e) => String(e.status || 'ACTIVE').toUpperCase() === 'ACTIVE')
  const operatorNames = (Array.isArray(operators) ? operators : []).map((o) => personName(o) || o).filter(Boolean)
  const empCodes = (operatorNames.length
    ? operatorNames.map((n) => {
      const hit = matchEmployee(empList, n)
      return hit?.employeeCode || hit?.idNumber || n
    })
    : activeEmployees.slice(0, 12).map((e) => e.employeeCode || e.idNumber || e.name)
  ).filter(Boolean)

  const today = reportSummary(todayReport)
  const yesterday = reportSummary(yesterdayReport)
  const thisWeek = weekSummary || sumReports(weekReports)
  const lastWeek = lastWeekSummary || sumReports(lastWeekReports)
  const thisMonth = monthSummary || sumReports(monthReports)
  const lastMonth = lastMonthSummary || sumReports(lastMonthReports)

  const stages = pickStages(flowRes?.flow || flowRes)
  const reportByDept = today.byDepartment || []

  const buildCardForDept = (dept) => {
    const key = dept.key
    const label = dept.label
    const deptMeta = (departments || []).find((d) => matchDashboardDeptKey(d.key || d.department) === key) || {}
    const reportDept = (reportByDept || []).find((d) => matchDashboardDeptKey(d.department || d.key) === key) || {}
    const batchesHere = (activeBatches || []).filter((b) => batchMatchesDept(b, dept))
    const primary = batchesHere[0] || null
    const delayed = primary && delayedIds.has(String(primary._id || primary.id))
    const mapped = mapBatchStatus(primary, delayed)
    const status = displayDeptStatus(mapped, Boolean(primary) || reportDept.jobs != null)
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
    const loss = metalLoss(metalIn, metalOut)
    const lossPct = lossPercent(metalIn, metalOut)
    const startedAt = primary?.startedAt || primary?.processStartTime || null
    const completedAt = primary?.completedAt || primary?.processEndTime || null
    const elapsed = elapsedMinutes(startedAt, completedAt || undefined)
    const holder = primary?.currentHolderName || primary?.operatorName || null
    const emp = matchEmployee(empList, holder)
    const passForBatch = (passes || []).find(
      (p) => String(p.batchId || p.batch?._id || '') === String(primary?._id || primary?.id || '')
        || String(p.batchNumber || '') === String(primary?.batchNumber || ''),
    )
    const processRun = (processes || []).find(
      (pr) => String(pr.batchId || '') === String(primary?._id || primary?.id || '')
        && matchDashboardDeptKey(pr.department || pr.process) === key,
    )
    const employeeCount = new Set(
      batchesHere.map((b) => b.currentHolderName || b.operatorName).filter(Boolean),
    ).size || (holder ? 1 : 0)

    return {
      key,
      name: label,
      status,
      batchId: primary?._id || primary?.id || null,
      batchNumber: primary?.batchNumber || null,
      employeeName: holder,
      employeeCode: emp?.employeeCode || emp?.idNumber || null,
      employeeCount: employeeCount || null,
      floorManager: floorManager,
      shiftName: shift?.name || shift?.shiftName || null,
      startedAt,
      completedAt,
      elapsedMin: elapsed,
      metalIn,
      metalOut,
      metalLoss: loss != null ? Math.max(0, loss) : null,
      lossPct,
      confirmState: metalConfirmState(primary, passForBatch),
      passId: passForBatch?._id || passForBatch?.id || null,
      passStatus: passForBatch?.status || null,
      progress: processProgress(primary || processRun, mapped),
      quantity: numOrNull(primary?.currentWeight ?? primary?.targetQuantity ?? reportDept.weightIn ?? reportDept.jobs),
      timeTakenMin: elapsed,
      hasData: Boolean(primary) || metalIn != null || metalOut != null || reportDept.jobs != null,
      isMelting: key === 'melting',
      isAssembly: key === 'assembly',
      tableCount: dept.tableCount || null,
      activeBatchCount: batchesHere.length,
    }
  }

  const deptCards = DASHBOARD_DEPARTMENTS.map(buildCardForDept)
  const liveCards = deptCards

  // Assembly tables 1–15
  const assemblyDept = DASHBOARD_DEPARTMENTS.find((d) => d.key === 'assembly')
  const assemblyBatches = assemblyDept
    ? (activeBatches || []).filter((b) => batchMatchesDept(b, assemblyDept))
    : []
  const assemblyTables = Array.from({ length: ASSEMBLY_TABLE_COUNT }, (_, i) => {
    const tableNo = i + 1
    const batch = assemblyBatches.find((b) => {
      const idx = parseAssemblyTableIndex(b.currentMachineName)
        || parseAssemblyTableIndex(b.currentLocation)
        || parseAssemblyTableIndex(b.currentHolderName)
        || parseAssemblyTableIndex(b.machineName)
      return idx === tableNo
    }) || null
    const delayed = batch && delayedIds.has(String(batch._id || batch.id))
    const mapped = mapBatchStatus(batch, delayed)
    return {
      tableNo,
      label: `Table ${tableNo}`,
      status: displayDeptStatus(mapped, Boolean(batch)),
      batchId: batch?._id || batch?.id || null,
      batchNumber: batch?.batchNumber || null,
      quantity: numOrNull(batch?.currentWeight),
      employeeName: batch?.currentHolderName || batch?.operatorName || null,
      elapsedMin: elapsedMinutes(batch?.startedAt || batch?.processStartTime),
    }
  })

  const selectedBatch = activeBatches[0] || null
  const timeline = timelineState(selectedBatch, stages)

  const deptRows = deptCards.map((c) => ({
    department: c.name,
    key: c.key,
    batch: c.batchNumber,
    batchId: c.batchId,
    employee: c.employeeName || c.employeeCode,
    quantity: c.quantity,
    input: c.metalIn,
    output: c.metalOut,
    timeTakenMin: c.timeTakenMin,
    status: c.status,
  }))

  const batchMonitorRows = (activeBatches || []).slice(0, 40).map((b) => {
    const delayed = delayedIds.has(String(b._id || b.id))
    const mapped = mapBatchStatus(b, delayed)
    const status = displayDeptStatus(mapped, true)
    const metalIn = numOrNull(b.processInputWeight ?? b.issuedWeight ?? b.initialWeight)
    const metalOut = numOrNull(b.processOutputWeight ?? b.receivedWeight ?? b.currentWeight)
    const loss = metalLoss(metalIn, metalOut)
    const startedAt = b.startedAt || b.processStartTime || b.createdAt || null
    const progress = processProgress(b, mapped)
    const deptKey = matchDashboardDeptKey(b.currentDepartment || b.currentProcess || b.department)
    const deptLabel = DASHBOARD_DEPARTMENTS.find((d) => d.key === deptKey)?.label
      || b.currentDepartment
      || b.currentProcess
      || '—'
    return {
      id: b._id || b.id,
      batchNumber: b.batchNumber || '—',
      department: deptLabel,
      qtyIn: metalIn,
      qtyOut: metalOut,
      employee: b.currentHolderName || b.operatorName || null,
      startedAt,
      durationMin: elapsedMinutes(startedAt),
      metalLoss: loss != null ? Math.max(0, loss) : null,
      status,
      progress,
    }
  })

  const stock = stockOverview?.overview || stockOverview?.stock || stockOverview || summaryRes?.stock || {}
  const unprocessed = stockBucketGrams(stock, ['newStock', 'new_stock', 'available', 'AVAILABLE', 'vault'])
    ?? numOrNull(kpis.metalInVault)
  const underProcessing = stockBucketGrams(stock, ['underProcessing', 'under_processing', 'selected', 'processing', 'wip'])
    ?? numOrNull(kpis.metalInProduction)
  const finishedGoods = stockBucketGrams(stock, ['finished', 'FINISHED', 'dispatched'])
    ?? numOrNull(today.weightOut)
  const totalStock = (() => {
    const parts = [unprocessed, underProcessing, finishedGoods].filter((n) => n != null)
    if (!parts.length) return null
    return parts.reduce((a, b) => a + b, 0)
  })()

  const materialFlow = MATERIAL_FLOW_STEPS.map((step) => {
    let weight = null
    let status = 'Idle'
    if (step.key === 'vault') {
      weight = unprocessed
      status = weight != null && weight > 0 ? 'Ready' : 'Idle'
    } else if (step.key === 'melting') {
      const card = deptCards.find((c) => c.key === 'melting')
      weight = card?.quantity ?? card?.metalIn
      status = card?.status || 'Idle'
    } else if (step.key === 'rolling') {
      const card = deptCards.find((c) => c.key === 'rolling')
      weight = card?.quantity ?? card?.metalIn
      status = card?.status || 'Idle'
    } else if (step.key === 'production') {
      weight = underProcessing
      status = (underProcessing != null && underProcessing > 0) ? 'Under Processing' : 'Idle'
    } else if (step.key === 'qc') {
      weight = numOrNull(kpis.qcPending)
      status = (numOrNull(kpis.qcPending) || 0) > 0 ? 'Waiting' : 'Idle'
    } else if (step.key === 'finished') {
      weight = finishedGoods
      status = weight != null && weight > 0 ? 'Completed' : 'Idle'
    }
    return { ...step, weight, status }
  })

  const stockSummary = {
    unprocessed,
    underProcessing,
    finishedGoods,
    totalBalance: totalStock,
    movementIn: numOrNull(today.weightIn) ?? numOrNull(kpis.metalReceivedToday),
    movementOut: numOrNull(today.weightOut) ?? numOrNull(kpis.metalDispatchedToday),
    movementWip: underProcessing,
  }

  const rawAlerts = alertsRes?.alerts
    || summaryRes?.openAlerts
    || summaryRes?.attention
    || widgetsRes?.alerts
    || []
  const alertItems = (Array.isArray(rawAlerts) ? rawAlerts : []).slice(0, 12).map((a, i) => ({
    id: a._id || a.id || `alert-${i}`,
    title: a.title || a.code || a.message || 'Alert',
    message: a.message || a.reason || '',
    tone: alertSeverityTone(a.severity || a.level || a.type),
    createdAt: a.createdAt || a.at || null,
    batchId: a.batchId || null,
  }))

  const holderStats = new Map()
  ;(activeBatches || []).forEach((b) => {
    const name = b.currentHolderName || b.operatorName
    if (!name) return
    const emp = matchEmployee(empList, name)
    const key = emp?._id || emp?.id || name
    const prev = holderStats.get(key) || {
      employeeCode: emp?.employeeCode || emp?.idNumber || null,
      name: emp?.name || name,
      department: b.currentDepartment || emp?.department || null,
      batches: 0,
      quantity: 0,
      timeSum: 0,
      timeCount: 0,
      rating: emp?.rating != null && Number.isFinite(Number(emp.rating)) ? Number(emp.rating) : null,
    }
    prev.batches += 1
    prev.quantity += numOrNull(b.currentWeight ?? b.initialWeight) || 0
    const mins = elapsedMinutes(b.startedAt, b.completedAt)
    if (mins != null) {
      prev.timeSum += mins
      prev.timeCount += 1
    }
    holderStats.set(key, prev)
  })

  empList.forEach((e) => {
    if (e.rating == null || !Number.isFinite(Number(e.rating))) return
    const key = e._id || e.id || e.employeeCode
    if (holderStats.has(key)) return
    const onFloor = operatorNames.some((n) => matchEmployee([e], n))
    if (!onFloor && String(e.department || '').toLowerCase().indexOf('prod') < 0) return
    holderStats.set(key, {
      employeeCode: e.employeeCode || e.idNumber || null,
      name: e.name,
      department: e.department || null,
      batches: 0,
      quantity: 0,
      timeSum: 0,
      timeCount: 0,
      rating: Number(e.rating),
    })
  })

  const employeeRatings = Array.from(holderStats.values()).map((row) => ({
    ...row,
    avgTimeMin: row.timeCount ? Math.round(row.timeSum / row.timeCount) : null,
    ratingLabel: row.rating != null ? row.rating : null,
  }))

  const completedBatches = numOrNull(kpis.completedToday) ?? today.completed
  const totalBatchesToday = (numOrNull(today.jobs) ?? ((numOrNull(kpis.activeBatches) || 0) + (completedBatches || 0))) || null
  const weightIn = today.weightIn ?? numOrNull(kpis.metalInProduction)
  const weightOut = today.weightOut
  const activeCount = numOrNull(kpis.activeBatches) ?? activeBatches.length

  const statusSummary = {
    active: activeCount || 0,
    completed: completedBatches || 0,
    pending: numOrNull(statusCountsRaw.WAITING ?? statusCountsRaw.CREATED ?? statusCountsRaw.AWAITING_ISSUE ?? today.pending) || 0,
    delayed: numOrNull(kpis.delayed) || delayedIds.size || 0,
    stopped: numOrNull(statusCountsRaw.HOLD ?? statusCountsRaw.CANCELLED) || 0,
  }

  const remainingWeight = (() => {
    if (weightIn != null && weightOut != null) return Math.max(0, weightIn - weightOut)
    return numOrNull(kpis.metalInProduction)
  })()

  const dayCmp = buildComparison(today, yesterday)
  const weekCmp = buildComparison(thisWeek, lastWeek)
  const dayDelta = dayCmp.available
    ? percentChange(today.weightOut ?? today.weightIn, yesterday.weightOut ?? yesterday.weightIn)
    : null
  const weekDelta = weekCmp.available
    ? percentChange(thisWeek?.weightOut ?? thisWeek?.weightIn, lastWeek?.weightOut ?? lastWeek?.weightIn)
    : null

  const role = me?.productionRole || me?.role || null
  const online = activeCount > 0 || (Array.isArray(operators) && operators.length > 0)

  return {
    header: {
      title: 'PRODUCTION CONTROL CENTER',
      subtitle: 'Jewelry & Precious Metal Manufacturing',
      dateLabel: new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
      timeLabel: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: online ? 'Factory Online — Systems Active' : (completedBatches > 0 ? 'Factory Online — Idle' : 'No production activity today'),
      statusTone: online ? 'ok' : 'muted',
      shiftName: shift?.name || shift?.shiftName || null,
      shiftStart: shift?.startTime || shift?.startLabel || null,
      shiftEnd: shift?.endTime || shift?.endLabel || null,
      floorManager,
      employeeCount: Array.isArray(operators) ? operators.length : (activeEmployees.length || null),
      activeBatches: activeCount,
      totalBatches: totalBatchesToday,
    },
    compactKpis: {
      employees: Array.isArray(operators) ? operators.length : (empList.length || null),
      floorManager: floorManager || null,
      currentShift: shift?.name || shift?.shiftName || null,
      totalProductionToday: weightIn ?? weightOut,
      underProduction: remainingWeight ?? underProcessing,
      totalOutput: weightOut,
      yesterdayVsToday: dayDelta,
      weeklyComparison: weekDelta,
    },
    employeeKpi: {
      total: empList.length || (Array.isArray(operators) ? operators.length : null),
      active: Array.isArray(operators) ? operators.length : (activeEmployees.length || null),
      idRange: empCodes,
      floorManager,
    },
    shiftKpi: {
      name: shift?.name || shift?.shiftName || null,
      startTime: shift?.startTime || null,
      endTime: shift?.endTime || null,
      elapsedMin: numOrNull(shift?.timeElapsedMinutes),
      remainingMin: numOrNull(shift?.timeRemainingMinutes),
      progress: shiftProgressPercent(shift?.timeElapsedMinutes, shift?.timeRemainingMinutes),
      floorManager,
    },
    productionTodayKpi: {
      processedQty: weightIn,
      productionWeight: weightOut,
      completedBatches,
      totalBatches: totalBatchesToday,
    },
    outputKpi: {
      inputWeight: weightIn,
      outputWeight: weightOut,
      outputQuantity: weightOut,
      completion: completionPercent(completedBatches, totalBatchesToday),
    },
    underProductionKpi: {
      activeBatches: activeCount,
      pendingQuantity: numOrNull(today.pending) ?? numOrNull(kpis.waiting),
      remainingWeight,
      estimatedCompletion: null,
    },
    comparisons: {
      day: dayCmp,
      week: weekCmp,
      month: buildComparison(thisMonth, lastMonth),
    },
    timeline,
    selectedBatch: selectedBatch
      ? { id: selectedBatch._id || selectedBatch.id, batchNumber: selectedBatch.batchNumber, status: selectedBatch.status }
      : null,
    liveCards,
    deptCards,
    assemblyTables,
    materialFlow,
    stockSummary,
    batchMonitorRows,
    alertItems,
    deptRows,
    employeeRatings,
    statusSummary,
    totalsByPeriod: {
      today: today.jobs != null || today.weightOut != null ? today : null,
      week: thisWeek,
      month: thisMonth,
    },
    stages,
    permissions: {
      role,
      canIssue: canPcc(role, 'issueMetal'),
      canReceive: canPcc(role, 'receivePass'),
      canApprove: canPcc(role, 'approvePass'),
    },
    hasAnyFloorData: Boolean(summaryRes || boardRes || widgetsRes),
  }
}

export { dayKey, addDays, reportSummary, avgProcessMinutes, TIMELINE_KEYS, FALLBACK_STAGES }
