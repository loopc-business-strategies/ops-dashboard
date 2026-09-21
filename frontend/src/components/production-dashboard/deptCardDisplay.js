/**
 * UI-only display adapter for Department Status cards.
 * Joins existing model fields — no demo numbers, no buildDashboardModel changes.
 */

import { matchDashboardDeptKey } from './departmentConfig'

const SUBTITLE_BY_DEPT = {
  vault_room: 'Raw Metal Storage',
  melting: 'Gold Melting & Refining',
  rolling: 'Sheet & Wire Rolling',
  bangle_area: 'Bangle Manufacturing',
  stamping: 'Design Stamping',
  pendent_section: 'Pendant Manufacturing',
  welding_area: 'Jewelry Welding',
  assembly: 'Final Assembly',
}

const LOSS_PREVIEW_COUNT = 3

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
    if (normName(row.department) === normName(card.name)) return true
    return false
  })
}

function ratingForName(employeeRatings, name) {
  if (!name) return null
  const hit = (employeeRatings || []).find((r) => normName(r.name) === normName(name))
  if (!hit) return null
  if (hasNum(hit.rating)) return Number(hit.rating)
  if (hasNum(hit.ratingLabel)) return Number(hit.ratingLabel)
  return null
}

/**
 * @param {object} card dept card from buildDashboardModel
 * @param {object[]} batchMonitorRows
 * @param {object[]} employeeRatings
 */
export function resolveDeptCardDisplay(card = {}, batchMonitorRows = [], employeeRatings = []) {
  const key = String(card.key || '')
  const batches = rowsForDept(batchMonitorRows, card)

  const batchCount = hasNum(card.activeBatchCount)
    ? Number(card.activeBatchCount)
    : batches.length

  const timePerBatchMin = hasNum(card.elapsedMin) || hasNum(card.timeTakenMin)
    ? Number(card.elapsedMin ?? card.timeTakenMin)
    : (hasNum(batches[0]?.durationMin) ? Number(batches[0].durationMin) : null)

  const avgTimeMin = mean(batches.map((b) => Number(b.durationMin)).filter(Number.isFinite))
    ?? timePerBatchMin

  let metalIn = hasNum(card.metalIn) ? Number(card.metalIn) : null
  let metalOut = hasNum(card.metalOut) ? Number(card.metalOut) : null
  if (metalIn == null && batches.length) {
    const sum = batches.reduce((s, b) => s + (Number(b.qtyIn) || 0), 0)
    metalIn = sum > 0 || batches.some((b) => hasNum(b.qtyIn)) ? sum : null
  }
  if (metalOut == null && batches.length) {
    const sum = batches.reduce((s, b) => s + (Number(b.qtyOut) || 0), 0)
    metalOut = sum > 0 || batches.some((b) => hasNum(b.qtyOut)) ? sum : null
  }

  const lossRows = batches
    .map((b, i) => ({
      index: i + 1,
      batchNumber: b.batchNumber || null,
      label: `Batch ${i + 1}`,
      loss: hasNum(b.metalLoss) ? Number(b.metalLoss) : null,
    }))
    .filter((r) => r.loss != null)

  // If monitor rows lack loss but card has primary loss, show as Batch 1
  if (!lossRows.length && hasNum(card.metalLoss)) {
    lossRows.push({
      index: 1,
      batchNumber: card.batchNumber || null,
      label: 'Batch 1',
      loss: Number(card.metalLoss),
    })
  }

  const lossAvg = mean(lossRows.map((r) => r.loss))
    ?? (hasNum(card.metalLoss) ? Number(card.metalLoss) : null)

  const nameSet = new Map()
  batches.forEach((b) => {
    const n = b.employee
    if (n && !nameSet.has(normName(n))) nameSet.set(normName(n), n)
  })
  if (card.employeeName && !nameSet.has(normName(card.employeeName))) {
    nameSet.set(normName(card.employeeName), card.employeeName)
  }

  const employees = Array.from(nameSet.values()).map((name) => ({
    name,
    rating: ratingForName(employeeRatings, name),
  }))

  return {
    key,
    name: card.name || key,
    subtitle: SUBTITLE_BY_DEPT[key] || '',
    status: card.status || 'Idle',
    employees,
    employeeCount: employees.length || (hasNum(card.employeeCount) ? Number(card.employeeCount) : 0),
    batches: batchCount,
    timePerBatchLabel: fmtMin(timePerBatchMin),
    avgTimeLabel: fmtMin(avgTimeMin),
    metalIn,
    metalOut,
    lossRows,
    lossAvg,
    lossPreviewCount: LOSS_PREVIEW_COUNT,
    isAssembly: Boolean(card.isAssembly),
    tableCount: card.tableCount || null,
  }
}
