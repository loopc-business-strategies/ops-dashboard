/**
 * Department card display mapping.
 * Live metrics win; when a card has no live signal, reference-style demo values fill the UI
 * (unless options.suppressDemo — used for LoopC so demo placeholders are never injected).
 */

import { DASHBOARD_DEPARTMENTS, matchDashboardDeptKey } from './departmentConfig'
import { formatMinutes as formatOpsMinutes } from '../tabs/operations/production/productionSheetUtils'

function hasNum(v) {
  return v != null && Number.isFinite(Number(v))
}

function mean(nums) {
  const list = (nums || []).filter((n) => Number.isFinite(n))
  if (!list.length) return null
  return list.reduce((a, b) => a + b, 0) / list.length
}

function fmtMin(v) {
  if (!hasNum(v)) return '—'
  const n = Number(v)
  if (Number.isInteger(n)) return `${n} min`
  return `${n.toFixed(1)} min`
}

function normName(v) {
  return String(v || '').trim().toLowerCase()
}

function subtitleFor(key) {
  const dept = DASHBOARD_DEPARTMENTS.find((d) => d.key === key)
  return dept?.subtitle || ''
}

function rowsForDept(batchMonitorRows, card) {
  const key = String(card.key || '')
  const matched = (batchMonitorRows || []).filter((row) => {
    const rowKey = matchDashboardDeptKey(row.departmentKey || row.department)
    if (rowKey && rowKey === key) return true
    return normName(row.department) === normName(card.name)
      || normName(row.departmentKey) === normName(key)
  })
  return matched.sort((a, b) => {
    const ta = a.startedAt ? new Date(a.startedAt).getTime() : 0
    const tb = b.startedAt ? new Date(b.startedAt).getTime() : 0
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
  })
}

function formatBatchClock(value, { hour24 = false } = {}) {
  if (!value) return null
  try {
    const d = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(d.getTime())) return null
    if (hour24) {
      const hh = String(d.getHours()).padStart(2, '0')
      const mi = String(d.getMinutes()).padStart(2, '0')
      return `${hh}:${mi}`
    }
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
  } catch {
    return null
  }
}

function progressPct(progress) {
  if (progress == null) return null
  if (typeof progress === 'number') {
    return Math.max(0, Math.min(100, Math.round(progress)))
  }
  const n = Number(progress?.percent ?? progress?.pct ?? progress?.value)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(100, Math.round(n)))
}

const DEMO_PROGRESS = {
  batchStartedLabel: '09:00 AM',
  batchOverLabel: '12:30 PM',
  progressPercent: 65,
}

const DEMO_MANAGER_BY_DEPT = {
  vault_room: 'Mr. Rajesh',
  melting: 'Mr. Rajesh',
  rolling: 'Mr. Suresh',
  bangle_area: 'Mr. Rajesh',
  stamping: 'Mr. Suresh',
  pendent_section: 'Mr. Rajesh',
  welding_area: 'Mr. Suresh',
  assembly: 'Mr. Nikhil',
}

