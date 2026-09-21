/**
 * Display-only demo fields for Department Status cards.
 * Merges with live card data when present — does not change buildDashboardModel.
 */

const DEMO_BY_DEPT = {
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
    lossBatch1: 0.11,
    lossBatch2: 0.39,
    lossAvg: 0.25,
  },
  melting: {
    subtitle: 'Gold Melting & Refining',
    employees: [
      { name: 'Ravi', rating: 4.7 },
      { name: 'Anita', rating: 4.5 },
      { name: 'Kiran', rating: 4.8 },
    ],
    batches: 3,
    timePerBatchMin: 12,
    avgTimeMin: 11.2,
    metalIn: 2500,
    metalOut: 1600,
    lossBatch1: 0.42,
    lossBatch2: 0.38,
    lossAvg: 0.4,
  },
  rolling: {
    subtitle: 'Sheet & Wire Rolling',
    employees: [
      { name: 'Sam', rating: 4.4 },
      { name: 'Leah', rating: 4.9 },
      { name: 'Omar', rating: 4.6 },
    ],
    batches: 2,
    timePerBatchMin: 8,
    avgTimeMin: 7.5,
    metalIn: 2800,
    metalOut: 2710,
    lossBatch1: 0.22,
    lossBatch2: 0.31,
    lossAvg: 0.27,
  },
  bangle_area: {
    subtitle: 'Bangle Manufacturing',
    employees: [
      { name: 'Priya', rating: 4.9 },
      { name: 'Dev', rating: 4.3 },
      { name: 'Nina', rating: 4.7 },
    ],
    batches: 4,
    timePerBatchMin: 6,
    avgTimeMin: 5.6,
    metalIn: 2100,
    metalOut: 1985,
    lossBatch1: 0.18,
    lossBatch2: 0.29,
    lossAvg: 0.24,
  },
  stamping: {
    subtitle: 'Design Stamping',
    employees: [
      { name: 'Alex', rating: 4.5 },
      { name: 'Sofia', rating: 4.8 },
      { name: 'Ben', rating: 4.2 },
    ],
    batches: 2,
    timePerBatchMin: 7,
    avgTimeMin: 6.4,
    metalIn: 1650,
    metalOut: 1590,
    lossBatch1: 0.15,
    lossBatch2: 0.21,
    lossAvg: 0.18,
  },
  pendent_section: {
    subtitle: 'Pendant Manufacturing',
    employees: [
      { name: 'Tara', rating: 4.8 },
      { name: 'Luis', rating: 4.6 },
      { name: 'Eva', rating: 4.9 },
    ],
    batches: 3,
    timePerBatchMin: 9,
    avgTimeMin: 8.7,
    metalIn: 1420,
    metalOut: 1368,
    lossBatch1: 0.19,
    lossBatch2: 0.27,
    lossAvg: 0.23,
  },
  welding_area: {
    subtitle: 'Jewelry Welding',
    employees: [
      { name: 'Chris', rating: 4.7 },
      { name: 'Maya', rating: 4.4 },
      { name: 'Ibrahim', rating: 4.8 },
    ],
    batches: 2,
    timePerBatchMin: 10,
    avgTimeMin: 9.3,
    metalIn: 1180,
    metalOut: 1125,
    lossBatch1: 0.28,
    lossBatch2: 0.33,
    lossAvg: 0.31,
  },
  assembly: {
    subtitle: 'Final Assembly',
    employees: [
      { name: 'Helen', rating: 4.9 },
      { name: 'Jake', rating: 4.5 },
      { name: 'Noor', rating: 4.7 },
    ],
    batches: 5,
    timePerBatchMin: 4,
    avgTimeMin: 3.9,
    metalIn: 980,
    metalOut: 955,
    lossBatch1: 0.09,
    lossBatch2: 0.14,
    lossAvg: 0.12,
  },
}

function hasNum(v) {
  return v != null && Number.isFinite(Number(v))
}

function fmtMin(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  if (Number.isInteger(n)) return `${n} min`
  return `${n.toFixed(1)} min`
}

/**
 * @param {object} card live dept card from buildDashboardModel
 * @returns display model for the reference Department Status UI
 */
export function resolveDeptCardUi(card = {}) {
  const key = String(card.key || '')
  const demo = DEMO_BY_DEPT[key] || DEMO_BY_DEPT.assembly

  const metalIn = hasNum(card.metalIn) ? Number(card.metalIn) : demo.metalIn
  const metalOut = hasNum(card.metalOut) ? Number(card.metalOut) : demo.metalOut
  const batches = hasNum(card.activeBatchCount) && Number(card.activeBatchCount) > 0
    ? Number(card.activeBatchCount)
    : (card.batchNumber ? 1 : demo.batches)
  const timePerBatchMin = hasNum(card.elapsedMin) || hasNum(card.timeTakenMin)
    ? Number(card.elapsedMin ?? card.timeTakenMin)
    : demo.timePerBatchMin
  const avgTimeMin = hasNum(card.avgTimeMin) ? Number(card.avgTimeMin) : demo.avgTimeMin

  let lossBatch1 = demo.lossBatch1
  let lossBatch2 = demo.lossBatch2
  let lossAvg = demo.lossAvg
  if (hasNum(card.metalLoss)) {
    const loss = Math.max(0, Number(card.metalLoss))
    lossAvg = Number(loss.toFixed(2))
    lossBatch1 = Number((loss * 0.45).toFixed(2))
    lossBatch2 = Number((loss * 0.55).toFixed(2))
  }

  const employees = Array.isArray(card.employees) && card.employees.length
    ? card.employees.map((e) => ({
      name: e.name || e.employeeName || '—',
      rating: hasNum(e.rating) ? Number(e.rating) : null,
    }))
    : (card.employeeName
      ? [
        { name: card.employeeName, rating: demo.employees[0]?.rating ?? 4.5 },
        ...demo.employees.slice(1),
      ]
      : demo.employees)

  return {
    key,
    name: card.name || key,
    subtitle: demo.subtitle,
    status: card.status || 'Idle',
    employees,
    employeeCount: employees.length,
    batches,
    timePerBatchLabel: fmtMin(timePerBatchMin),
    avgTimeLabel: fmtMin(avgTimeMin),
    metalIn,
    metalOut,
    lossBatch1,
    lossBatch2,
    lossAvg,
    isAssembly: Boolean(card.isAssembly),
    tableCount: card.tableCount || null,
  }
}
