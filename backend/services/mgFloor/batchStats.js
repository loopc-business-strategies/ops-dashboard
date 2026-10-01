const OperationsProductionEntry = require('../../models/OperationsProductionEntry')
const MgFloorSetting = require('../../models/MgFloorSetting')
const { ProductionError } = require('../productionControl/errors')
const { writeProductionAudit } = require('../productionControl/audit')
const { FLOOR_DEPARTMENTS, normalizeFloorDepartment } = require('../../constants/mgFloorBatchEntry')

/** Longer "batches" are forgotten Metal Outs, not real batch times. */
const MAX_BATCH_MINUTES = 48 * 60
const MAX_LOSS_LIMIT_PCT = 100
const RECENT_LOSS_DAYS = 30

const round = (value, places) => {
  const f = 10 ** places
  return Math.round(value * f) / f
}

function requireDepartment(value) {
  const department = normalizeFloorDepartment(value)
  if (!department) {
    const err = new ProductionError('A valid floor department is required', 400)
    err.code = 'INVALID_DEPARTMENT'
    throw err
  }
  return department
}

function previousDay(date) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

const lossPct = (loss, metalIn) => (metalIn > 0 ? round((loss / metalIn) * 100, 2) : null)

const lossRef = (row) => row && {
  batchNumber: row.batchNumber,
  date: row.date,
  loss: round(row.loss, 3),
  lossPct: lossPct(row.loss, row.metalIn),
}

const timeRef = (row) => row && {
  batchNumber: row.batchNumber,
  date: row.date,
  minutes: Math.round(row.minutes),
}

const hasTime = (row) => row.minutes != null && row.minutes > 0 && row.minutes <= MAX_BATCH_MINUTES

/**
 * Metal loss and batch time for one department, from the Operations → Production workbook, which
 * holds only Floor Manager approved batches. Loss = Metal In − Metal Out (weight, alloy included);
 * batch time = earliest Metal In time → latest Metal Out time. "Overall" is all time.
 */
async function getBatchStats({ department: rawDepartment, date }) {
  const department = requireDepartment(rawDepartment)
  const yesterday = previousDay(date)
  const finished = { loss: { $ne: null } }
  const timed = { minutes: { $gt: 0, $lte: MAX_BATCH_MINUTES } }

  const [facets] = await OperationsProductionEntry.aggregate([
    { $match: { departmentKey: department } },
    {
      $project: {
        batchNumber: 1,
        date: 1,
        metalIn: 1,
        batchStartedAt: 1,
        batchOverAt: 1,
        updatedAt: 1,
        loss: {
          $cond: [
            { $and: [{ $gt: ['$metalIn', 0] }, { $gte: ['$metalOut', 0] }] },
            { $ifNull: ['$metalLoss', { $max: [0, { $subtract: ['$metalIn', '$metalOut'] }] }] },
            null,
          ],
        },
        minutes: {
          $cond: [
            { $and: [{ $eq: [{ $type: '$batchStartedAt' }, 'date'] }, { $eq: [{ $type: '$batchOverAt' }, 'date'] }] },
            { $divide: [{ $subtract: ['$batchOverAt', '$batchStartedAt'] }, 60000] },
            null,
          ],
        },
      },
    },
    {
      $facet: {
        lossAll: [
          { $match: finished },
          { $group: { _id: null, batches: { $sum: 1 }, loss: { $sum: '$loss' }, metalIn: { $sum: '$metalIn' } } },
        ],
        lossBest: [
          { $match: finished },
          { $addFields: { pct: { $divide: ['$loss', '$metalIn'] } } },
          { $sort: { pct: 1, date: -1 } },
          { $limit: 1 },
        ],
        lossLast: [{ $match: finished }, { $sort: { batchOverAt: -1, updatedAt: -1 } }, { $limit: 1 }],
        timeAll: [{ $match: timed }, { $group: { _id: null, batches: { $sum: 1 }, minutes: { $avg: '$minutes' } } }],
        timeBest: [{ $match: timed }, { $sort: { minutes: 1, date: -1 } }, { $limit: 1 }],
        timeLast: [{ $match: timed }, { $sort: { batchOverAt: -1, updatedAt: -1 } }, { $limit: 1 }],
        running: [
          { $match: { date: { $in: [date, yesterday] }, batchStartedAt: { $ne: null }, batchOverAt: null } },
          { $sort: { batchStartedAt: -1 } },
          { $limit: 1 },
        ],
        today: [{ $match: { date } }],
      },
    },
  ])

  const todayLoss = facets.today.filter((r) => r.loss != null)
  const todayTimed = facets.today.filter(hasTime)
  const todayLossSum = todayLoss.reduce((s, r) => s + r.loss, 0)
  const todayInSum = todayLoss.reduce((s, r) => s + r.metalIn, 0)
  const bestLossToday = [...todayLoss].sort((a, b) => a.loss / a.metalIn - b.loss / b.metalIn)[0]
  const bestTimeToday = [...todayTimed].sort((a, b) => a.minutes - b.minutes)[0]
  const lossAll = facets.lossAll[0]
  const timeAll = facets.timeAll[0]
  const running = facets.running[0]
  const setting = await MgFloorSetting.findOne({ department }).lean()

  return {
    department,
    date,
    lossLimitPct: setting?.lossLimitPct ?? null,
    lossLimitSetBy: setting?.updatedByName || '',
    loss: {
      last: lossRef(facets.lossLast[0]) || null,
      todayTotal: todayLoss.length
        ? { loss: round(todayLossSum, 3), lossPct: lossPct(todayLossSum, todayInSum), batches: todayLoss.length }
        : null,
      todayAvg: todayLoss.length
        ? { loss: round(todayLossSum / todayLoss.length, 3), lossPct: lossPct(todayLossSum, todayInSum), batches: todayLoss.length }
        : null,
      overallAvg: lossAll
        ? { loss: round(lossAll.loss / lossAll.batches, 3), lossPct: lossPct(lossAll.loss, lossAll.metalIn), batches: lossAll.batches }
        : null,
      bestToday: lossRef(bestLossToday) || null,
      bestEver: lossRef(facets.lossBest[0]) || null,
    },
    time: {
      running: running ? { batchNumber: running.batchNumber, date: running.date, startedAt: running.batchStartedAt } : null,
      last: timeRef(facets.timeLast[0]) || null,
      todayAvg: todayTimed.length
        ? { minutes: Math.round(todayTimed.reduce((s, r) => s + r.minutes, 0) / todayTimed.length), batches: todayTimed.length }
        : null,
      overallAvg: timeAll ? { minutes: Math.round(timeAll.minutes), batches: timeAll.batches } : null,
      bestToday: timeRef(bestTimeToday) || null,
      bestEver: timeRef(facets.timeBest[0]) || null,
    },
  }
}

