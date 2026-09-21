/**
 * UI display merge: live model fields preferred, image demos fill gaps.
 * Does not change buildDashboardModel / APIs.
 */

import { matchDashboardDeptKey } from './departmentConfig'

const DEMO = {
  vault_room: {
    subtitle: 'Raw Metal Storage',
    employees: [
      { name: 'Mark', rating: 4.8 },
      { name: 'Jon', rating: 4.6 },
      { name: 'Maria', rating: 4.9 },
    ],
    batches: 2,
    timePerBatchMin: 5,
    avgTimeMin: 4.8,
    metalIn: 5000,
    metalOut: 2450,
    lossRows: [
      { label: 'Batch 1', loss: 0.11 },
      { label: 'Batch 2', loss: 0.39 },
    ],
    lossAvg: 0.25,
  },
  melting: {
    subtitle: 'Gold Melting & Refining',
    employees: [
      { name: 'Mark', rating: 4.7 },
      { name: 'Jon', rating: 4.5 },
      { name: 'Maria', rating: 4.8 },
    ],
    batches: 2,
    timePerBatchMin: 5,
    avgTimeMin: 4.8,
    metalIn: 2500,
    metalOut: 1600,
    lossRows: [
      { label: 'Batch 1', loss: 0.11 },
      { label: 'Batch 2', loss: 0.39 },
    ],
    lossAvg: 0.25,
  },
  rolling: {
    subtitle: 'Sheet & Wire Rolling',
    employees: [
      { name: 'Mark', rating: 4.6 },
      { name: 'Jon', rating: 4.4 },
      { name: 'Maria', rating: 4.7 },
    ],
    batches: 2,
    timePerBatchMin: 5,
    avgTimeMin: 4.6,
    metalIn: 1600,
    metalOut: 1520,
    lossRows: [
      { label: 'Batch 1', loss: 0.08 },
      { label: 'Batch 2', loss: 0.32 },
    ],
    lossAvg: 0.2,
  },
  bangle_area: {
    subtitle: 'Bangle Manufacturing',
    employees: [
      { name: 'Mark', rating: 4.8 },
      { name: 'Jon', rating: 4.6 },
      { name: 'Maria', rating: 4.7 },
    ],
    batches: 2,
    timePerBatchMin: 6,
    avgTimeMin: 5.2,
    metalIn: 1520,
    metalOut: 1480,
    lossRows: [
      { label: 'Batch 1', loss: 0.09 },
      { label: 'Batch 2', loss: 0.35 },
    ],
    lossAvg: 0.22,
  },
  stamping: {
    subtitle: 'Design Stamping',
    employees: [
      { name: 'Mark', rating: 4.5 },
      { name: 'Jon', rating: 4.3 },
      { name: 'Maria', rating: 4.6 },
    ],
    batches: 2,
    timePerBatchMin: 4,
    avgTimeMin: 4.8,
    metalIn: 1780,
    metalOut: 1720,
    lossRows: [
      { label: 'Batch 1', loss: 0.05 },
      { label: 'Batch 2', loss: 0.11 },
    ],
    lossAvg: 0.08,
  },
  pendent_section: {
    subtitle: 'Pendant Manufacturing',
    employees: [
      { name: 'Mark', rating: 4.6 },
      { name: 'Jon', rating: 4.5 },
      { name: 'Maria', rating: 4.7 },
    ],
    batches: 2,
    timePerBatchMin: 5,
    avgTimeMin: 4.5,
    metalIn: 1420,
    metalOut: 1380,
    lossRows: [
      { label: 'Batch 1', loss: 0.09 },
      { label: 'Batch 2', loss: 0.33 },
    ],
    lossAvg: 0.21,
  },
  welding_area: {
    subtitle: 'Jewelry Welding',
    employees: [
      { name: 'Mark', rating: 4.7 },
      { name: 'Jon', rating: 4.4 },
      { name: 'Maria', rating: 4.6 },
    ],
    batches: 2,
    timePerBatchMin: 6,
    avgTimeMin: 5.1,
    metalIn: 1380,
    metalOut: 1330,
    lossRows: [
      { label: 'Batch 1', loss: 0.07 },
      { label: 'Batch 2', loss: 0.31 },
    ],
    lossAvg: 0.19,
  },
  assembly: {
    subtitle: 'Final Assembly',
    employees: [
      { name: 'Mark', rating: 4.8 },
      { name: 'Jon', rating: 4.7 },
      { name: 'Maria', rating: 4.8 },
    ],
    batches: 2,
    timePerBatchMin: 5,
    avgTimeMin: 4.7,
    metalIn: 1330,
    metalOut: 1300,
    lossRows: [
      { label: 'Batch 1', loss: 0.06 },
      { label: 'Batch 2', loss: 0.24 },
    ],
    lossAvg: 0.15,
  },
}

function hasNum(v) {
  return v != null && Number.isFinite(Number(v))
}