/** Reference-style demo when a department has no live production signal. */
const DEMO_BY_DEPT = {
  vault_room: {
    status: 'Idle',
    employeeCount: 3,
    managerName: 'Mr. Rajesh',
    batches: 2,
    timePerBatchLabel: '5 min',
    avgTimeLabel: '4.8 min',
    metalIn: 5000,
    metalOut: 2450,
    lossRows: [
      { index: 1, label: 'Batch 1', loss: 0.11 },
      { index: 2, label: 'Batch 2', loss: 0.39 },
    ],
    lossAvg: 0.25,
    ...DEMO_PROGRESS,
  },
  melting: {
    status: 'Running',
    employeeCount: 3,
    managerName: 'Mr. Rajesh',
    batches: 2,
    timePerBatchLabel: '5 min',
    avgTimeLabel: '4.8 min',
    metalIn: 2500,
    metalOut: 1600,
    lossRows: [
      { index: 1, label: 'Batch 1', loss: 0.11 },
      { index: 2, label: 'Batch 2', loss: 0.39 },
    ],
    lossAvg: 0.25,
    ...DEMO_PROGRESS,
  },
  rolling: {
    status: 'Running',
    employeeCount: 3,
    managerName: 'Mr. Suresh',
    batches: 2,
    timePerBatchLabel: '5 min',
    avgTimeLabel: '4.8 min',
    metalIn: 1800,
    metalOut: 1200,
    lossRows: [
      { index: 1, label: 'Batch 1', loss: 0.12 },
      { index: 2, label: 'Batch 2', loss: 0.28 },
    ],
    lossAvg: 0.2,
    ...DEMO_PROGRESS,
  },
  bangle_area: {
    status: 'Running',
    employeeCount: 3,
    managerName: 'Mr. Rajesh',
    batches: 3,
    timePerBatchLabel: '6 min',
    avgTimeLabel: '5.2 min',
    metalIn: 980,
    metalOut: 720,
    lossRows: [
      { index: 1, label: 'Batch 1', loss: 0.15 },
      { index: 2, label: 'Batch 2', loss: 0.22 },
    ],
    lossAvg: 0.18,
    ...DEMO_PROGRESS,
  },
  stamping: {
    status: 'Running',
    employeeCount: 3,
    managerName: 'Mr. Suresh',
    batches: 2,
    timePerBatchLabel: '4 min',
    avgTimeLabel: '4.2 min',
    metalIn: 640,
    metalOut: 510,
    lossRows: [
      { index: 1, label: 'Batch 1', loss: 0.09 },
      { index: 2, label: 'Batch 2', loss: 0.18 },
    ],
    lossAvg: 0.14,
    ...DEMO_PROGRESS,
  },
  pendent_section: {
    status: 'Idle',
    employeeCount: 3,
    managerName: 'Mr. Rajesh',
    batches: 1,
    timePerBatchLabel: '7 min',
    avgTimeLabel: '6.5 min',
    metalIn: 420,
    metalOut: 310,
    lossRows: [
      { index: 1, label: 'Batch 1', loss: 0.2 },
      { index: 2, label: 'Batch 2', loss: 0.31 },
    ],
    lossAvg: 0.26,
    ...DEMO_PROGRESS,
  },
  welding_area: {
    status: 'Running',
    employeeCount: 3,
    managerName: 'Mr. Suresh',
    batches: 2,
    timePerBatchLabel: '5 min',
    avgTimeLabel: '4.9 min',
    metalIn: 560,
    metalOut: 430,
    lossRows: [
      { index: 1, label: 'Batch 1', loss: 0.1 },
      { index: 2, label: 'Batch 2', loss: 0.24 },
    ],
    lossAvg: 0.17,
    ...DEMO_PROGRESS,
  },
  assembly: {
    status: 'Idle',
    employeeCount: 3,
    managerName: 'Mr. Nikhil',
    batches: 2,
    timePerBatchLabel: '5 min',
    avgTimeLabel: '4.7 min',
    metalIn: 390,
    metalOut: 360,
    lossRows: [
      { index: 1, label: 'Batch 1', loss: 0.08 },
      { index: 2, label: 'Batch 2', loss: 0.12 },
    ],
    lossAvg: 0.1,
    ...DEMO_PROGRESS,
  },
}

function hasLiveSignal({ employeeCount, batchCount, metalIn, metalOut, lossRows }) {
  return (
    (hasNum(employeeCount) && Number(employeeCount) > 0)
    || batchCount != null
    || hasNum(metalIn)
    || hasNum(metalOut)
    || (lossRows && lossRows.length > 0)
  )
}

function resolveBatchProgress(card, batches, { hour24 = false } = {}) {
  const primary = batches[0] || null
  const startedRaw = primary?.startedAt || card.startedAt || card.processStartTime || null
  const endedRaw = primary?.completedAt || primary?.processEndTime || card.completedAt || card.processEndTime || null
  const targetMin = Number(
    primary?.expectedDurationMinutes
    ?? primary?.targetDurationMinutes
    ?? card.expectedDurationMinutes
    ?? card.targetDurationMinutes
    ?? card.avgTimeMin
    ?? 0,
  )

  let batchOverRaw = endedRaw
  if (!batchOverRaw && startedRaw && Number.isFinite(targetMin) && targetMin > 0) {
    const startMs = new Date(startedRaw).getTime()
    if (Number.isFinite(startMs)) {
      batchOverRaw = new Date(startMs + targetMin * 60 * 1000)
    }
  }

  let percent = progressPct(primary?.progress) ?? progressPct(card.progress)
  if (percent == null && startedRaw && Number.isFinite(targetMin) && targetMin > 0) {
    const startMs = new Date(startedRaw).getTime()
    if (Number.isFinite(startMs)) {
      const elapsedMin = (Date.now() - startMs) / 60000
      percent = Math.max(0, Math.min(99, Math.round((elapsedMin / targetMin) * 100)))
    }
  }

  return {
    batchStartedLabel: formatBatchClock(startedRaw, { hour24 }),
    batchOverLabel: formatBatchClock(batchOverRaw, { hour24 }),
    progressPercent: percent,
  }
}

