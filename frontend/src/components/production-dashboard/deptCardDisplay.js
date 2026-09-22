/**
 * Live-only department card display mapping.
 * Subtitles are static labels from departmentConfig; all metrics come from the live model.
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

function avgTimeFromRatings(employeeRatings, employees) {
  const times = (employees || [])
    .map((e) => {
      const hit = (employeeRatings || []).find((r) => normName(r.name) === normName(e.name))
      return hit?.avgTimeMin
    })
    .filter(hasNum)
    .map(Number)
  return mean(times)
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

  const timePerBatchMin = hasNum(card.elapsedMin) || hasNum(card.timeTakenMin)
    ? Number(card.elapsedMin ?? card.timeTakenMin)
    : (hasNum(batches[0]?.durationMin) ? Number(batches[0].durationMin) : null)

  const avgFromBatches = mean(batches.map((b) => Number(b.durationMin)).filter(Number.isFinite))
  const avgFromCard = hasNum(card.avgTimeMin) ? Number(card.avgTimeMin) : null
  const avgTimeMin = avgFromBatches ?? avgFromCard ?? (hasNum(card.elapsedMin) ? Number(card.elapsedMin) : null)

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

  const lossAvg = mean(lossRows.map((r) => r.loss))

  let employees = Array.isArray(card.employees) && card.employees.length
    ? card.employees.map((e) => ({
        name: e.name,
        rating: hasNum(e.rating) ? Number(e.rating) : ratingForName(employeeRatings, e.name),
      }))
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
    employees = Array.from(nameSet.values()).slice(0, 3).map((name) => ({
      name,
      rating: ratingForName(employeeRatings, name),
    }))
  }

  return {
    key,
    name: card.name || key,
    subtitle: card.subtitle || subtitleFor(key),
    status: card.status || 'Idle',
    employees,
    employeeCount: employees.length,
    batches: batchCount != null ? batchCount : '—',
    timePerBatchLabel: fmtMin(timePerBatchMin),
    avgTimeLabel: fmtMin(avgTimeMin ?? avgTimeFromRatings(employeeRatings, employees)),
    metalIn,
    metalOut,
    lossRows,
    lossAvg,
    isAssembly: Boolean(card.isAssembly),
    tableCount: card.tableCount || null,
  }
}