/** Floor / Production Managers set (or clear with null) the loss warning limit for a department. */
async function setLossLimit(req, { department: rawDepartment, lossLimitPct }) {
  const department = requireDepartment(rawDepartment)
  const limit = lossLimitPct == null ? null : round(Number(lossLimitPct), 2)
  if (limit != null && (!Number.isFinite(limit) || limit <= 0 || limit > MAX_LOSS_LIMIT_PCT)) {
    throw new ProductionError(`Loss limit must be between 0 and ${MAX_LOSS_LIMIT_PCT}%`, 400)
  }
  const before = await MgFloorSetting.findOne({ department }).lean()
  const setting = await MgFloorSetting.findOneAndUpdate(
    { department },
    { $set: { lossLimitPct: limit, updatedById: req.user?._id || null, updatedByName: req.user?.name || '' } },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  ).lean()
  await writeProductionAudit(req, {
    resource: 'MgFloorSetting',
    resourceId: setting._id,
    action: 'mg_floor_loss_limit_set',
    detail: limit == null ? `Metal loss limit removed for ${department}` : `Metal loss limit for ${department} set to ${limit}%`,
    changes: { department, from: before?.lossLimitPct ?? null, to: limit },
  }).catch((err) => console.warn('[mg-floor] loss limit audit failed', err?.message || err))
  return { department, lossLimitPct: setting.lossLimitPct, lossLimitSetBy: setting.updatedByName }
}

/** All-time average finished batch minutes per department (same rule as "Overall avg"), e.g. { melting: 143 }. */
async function getTimeAverages() {
  const rows = await OperationsProductionEntry.aggregate([
    { $match: { departmentKey: { $ne: null }, batchStartedAt: { $type: 'date' }, batchOverAt: { $type: 'date' } } },
    { $project: { departmentKey: 1, minutes: { $divide: [{ $subtract: ['$batchOverAt', '$batchStartedAt'] }, 60000] } } },
    { $match: { minutes: { $gt: 0, $lte: MAX_BATCH_MINUTES } } },
    { $group: { _id: '$departmentKey', minutes: { $avg: '$minutes' } } },
  ])
  return Object.fromEntries(rows.map((r) => [r._id, Math.round(r.minutes)]))
}

/** Every department's loss warning limit, e.g. { melting: 0.5 }; departments without a limit are left out. */
async function getLossLimits() {
  const settings = await MgFloorSetting.find({ lossLimitPct: { $ne: null } }).select('department lossLimitPct').lean()
  return Object.fromEntries(settings.map((s) => [s.department, s.lossLimitPct]))
}

/**
 * Every floor department with its loss limit, who set it, and its finished batches in the last
 * 30 days (average loss % and how many went over the current limit), for the web Loss limits page.
 */
async function listLossLimitSettings({ now = new Date() } = {}) {
  const since = new Date(now)
  since.setUTCDate(since.getUTCDate() - RECENT_LOSS_DAYS)
  const [settings, recent] = await Promise.all([
    MgFloorSetting.find({ department: { $in: FLOOR_DEPARTMENTS } }).lean(),
    OperationsProductionEntry.aggregate([
      {
        $match: {
          departmentKey: { $in: FLOOR_DEPARTMENTS },
          date: { $gte: since.toISOString().slice(0, 10) },
          metalIn: { $gt: 0 },
          metalOut: { $gte: 0 },
        },
      },
      {
        $project: {
          departmentKey: 1,
          metalIn: 1,
          loss: { $ifNull: ['$metalLoss', { $max: [0, { $subtract: ['$metalIn', '$metalOut'] }] }] },
        },
      },
    ]),
  ])
  const byDepartment = new Map(settings.map((s) => [s.department, s]))

  return FLOOR_DEPARTMENTS.map((department) => {
    const setting = byDepartment.get(department)
    const limit = setting?.lossLimitPct ?? null
    const rows = recent.filter((r) => r.departmentKey === department)
    const loss = rows.reduce((s, r) => s + r.loss, 0)
    const metalIn = rows.reduce((s, r) => s + r.metalIn, 0)
    return {
      department,
      lossLimitPct: limit,
      lossLimitSetBy: setting?.updatedByName || '',
      lossLimitSetAt: setting?.updatedAt || null,
      recent: {
        days: RECENT_LOSS_DAYS,
        batches: rows.length,
        avgLossPct: lossPct(loss, metalIn),
        overLimit: limit == null ? null : rows.filter((r) => lossPct(r.loss, r.metalIn) > limit).length,
      },
    }
  })
}

module.exports = { getBatchStats, getLossLimits, getTimeAverages, listLossLimitSettings, setLossLimit, MAX_BATCH_MINUTES }