export function resolveDeptCardDisplay(card = {}, batchMonitorRows = [], employeeRatings = [], options = {}) {
  const suppressDemo = Boolean(options.suppressDemo)
  const key = String(card.key || '')
  const batches = rowsForDept(batchMonitorRows, card)

  const batchCount = (() => {
    if (batches.length > 0) return batches.length
    if (hasNum(card.activeBatchCount) && Number(card.activeBatchCount) > 0) {
      return Number(card.activeBatchCount)
    }
    return null
  })()

  const durations = batches.map((b) => Number(b.durationMin)).filter(Number.isFinite)
  const timePerBatchMin = hasNum(card.elapsedMin) || hasNum(card.timeTakenMin)
    ? Number(card.elapsedMin ?? card.timeTakenMin)
    : (hasNum(batches[0]?.durationMin) ? Number(batches[0].durationMin) : null)

  const avgFromBatches = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null
  const avgFromCard = hasNum(card.avgTimeMin) ? Number(card.avgTimeMin) : null
  // LoopC: prefer card.avgTimeMin (sum of Ops Time/Batch ÷ n). Never use primary alone when n > 1.
  let avgTimeMin
  if (suppressDemo) {
    avgTimeMin = avgFromCard
      ?? avgFromBatches
      ?? (durations.length <= 1 && hasNum(card.elapsedMin) ? Number(card.elapsedMin) : null)
  } else {
    avgTimeMin = avgFromBatches
      ?? avgFromCard
      ?? (durations.length <= 1 && hasNum(card.elapsedMin) ? Number(card.elapsedMin) : null)
  }

  let metalIn = hasNum(card.metalIn) ? Number(card.metalIn) : null
  let metalOut = hasNum(card.metalOut) ? Number(card.metalOut) : null
  if (metalIn == null && batches.some((b) => hasNum(b.qtyIn))) {
    metalIn = batches.reduce((s, b) => s + (Number(b.qtyIn) || 0), 0)
  }
  if (metalOut == null && batches.some((b) => hasNum(b.qtyOut))) {
    metalOut = batches.reduce((s, b) => s + (Number(b.qtyOut) || 0), 0)
  }

  let lossRows = Array.isArray(card.lossRows) && card.lossRows.length
    ? card.lossRows.map((r, i) => ({
        index: r.index ?? i + 1,
        label: r.label || `Batch ${i + 1}`,
        loss: hasNum(r.loss) ? Number(r.loss) : null,
      })).filter((r) => r.loss != null)
    : batches
      .map((b, i) => ({
        index: i + 1,
        label: `Batch ${i + 1}`,
        loss: hasNum(b.metalLoss) ? Number(b.metalLoss) : null,
      }))
      .filter((r) => r.loss != null)

  if (!lossRows.length && hasNum(card.metalLoss)) {
    lossRows = [{ index: 1, label: 'Batch 1', loss: Number(card.metalLoss) }]
  }

  let lossAvg = mean(lossRows.map((r) => r.loss))
  const lossTodayAvg = hasNum(card.lossTodayAvg) ? Number(card.lossTodayAvg) : (suppressDemo ? lossAvg : null)
  const lossTotalAvg = hasNum(card.lossTotalAvg) ? Number(card.lossTotalAvg) : null

  let employeeCount = hasNum(card.employeeCount)
    ? Number(card.employeeCount)
    : (Array.isArray(card.employees) && card.employees.length ? card.employees.length : null)

  if (employeeCount == null) {
    const nameSet = new Set()
    batches.forEach((b) => {
      if (b.employee) nameSet.add(normName(b.employee))
    })
    if (card.employeeName) nameSet.add(normName(card.employeeName))
    ;(employeeRatings || []).forEach((r) => {
      const rowKey = matchDashboardDeptKey(r.department)
      if (rowKey === key && r.name) nameSet.add(normName(r.name))
    })
    if (nameSet.size) employeeCount = nameSet.size
  }

  let managerName = card.floorManager || null
  let status = card.status || 'Idle'
  let batchesDisplay = batchCount != null ? batchCount : '—'
  // LoopC: match Ops sheet Time/Batch style (e.g. 6h, 5h 20m)
  let timePerBatchLabel = suppressDemo ? formatOpsMinutes(timePerBatchMin) : fmtMin(timePerBatchMin)
  let avgTimeLabel = suppressDemo ? formatOpsMinutes(avgTimeMin) : fmtMin(avgTimeMin)
  const timeRows = suppressDemo && Array.isArray(card.timeRows) && card.timeRows.length
    ? card.timeRows
      .map((r, i) => ({
        index: r.index ?? i + 1,
        label: r.label || `Batch ${i + 1}`,
        minutes: hasNum(r.minutes) ? Number(r.minutes) : null,
        timeLabel: hasNum(r.minutes) ? formatOpsMinutes(Number(r.minutes)) : null,
      }))
      .filter((r) => r.timeLabel && r.timeLabel !== '—')
    : []
  let { batchStartedLabel, batchOverLabel, progressPercent } = resolveBatchProgress(card, batches, {
    hour24: suppressDemo,
  })

  const live = hasLiveSignal({ employeeCount, batchCount, metalIn, metalOut, lossRows })
  const demo = DEMO_BY_DEPT[key]

  if (!suppressDemo) {
    if (!live && demo) {
      status = demo.status
      employeeCount = demo.employeeCount
      managerName = demo.managerName
      batchesDisplay = demo.batches
      timePerBatchLabel = demo.timePerBatchLabel
      avgTimeLabel = demo.avgTimeLabel
      metalIn = demo.metalIn
      metalOut = demo.metalOut
      lossRows = demo.lossRows
      lossAvg = demo.lossAvg
      batchStartedLabel = demo.batchStartedLabel
      batchOverLabel = demo.batchOverLabel
      progressPercent = demo.progressPercent
    } else {
      if (!managerName) managerName = DEMO_MANAGER_BY_DEPT[key] || 'Mr. Rajesh'
      if (!hasNum(employeeCount)) employeeCount = 3
      if (timePerBatchLabel === '—') timePerBatchLabel = demo?.timePerBatchLabel || '5 min'
      if (avgTimeLabel === '—') avgTimeLabel = demo?.avgTimeLabel || '4.8 min'
      if (!batchStartedLabel) batchStartedLabel = DEMO_PROGRESS.batchStartedLabel
      if (!batchOverLabel) batchOverLabel = DEMO_PROGRESS.batchOverLabel
      if (progressPercent == null) progressPercent = DEMO_PROGRESS.progressPercent
    }
  }

  return {
    key,
    name: card.name || key,
    subtitle: card.subtitle || subtitleFor(key),
    status,
    employeeCount: hasNum(employeeCount) ? Number(employeeCount) : (suppressDemo ? null : 0),
    managerName: managerName || '—',
    batches: batchesDisplay,
    timePerBatchLabel,
    avgTimeLabel,
    timeRows,
    metalIn,
    metalOut,
    lossRows,
    lossAvg,
    lossTodayAvg: suppressDemo ? lossTodayAvg : null,
    lossTotalAvg: suppressDemo ? lossTotalAvg : null,
    batchStartedLabel: suppressDemo
      ? (batchStartedLabel || '—')
      : (batchStartedLabel || DEMO_PROGRESS.batchStartedLabel),
    batchOverLabel: suppressDemo
      ? (batchOverLabel || '—')
      : (batchOverLabel || DEMO_PROGRESS.batchOverLabel),
    progressPercent: suppressDemo
      ? (progressPercent ?? null)
      : (progressPercent ?? DEMO_PROGRESS.progressPercent),
    isAssembly: Boolean(card.isAssembly),
    tableCount: card.tableCount || null,
  }
}
