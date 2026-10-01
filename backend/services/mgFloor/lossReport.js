const OperationsProductionEntry = require('../../models/OperationsProductionEntry')
const FloorBatchEntry = require('../../models/FloorBatchEntry')
const ProductionAlert = require('../../models/ProductionAlert')
const { ProductionError } = require('../productionControl/errors')
const { FLOOR_DEPARTMENTS, normalizeFloorDepartment } = require('../../constants/mgFloorBatchEntry')
const { getLossLimits } = require('./batchStats')

const TIME_ZONE = 'Asia/Dubai'
const BREAKDOWN_CODE = 'MACHINE_BREAKDOWN'
const MAX_DAYS = { day: 93, month: 731 }

const round = (value, places) => {
  const f = 10 ** places
  return Math.round(value * f) / f
}
const pct = (part, whole) => (whole > 0 ? round((part / whole) * 100, 2) : null)

const dayKeyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
const dayKey = (date) => dayKeyFormat.format(date)
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)

function shiftDay(day, days) {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const emptyTotals = () => ({
  batches: 0,
  metalIn: 0,
  metalOut: 0,
  loss: 0,
  overLimitBatches: 0,
  fineBatches: 0,
  fineIn: 0,
  fineOut: 0,
  breakdowns: 0,
  breakdownsNotFixed: 0,
  downtimeMinutes: 0,
})

function addTotals(into, from) {
  for (const key of Object.keys(into)) into[key] += from[key] || 0
  return into
}

function finishTotals(t, limit) {
  const lossPct = pct(t.loss, t.metalIn)
  return {
    batches: t.batches,
    metalIn: round(t.metalIn, 3),
    metalOut: round(t.metalOut, 3),
    loss: round(t.loss, 3),
    lossPct,
    overLimit: limit != null && lossPct != null && lossPct > limit,
    overLimitBatches: t.overLimitBatches,
    fineBatches: t.fineBatches,
    fineIn: t.fineBatches ? round(t.fineIn, 3) : null,
    fineOut: t.fineBatches ? round(t.fineOut, 3) : null,
    fineLoss: t.fineBatches ? round(t.fineIn - t.fineOut, 3) : null,
    breakdowns: t.breakdowns,
    breakdownsNotFixed: t.breakdownsNotFixed,
    downtimeMinutes: Math.round(t.downtimeMinutes),
  }
}

function requireRange({ from, to, groupBy }) {
  const days = daysBetween(from, to)
  if (!Number.isFinite(days) || days < 0) throw new ProductionError('"From" must be on or before "To"', 400)
  if (days >= MAX_DAYS[groupBy]) {
    throw new ProductionError(groupBy === 'day' ? 'Pick at most 3 months by day — use "By month" for longer' : 'Pick at most 2 years', 400)
  }
}

/** Who sent the approved Metal Out; manual workbook rows (no floor entry) fall back to their Employee. */
const OPERATOR_EXPR = {
  $let: {
    vars: { out: { $trim: { input: { $ifNull: [{ $arrayElemAt: ['$outEntry.employeeName', 0] }, ''] } } } },
    in: { $cond: [{ $ne: ['$$out', ''] }, '$$out', { $trim: { input: { $ifNull: ['$employeeName', ''] } } }] },
  },
}

/** Finished workbook batches grouped per day and department (and Metal Out operator when byOperator). */
function batchPipeline({ departments, from, to, limitExpr, byOperator }) {
  return [
    { $match: { departmentKey: { $in: departments }, date: { $gte: from, $lte: to }, metalIn: { $gt: 0 }, metalOut: { $gte: 0 } } },
    ...(byOperator
      ? [{ $lookup: { from: FloorBatchEntry.collection.collectionName, localField: 'floorOutEntryId', foreignField: 'entryId', as: 'outEntry' } }]
      : []),
    {
      $project: {
        departmentKey: 1,
        date: 1,
        metalIn: 1,
        metalOut: 1,
        fineGold: 1,
        fineGoldOut: 1,
        limit: limitExpr,
        loss: { $ifNull: ['$metalLoss', { $max: [0, { $subtract: ['$metalIn', '$metalOut'] }] }] },
        ...(byOperator ? { operator: OPERATOR_EXPR } : {}),
      },
    },
    {
      $addFields: {
        hasFine: { $and: [{ $gte: ['$fineGold', 0] }, { $gte: ['$fineGoldOut', 0] }] },
        over: {
          $and: [
            { $ne: ['$limit', null] },
            { $gt: [{ $round: [{ $multiply: [{ $divide: ['$loss', '$metalIn'] }, 100] }, 2] }, '$limit'] },
          ],
        },
      },
    },
    {
      $group: {
        _id: { date: '$date', department: '$departmentKey', ...(byOperator ? { operator: '$operator' } : {}) },
        batches: { $sum: 1 },
        metalIn: { $sum: '$metalIn' },
        metalOut: { $sum: '$metalOut' },
        loss: { $sum: '$loss' },
        overLimitBatches: { $sum: { $cond: ['$over', 1, 0] } },
        fineBatches: { $sum: { $cond: ['$hasFine', 1, 0] } },
        fineIn: { $sum: { $cond: ['$hasFine', '$fineGold', 0] } },
        fineOut: { $sum: { $cond: ['$hasFine', '$fineGoldOut', 0] } },
      },
    },
  ]
}

/**
 * Loss per Metal Out operator: rows per period × operator × department (so each batch keeps its
 * department's limit) and a per-operator summary, most loss first. Breakdowns belong to machines,
 * not operators, so they are left out.
 */
function operatorReport({ batchGroups, departments, limits, periodOf }) {
  const cells = new Map()
  const people = new Map()
  for (const g of batchGroups) {
    const period = periodOf(g._id.date)
    const { department, operator } = g._id
    const key = `${period}|${operator}|${department}`
    if (!cells.has(key)) cells.set(key, { period, operator, department, totals: emptyTotals() })
    addTotals(cells.get(key).totals, g)
    if (!people.has(operator)) people.set(operator, { totals: emptyTotals(), departments: new Set() })
    addTotals(people.get(operator).totals, g)
    people.get(operator).departments.add(department)
  }

  const byName = (a, b) => (!a && b ? 1 : !b && a ? -1 : a.localeCompare(b))
  const all = emptyTotals()
  const rows = [...cells.values()]
    .sort((a, b) => a.period.localeCompare(b.period) || byName(a.operator, b.operator)
      || departments.indexOf(a.department) - departments.indexOf(b.department))
    .map(({ period, operator, department, totals }) => {
      addTotals(all, totals)
      return { period, operator, department, ...finishTotals(totals, limits[department] ?? null) }
    })
  const byOperator = [...people.entries()]
    .map(([operator, p]) => ({
      operator,
      departments: departments.filter((d) => p.departments.has(d)),
      ...finishTotals(p.totals, null),
    }))
    .sort((a, b) => b.loss - a.loss || byName(a.operator, b.operator))
  return { rows, byOperator, total: finishTotals(all, null) }
}

/**
 * Metal loss per floor department per day or month, from the Operations → Production workbook
 * (finished batches: Metal In and Metal Out both filled), plus tablet breakdowns and their downtime
 * (reported → fixed). Only breakdowns reported since "Fixed" exists count as not fixed. Over-limit
 * uses each department's current loss limit. view "operator" groups by who sent Metal Out instead.
 */
async function getLossReport({ from, to, groupBy = 'day', department: rawDepartment, view = 'department' } = {}) {
  requireRange({ from, to, groupBy })
  const department = rawDepartment ? normalizeFloorDepartment(rawDepartment) : ''
  if (rawDepartment && !department) throw new ProductionError('A valid floor department is required', 400)
  const departments = department ? [department] : FLOOR_DEPARTMENTS
  const periodOf = (day) => (groupBy === 'month' ? day.slice(0, 7) : day)

  const limits = await getLossLimits()
  const limitBranches = Object.entries(limits)
    .filter(([key]) => departments.includes(key))
    .map(([key, limit]) => ({ case: { $eq: ['$departmentKey', key] }, then: limit }))
  const limitExpr = limitBranches.length ? { $switch: { branches: limitBranches, default: null } } : { $literal: null }
  const head = {
    from,
    to,
    groupBy,
    view,
    timeZone: TIME_ZONE,
    limits: Object.fromEntries(departments.map((d) => [d, limits[d] ?? null])),
  }

  if (view === 'operator') {
    const batchGroups = await OperationsProductionEntry.aggregate(batchPipeline({ departments, from, to, limitExpr, byOperator: true }))
    return { ...head, ...operatorReport({ batchGroups, departments, limits, periodOf }) }
  }

  const [batchGroups, alerts] = await Promise.all([
    OperationsProductionEntry.aggregate(batchPipeline({ departments, from, to, limitExpr, byOperator: false })),
    ProductionAlert.find({
      code: BREAKDOWN_CODE,
      'metadata.department': { $in: departments },
      createdAt: { $gte: new Date(`${shiftDay(from, -1)}T00:00:00Z`), $lt: new Date(`${shiftDay(to, 2)}T00:00:00Z`) },
    })
      .select('metadata.department metadata.trackFix status createdAt resolvedAt')
      .lean(),
  ])

  const cells = new Map()
  const cellFor = (period, dept) => {
    const key = `${period}|${dept}`
    if (!cells.has(key)) cells.set(key, { period, department: dept, totals: emptyTotals() })
    return cells.get(key).totals
  }

  for (const g of batchGroups) {
    const t = cellFor(periodOf(g._id.date), g._id.department)
    addTotals(t, { ...g, breakdowns: 0, breakdownsNotFixed: 0, downtimeMinutes: 0 })
  }
  for (const a of alerts) {
    const day = dayKey(a.createdAt)
    if (day < from || day > to) continue
    const t = cellFor(periodOf(day), a.metadata.department)
    t.breakdowns += 1
    if (a.status === 'RESOLVED' && a.resolvedAt) t.downtimeMinutes += Math.max(0, (a.resolvedAt - a.createdAt) / 60000)
    else if (a.metadata.trackFix) t.breakdownsNotFixed += 1
  }

  const byDept = new Map(departments.map((d) => [d, emptyTotals()]))
  const all = emptyTotals()
  const rows = [...cells.values()]
    .sort((a, b) => a.period.localeCompare(b.period) || departments.indexOf(a.department) - departments.indexOf(b.department))
    .map(({ period, department: dept, totals }) => {
      addTotals(byDept.get(dept), totals)
      addTotals(all, totals)
      return { period, department: dept, ...finishTotals(totals, limits[dept] ?? null) }
    })

  return {
    ...head,
    rows,
    byDepartment: departments
      .map((d) => ({ department: d, ...finishTotals(byDept.get(d), limits[d] ?? null) }))
      .filter((d) => d.batches || d.breakdowns),
    total: finishTotals(all, null),
  }
}

module.exports = { getLossReport, MAX_DAYS }
