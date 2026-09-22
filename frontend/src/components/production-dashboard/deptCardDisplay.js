/**
 * Department card display mapping.
 * Live metrics win; when a card has no live signal, reference-style demo values fill the UI.
 */

import { DASHBOARD_DEPARTMENTS, matchDashboardDeptKey } from './departmentConfig'

function hasNum(v) {
  return v != null && Number.isFinite(Number(v))
}

function mean(nums) {
  const list = (nums || []).filter((n) => Number.isFinite(n))
  if (!list.length) return null
  return list.reduce((a, b) => a + b, 0) / list.length
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
  return (batchMonitorRows || []).filter((row) => {
    const rowKey = matchDashboardDeptKey(row.department)
    if (rowKey && rowKey === key) return true
    return normName(row.department) === normName(card.name)
  })
}

function formatBatchClock(value) {
  if (!value) return null
  try {
    const d = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(d.getTime())) return null
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

/** Reference-style demo when a department has no live production signal. */
const DEMO_BY_DEPT = {
  vault_room: {
    status: 'Idle',
    employees: [{ name: 'Mark' }, { name: 'Jon' }, { name: 'Maria' }],
    batches: 2,
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
    employees: [{ name: 'Mark' }, { name: 'Jon' }, { name: 'Maria' }],
    batches: 2,
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
    employees: [{ name: 'Mark' }, { name: 'Jon' }, { name: 'Maria' }],
    batches: 2,
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
    employees: [{ name: 'Mark' }, { name: 'Jon' }, { name: 'Maria' }],
    batches: 3,
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
    employees: [{ name: 'Mark' }, { name: 'Jon' }, { name: 'Maria' }],
    batches: 2,
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
    employees: [{ name: 'Mark' }, { name: 'Jon' }, { name: 'Maria' }],
    batches: 1,
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
    employees: [{ name: 'Mark' }, { name: 'Jon' }, { name: 'Maria' }],
    batches: 2,
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
    employees: [{ name: 'Mark' }, { name: 'Jon' }, { name: 'Maria' }],
    batches: 2,
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

function hasLiveSignal({ employees, batchCount, metalIn, metalOut, lossRows }) {
  return (
    (employees && employees.length > 0)
    || batchCount != null
    || hasNum(metalIn)
    || hasNum(metalOut)
    || (lossRows && lossRows.length > 0)
  )
}

function resolveBatchProgress(card, batches) {
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
    batchStartedLabel: formatBatchClock(startedRaw),
    batchOverLabel: formatBatchClock(batchOverRaw),
    progressPercent: percent,
  }
}

export function resolveDeptCardDisplay(card = {}, batchMonitorRows = [], employeeRatings = []) {
  const key = String(card.key || '')
  const batches = rowsForDept(batchMonitorRows, card)

  const batchCount = (() => {
    if (batches.length > 0) return batches.length
    if (hasNum(card.activeBatchCount) && Number(card.activeBatchCount) > 0) {
      return Number(card.activeBatchCount)
    }
    return null
  })()

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

  let employees = Array.isArray(card.employees) && card.employees.length
    ? card.employees.map((e) => ({ name: e.name }))
    : []

  if (!employees.length) {
    const nameSet = new Map()
    batches.forEach((b) => {
      if (b.employee && !nameSet.has(normName(b.employee))) {
        nameSet.set(normName(b.employee), b.employee)
      }
    })
    if (card.employeeName && !nameSet.has(normName(card.employeeName))) {
      nameSet.set(normName(card.employeeName), card.employeeName)
    }
    ;(employeeRatings || []).forEach((r) => {
      if (nameSet.size >= 3) return
      const rowKey = matchDashboardDeptKey(r.department)
      if (rowKey === key && r.name && !nameSet.has(normName(r.name))) {
        nameSet.set(normName(r.name), r.name)
      }
    })
    employees = Array.from(nameSet.values()).slice(0, 3).map((name) => ({ name }))
  }

  let status = card.status || 'Idle'
  let batchesDisplay = batchCount != null ? batchCount : '—'
  let { batchStartedLabel, batchOverLabel, progressPercent } = resolveBatchProgress(card, batches)

  const live = hasLiveSignal({ employees, batchCount, metalIn, metalOut, lossRows })
  const demo = DEMO_BY_DEPT[key]
  if (!live && demo) {
    status = demo.status
    employees = demo.employees
    batchesDisplay = demo.batches
    metalIn = demo.metalIn
    metalOut = demo.metalOut
    lossRows = demo.lossRows
    lossAvg = demo.lossAvg
    batchStartedLabel = demo.batchStartedLabel
    batchOverLabel = demo.batchOverLabel
    progressPercent = demo.progressPercent
  } else if (live) {
    if (!batchStartedLabel) batchStartedLabel = DEMO_PROGRESS.batchStartedLabel
    if (!batchOverLabel) batchOverLabel = DEMO_PROGRESS.batchOverLabel
    if (progressPercent == null) progressPercent = DEMO_PROGRESS.progressPercent
  }

  return {
    key,
    name: card.name || key,
    subtitle: card.subtitle || subtitleFor(key),
    status,
    employees,
    employeeCount: employees.length,
    batches: batchesDisplay,
    metalIn,
    metalOut,
    lossRows,
    lossAvg,
    batchStartedLabel: batchStartedLabel || DEMO_PROGRESS.batchStartedLabel,
    batchOverLabel: batchOverLabel || DEMO_PROGRESS.batchOverLabel,
    progressPercent: progressPercent ?? DEMO_PROGRESS.progressPercent,
    isAssembly: Boolean(card.isAssembly),
    tableCount: card.tableCount || null,
  }
}