function mean(nums) {
  const list = nums.filter((n) => Number.isFinite(n))
  if (!list.length) return null
  return list.reduce((a, b) => a + b, 0) / list.length
}

function fmtMin(v) {
  if (!hasNum(v)) return null
  const n = Number(v)
  if (Number.isInteger(n)) return `${n} min`
  return `${n.toFixed(1)} min`
}

function normName(v) {
  return String(v || '').trim().toLowerCase()
}

function rowsForDept(batchMonitorRows, card) {
  const key = String(card.key || '')
  return (batchMonitorRows || []).filter((row) => {
    const rowKey = matchDashboardDeptKey(row.department)
    if (rowKey && rowKey === key) return true
    return normName(row.department) === normName(card.name)
  })
}

function ratingForName(employeeRatings, name) {
  const hit = (employeeRatings || []).find((r) => normName(r.name) === normName(name))
  if (!hit) return null
  if (hasNum(hit.rating)) return Number(hit.rating)
  if (hasNum(hit.ratingLabel)) return Number(hit.ratingLabel)
  return null
}

export function resolveDeptCardDisplay(card = {}, batchMonitorRows = [], employeeRatings = []) {
  const key = String(card.key || '')
  const demo = DEMO[key] || DEMO.assembly
  const batches = rowsForDept(batchMonitorRows, card)

  const batchCount = (hasNum(card.activeBatchCount) && Number(card.activeBatchCount) > 0)
    ? Number(card.activeBatchCount)
    : (batches.length > 0 ? batches.length : demo.batches)

  const timePerBatchMin = hasNum(card.elapsedMin) || hasNum(card.timeTakenMin)
    ? Number(card.elapsedMin ?? card.timeTakenMin)
    : (hasNum(batches[0]?.durationMin) ? Number(batches[0].durationMin) : demo.timePerBatchMin)

  const avgFromBatches = mean(batches.map((b) => Number(b.durationMin)).filter(Number.isFinite))
  const avgTimeMin = avgFromBatches ?? (hasNum(card.elapsedMin) ? Number(card.elapsedMin) : demo.avgTimeMin)

  let metalIn = hasNum(card.metalIn) ? Number(card.metalIn) : null
  let metalOut = hasNum(card.metalOut) ? Number(card.metalOut) : null
  if (metalIn == null && batches.some((b) => hasNum(b.qtyIn))) {
    metalIn = batches.reduce((s, b) => s + (Number(b.qtyIn) || 0), 0)
  }
  if (metalOut == null && batches.some((b) => hasNum(b.qtyOut))) {
    metalOut = batches.reduce((s, b) => s + (Number(b.qtyOut) || 0), 0)
  }
  if (metalIn == null) metalIn = demo.metalIn
  if (metalOut == null) metalOut = demo.metalOut

  let lossRows = batches
    .map((b, i) => ({
      index: i + 1,
      label: `Batch ${i + 1}`,
      loss: hasNum(b.metalLoss) ? Number(b.metalLoss) : null,
    }))
    .filter((r) => r.loss != null)

  if (!lossRows.length && hasNum(card.metalLoss)) {
    lossRows = [{ index: 1, label: 'Batch 1', loss: Number(card.metalLoss) }]
  }
  if (!lossRows.length) {
    lossRows = demo.lossRows.map((r, i) => ({ index: i + 1, label: r.label, loss: r.loss }))
  }

  const lossAvg = mean(lossRows.map((r) => r.loss)) ?? demo.lossAvg

  const nameSet = new Map()
  batches.forEach((b) => {
    if (b.employee && !nameSet.has(normName(b.employee))) nameSet.set(normName(b.employee), b.employee)
  })
  if (card.employeeName && !nameSet.has(normName(card.employeeName))) {
    nameSet.set(normName(card.employeeName), card.employeeName)
  }

  let employees = Array.from(nameSet.values()).map((name) => ({
    name,
    rating: ratingForName(employeeRatings, name),
  }))

  if (!employees.length) {
    employees = demo.employees.map((e) => ({ ...e }))
  } else {
    employees = employees.map((e, i) => ({
      ...e,
      rating: e.rating != null ? e.rating : (demo.employees[i]?.rating ?? null),
    }))
    while (employees.length < 3 && demo.employees[employees.length]) {
      const d = demo.employees[employees.length]
      if (!nameSet.has(normName(d.name))) {
        employees.push({ ...d })
        nameSet.set(normName(d.name), d.name)
      } else break
    }
  }

  return {
    key,
    name: card.name || key,
    subtitle: demo.subtitle,
    status: card.status || 'Idle',
    employees,
    employeeCount: employees.length,
    batches: batchCount,
    timePerBatchLabel: fmtMin(timePerBatchMin) || '—',
    avgTimeLabel: fmtMin(avgTimeMin) || '—',
    metalIn,
    metalOut,
    lossRows,
    lossAvg,
    isAssembly: Boolean(card.isAssembly),
    tableCount: card.tableCount || null,
  }
}
