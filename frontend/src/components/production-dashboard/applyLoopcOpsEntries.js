import { DASHBOARD_DEPARTMENTS } from './departmentConfig'
import { addDays, dayKey, percentChange } from './safeMath'

function numOrNull(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Same formula as Operations sheet Time / Batch (productionSheetUtils.entryDurationMinutes).
 * Returns unrounded minutes; caller rounds for display/avg as needed.
 */
function opsTimeBatchMinutes(entry) {
  const start = entry?.batchStartedAt ? new Date(entry.batchStartedAt) : null
  if (!start || !Number.isFinite(start.getTime())) return null
  const end = entry?.batchOverAt ? new Date(entry.batchOverAt) : new Date()
  if (!Number.isFinite(end.getTime())) return null
  const mins = (end.getTime() - start.getTime()) / 60000
  return mins >= 0 ? mins : null
}

function entryStatus(entry) {
  if (entry?.batchOverAt) return 'Completed'
  if (entry?.batchStartedAt) return 'Running'
  return 'Idle'
}

function metalLossOf(entry) {
  const explicit = numOrNull(entry?.metalLoss)
  if (explicit != null) return Math.max(0, explicit)
  const inn = numOrNull(entry?.metalIn)
  const out = numOrNull(entry?.metalOut)
  if (inn != null && out != null) return Math.max(0, inn - out)
  return null
}

function meanLoss(entries) {
  const losses = (entries || [])
    .map((e) => metalLossOf(e))
    .filter((n) => n != null && Number.isFinite(n))
  if (!losses.length) return null
  return Math.round((losses.reduce((a, b) => a + b, 0) / losses.length) * 100) / 100
}

/** Minutes for a closed batch only; unfinished batches (no Over time) return null. */
function completedBatchMinutes(entry) {
  if (!entry?.batchStartedAt || !entry?.batchOverAt) return null
  const start = new Date(entry.batchStartedAt)
  const end = new Date(entry.batchOverAt)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null
  const mins = (end.getTime() - start.getTime()) / 60000
  return mins >= 0 ? mins : null
}

/**
 * Pooled mean over finished batches only (unfinished = no Over time are skipped).
 * Returns the mean plus how many batches and distinct days it is based on.
 */
function pooledStatsOf(entries, valueOf) {
  const days = new Set()
  let sum = 0
  let batches = 0
  ;(entries || []).forEach((e) => {
    if (!e?.batchOverAt) return
    const v = valueOf(e)
    if (v == null || !Number.isFinite(v)) return
    sum += v
    batches += 1
    const day = String(e?.date || '').trim()
    if (day) days.add(day)
  })
  return { mean: batches ? sum / batches : null, batches, days: days.size }
}

function roundOrNull(n, decimals = 0) {
  if (n == null || !Number.isFinite(n)) return null
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

/** A running batch is flagged once it takes this many times the department's usual batch time. */
export const LONG_BATCH_FACTOR = 1.5

/**
 * Yesterday's batches that were still running at midnight (no Over time yet, or Over after midnight).
 * They keep showing on today's cards instead of disappearing at 00:00.
 */
function openFromYesterday(entriesAll, now = new Date()) {
  const yesterday = dayKey(addDays(now, -1))
  const midnight = new Date(now)
  midnight.setHours(0, 0, 0, 0)
  return (Array.isArray(entriesAll) ? entriesAll : []).filter((e) => {
    if (String(e?.date || '').trim() !== yesterday || !e?.batchStartedAt) return false
    if (!e.batchOverAt) return true
    const over = new Date(e.batchOverAt)
    return Number.isFinite(over.getTime()) && over >= midnight
  })
}

/** Longest running batch taking over LONG_BATCH_FACTOR × the usual time, or null. */
function longRunningOf(rows, usualMin) {
  const usual = Number(usualMin)
  if (!Number.isFinite(usual) || usual <= 0) return null
  let worst = null
  rows.forEach((e, i) => {
    if (entryStatus(e) !== 'Running') return
    const mins = opsTimeBatchMinutes(e)
    if (mins == null || mins <= usual * LONG_BATCH_FACTOR) return
    if (!worst || mins > worst.elapsedMin) {
      worst = { batchNumber: e.batchNumber ? String(e.batchNumber) : String(i + 1), elapsedMin: Math.round(mins), usualMin: Math.round(usual) }
    }
  })
  return worst
}

/**
 * Build Production Dashboard dept cards + KPI overlays from LoopC Operations entries (today).
 * @param {object[]} entries — today's entries
 * @param {object[]} [entriesAll] — prior-days entries for Total Avg (loss + time); today excluded
 * @param {object} [options]
 * @param {boolean} [options.carryOverOpen] — (MG) also show yesterday's batches still running at midnight
 *   on the cards; they stay out of today's KPI totals so nothing is counted twice
 * @param {Record<string, number>} [options.timeAverages] — (MG) usual batch minutes per department,
 *   used to flag long-running batches
 */
export function buildLoopcOpsDashboardOverlay(entries = [], entriesAll = null, { carryOverOpen = false, timeAverages = null } = {}) {
  const todayList = Array.isArray(entries) ? entries : []
  const carried = carryOverOpen
    ? openFromYesterday(entriesAll).map((e) => ({ ...e, carriedOver: true }))
    : []
  const list = carried.length ? [...carried, ...todayList] : todayList
  const today = dayKey()
  // Total Avg must never include today — previous days only
  const allList = (Array.isArray(entriesAll) ? entriesAll : [])
    .filter((e) => String(e?.date || '').trim() !== today)

  const byDept = new Map()
  const byDeptAll = new Map()
  DASHBOARD_DEPARTMENTS.forEach((d) => {
    byDept.set(d.key, [])
    byDeptAll.set(d.key, [])
  })
  list.forEach((e) => {
    const key = String(e?.departmentKey || '').trim()
    if (!byDept.has(key)) return
    byDept.get(key).push(e)
  })
  allList.forEach((e) => {
    const key = String(e?.departmentKey || '').trim()
    if (!byDeptAll.has(key)) return
    byDeptAll.get(key).push(e)
  })

  const deptCards = DASHBOARD_DEPARTMENTS.map((dept) => {
    const rows = byDept.get(dept.key) || []
    const rowsAll = byDeptAll.get(dept.key) || []
    const hasData = rows.length > 0

    let metalIn = 0
    let metalOut = 0
    let metalLossSum = 0
    let hasIn = false
    let hasOut = false
    let hasLoss = false
    const lossRows = []
    const timeRows = []
    const employees = []
    const nameSet = new Set()
    let manager = null
    let startedAt = null
    let completedAt = null
    let primary = null
    let status = 'Idle'

    rows.forEach((e, i) => {
      const inn = numOrNull(e.metalIn)
      const out = numOrNull(e.metalOut)
      const loss = metalLossOf(e)
      const baseLabel = e.batchNumber ? String(e.batchNumber) : `Batch ${i + 1}`
      const batchLabel = e.carriedOver ? `${baseLabel} (yesterday)` : baseLabel
      if (inn != null) { metalIn += inn; hasIn = true }
      if (out != null) { metalOut += out; hasOut = true }
      if (loss != null) {
        metalLossSum += loss
        hasLoss = true
        lossRows.push({ index: i + 1, label: batchLabel, loss })
      }
      const batchMins = opsTimeBatchMinutes(e)
      if (batchMins != null && Number.isFinite(batchMins)) {
        timeRows.push({ index: i + 1, label: batchLabel, minutes: Math.round(batchMins) })
      }
      const emp = String(e.employeeName || '').trim()
      if (emp) {
        nameSet.add(emp)
        employees.push({ name: emp })
      }
      const mgr = String(e.departmentManagerName || '').trim()
      if (mgr && !manager) manager = mgr
      if (e.batchStartedAt) {
        const t = new Date(e.batchStartedAt)
        if (Number.isFinite(t.getTime()) && (!startedAt || t < new Date(startedAt))) {
          startedAt = e.batchStartedAt
        }
        // Primary = latest started batch (Time / Batch)
        if (!primary || t > new Date(primary.batchStartedAt || 0)) {
          primary = e
        }
      }
      if (e.batchOverAt) {
        const t = new Date(e.batchOverAt)
        if (Number.isFinite(t.getTime()) && (!completedAt || t > new Date(completedAt))) {
          completedAt = e.batchOverAt
        }
      }
      const st = entryStatus(e)
      if (st === 'Running') status = 'Running'
      else if (st === 'Completed' && status !== 'Running') status = 'Completed'
      else if (status === 'Idle' && st === 'Idle') status = 'Idle'
      if (!primary) primary = e
    })

    const times = rows
      .map((e) => opsTimeBatchMinutes(e))
      .filter((n) => n != null && Number.isFinite(n))
    // Avg. Time = finished batches only; a running batch would drag the average with its clock
    const finishedTimes = rows
      .map((e) => completedBatchMinutes(e))
      .filter((n) => n != null && Number.isFinite(n))
    const avgTimeMin = finishedTimes.length
      ? Math.round(finishedTimes.reduce((a, b) => a + b, 0) / finishedTimes.length)
      : null
    const primaryRaw = opsTimeBatchMinutes(primary)
    const primaryElapsed = primaryRaw != null
      ? Math.round(primaryRaw)
      : (times.length ? Math.round(times[times.length - 1]) : null)

    const metalInVal = hasIn ? metalIn : null
    const metalOutVal = hasOut ? metalOut : null
    const metalLossVal = hasLoss ? metalLossSum : null
    const metalBalance = metalInVal != null && metalOutVal != null
      ? Math.max(0, metalInVal - metalOutVal)
      : metalInVal
    const lossTotal = pooledStatsOf(rowsAll, metalLossOf)
    const timeTotal = pooledStatsOf(rowsAll, completedBatchMinutes)

    return {
      key: dept.key,
      name: dept.label,
      subtitle: dept.subtitle || '',
      status: hasData ? status : 'Idle',
      batchId: primary?._id || primary?.id || null,
      batchNumber: primary?.batchNumber || null,
      employeeName: primary?.employeeName || (employees[0]?.name || null),
      employeeCode: null,
      employeeCount: nameSet.size || null,
      employees,
      floorManager: manager,
      shiftName: null,
      startedAt,
      completedAt,
      currentBatchStartedAt: primary?.batchStartedAt || null,
      currentBatchOverAt: primary?.batchOverAt || null,
      elapsedMin: primaryElapsed,
      avgTimeMin,
      avgTimeFinishedOnly: true,
      metalIn: metalInVal,
      metalOut: metalOutVal,
      metalBalance,
      metalLoss: metalLossVal,
      lossRows,
      timeRows,
      lossTodayAvg: meanLoss(rows),
      lossTotalAvg: roundOrNull(lossTotal.mean, 2),
      timeTotalAvgMin: roundOrNull(timeTotal.mean),
      lossPct: metalInVal && metalLossVal != null && metalInVal > 0
        ? Math.round((metalLossVal / metalInVal) * 1000) / 10
        : null,
      confirmState: null,
      passId: null,
      passStatus: null,
      progress: { mode: 'determinate', percent: status === 'Completed' ? 100 : (status === 'Running' ? 50 : 0) },
      quantity: metalOutVal ?? metalInVal,
      timeTakenMin: primaryElapsed,
      hasData,
      isMelting: dept.key === 'melting',
      isAssembly: dept.key === 'assembly',
      tableCount: dept.tableCount || null,
      activeBatchCount: rows.length,
      flowStatus: status === 'Running' ? 'ACTIVE' : (status === 'Idle' ? 'STABLE' : String(status || 'STABLE').toUpperCase()),
      currentBatchCarriedOver: Boolean(primary?.carriedOver),
      longRunning: timeAverages ? longRunningOf(rows, timeAverages[dept.key]) : null,
    }
  })

  const batchMonitorRows = list.map((e) => {
    const inn = numOrNull(e.metalIn)
    const out = numOrNull(e.metalOut)
    const loss = metalLossOf(e)
    const status = entryStatus(e)
    const durationRaw = opsTimeBatchMinutes(e)
    return {
      id: e._id || e.id,
      batchNumber: e.batchNumber || '—',
      department: e.departmentKey,
      departmentKey: e.departmentKey,
      status,
      employee: e.employeeName || null,
      qtyIn: inn,
      qtyOut: out,
      metalLoss: loss,
      durationMin: durationRaw != null ? Math.round(durationRaw) : null,
      startedAt: e.batchStartedAt || null,
      completedAt: e.batchOverAt || null,
      carriedOver: Boolean(e.carriedOver),
    }
  })

  let totalIn = 0
  let totalOut = 0
  let totalLoss = 0
  let hasAny = false
  todayList.forEach((e) => {
    const inn = numOrNull(e.metalIn)
    const out = numOrNull(e.metalOut)
    const loss = metalLossOf(e)
    if (inn != null) { totalIn += inn; hasAny = true }
    if (out != null) { totalOut += out; hasAny = true }
    if (loss != null) totalLoss += loss
  })

  const empSet = new Set()
  list.forEach((e) => {
    const n = String(e.employeeName || '').trim()
    if (n) empSet.add(n)
  })
  const managers = list.map((e) => String(e.departmentManagerName || '').trim()).filter(Boolean)
  const floorManager = managers[0] || null
  const running = list.filter((e) => entryStatus(e) === 'Running').length
  const completed = todayList.filter((e) => entryStatus(e) === 'Completed').length

  const yesterday = dayKey(addDays(new Date(), -1))
  let yesterdayOutput = null
  allList.forEach((e) => {
    if (String(e?.date || '').trim() !== yesterday) return
    const out = numOrNull(e.metalOut)
    if (out != null) yesterdayOutput = (yesterdayOutput || 0) + out
  })

  return {
    hasOpsData: hasAny || list.length > 0,
    deptCards,
    batchMonitorRows,
    kpis: {
      totalProductionToday: hasAny ? (totalIn || totalOut) : null,
      underProduction: running > 0 ? totalIn - totalOut : null,
      totalOutput: hasAny ? totalOut : null,
      employees: empSet.size || null,
      floorManager,
      activeBatches: running,
      totalBatches: todayList.length || null,
      completedBatches: completed,
      metalIn: hasAny ? totalIn : null,
      metalOut: hasAny ? totalOut : null,
      metalLoss: hasAny ? totalLoss : null,
      yesterdayOutput,
      yesterdayVsToday: hasAny ? percentChange(totalOut, yesterdayOutput) : null,
    },
  }
}

/**
 * Merge the Operations → Production workbook overlay onto an existing dashboard model.
 * Replaces idle/empty dept cards and KPI totals when ops entries exist for today.
 * `keepModelWhenEmpty` (MG): with no workbook rows today the model is returned unchanged.
 */
export function applyLoopcOpsEntriesToModel(
  model,
  entries,
  entriesAll = null,
  { keepModelWhenEmpty = false, carryOverOpen = false, timeAverages = null } = {},
) {
  if (!model) return model
  const overlay = buildLoopcOpsDashboardOverlay(entries, entriesAll, { carryOverOpen, timeAverages })
  if (!overlay.hasOpsData) {
    if (keepModelWhenEmpty) return model
    return {
      ...model,
      deptCards: overlay.deptCards,
      liveDeptCards: overlay.deptCards,
      batchMonitorRows: [],
      hasLiveProduction: false,
      sourceOfTruth: 'operations-entries',
    }
  }

  const k = overlay.kpis
  return {
    ...model,
    hasLiveProduction: true,
    sourceOfTruth: 'operations-entries',
    deptCards: overlay.deptCards,
    liveDeptCards: overlay.deptCards,
    batchMonitorRows: overlay.batchMonitorRows,
    header: {
      ...(model.header || {}),
      status: k.activeBatches > 0
        ? 'Factory Online — Operations ledger active'
        : 'Operations ledger — today',
      floorManager: k.floorManager ?? model.header?.floorManager ?? null,
      employeeCount: k.employees ?? model.header?.employeeCount ?? null,
      activeBatches: k.activeBatches,
      totalBatches: k.totalBatches,
    },
    compactKpis: {
      ...(model.compactKpis || {}),
      employees: k.employees,
      floorManager: k.floorManager,
      totalProductionToday: k.totalProductionToday,
      underProduction: k.underProduction,
      totalOutput: k.totalOutput,
      yesterdayOutput: k.yesterdayOutput,
      yesterdayVsToday: k.yesterdayVsToday,
    },
    underProductionKpi: {
      ...(model.underProductionKpi || {}),
      activeBatches: k.activeBatches,
    },
    employeeKpi: {
      ...(model.employeeKpi || {}),
      total: k.employees,
      active: k.employees,
      floorManager: k.floorManager,
    },
    productionTodayKpi: {
      ...(model.productionTodayKpi || {}),
      processedQty: k.metalIn,
      productionWeight: k.metalOut,
      completedBatches: k.completedBatches,
      totalBatches: k.totalBatches,
    },
    outputKpi: {
      ...(model.outputKpi || {}),
      inputWeight: k.metalIn,
      outputWeight: k.metalOut,
      outputQuantity: k.metalOut,
    },
    statusSummary: {
      running: k.activeBatches,
      idle: Math.max(0, (overlay.deptCards || []).filter((c) => c.status === 'Idle').length),
      completed: k.completedBatches,
    },
  }
}

