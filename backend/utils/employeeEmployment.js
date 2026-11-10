/**
 * Employment eligibility by calendar date (joiningDate + soft-delete deletedAt).
 */

/**
 * Timezone-safe YYYY-MM-DD: prefer ISO date prefix; else UTC calendar parts.
 */
function toEmploymentDateKey(value) {
  if (value === null || value === undefined || value === '') return null
  const raw = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getUTCFullYear()
  const m = `${d.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${d.getUTCDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Employed on YYYY-MM-DD when:
 * - parseable joiningDate exists AND joinKey <= date
 * - AND not (isDeleted and deletedAt date <= date)
 *
 * Missing / unparseable joiningDate → not eligible for as-of / Attendance Log.
 */
function isEmployedOnDate(employee, dateKey) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false
  const joinKey = toEmploymentDateKey(employee?.joiningDate)
  if (!joinKey || joinKey > dateKey) return false
  if (employee?.isDeleted === true) {
    const endKey = toEmploymentDateKey(employee?.deletedAt)
    if (endKey && endKey <= dateKey) return false
    // Deleted without deletedAt → treat as not employed historically
    if (!endKey) return false
  }
  return true
}

/**
 * Mongo filter for employees employed on asOf (YYYY-MM-DD).
 * Requires a real joiningDate; includes archived rows whose deletedAt is after asOf.
 */
function buildEmployedAsOfFilter(asOfDateKey) {
  if (!asOfDateKey || !/^\d{4}-\d{2}-\d{2}$/.test(asOfDateKey)) return null

  const asOfEnd = new Date(`${asOfDateKey}T23:59:59.999Z`)
  const asOfStartNext = new Date(`${asOfDateKey}T00:00:00.000Z`)
  asOfStartNext.setUTCDate(asOfStartNext.getUTCDate() + 1)

  return {
    $and: [
      {
        joiningDate: { $ne: null, $exists: true, $lte: asOfEnd },
      },
      {
        $or: [
          { isDeleted: { $ne: true } },
          { isDeleted: true, deletedAt: { $gte: asOfStartNext } },
        ],
      },
    ],
  }
}

function parseAsOfQuery(value) {
  const raw = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  return raw
}

module.exports = {
  toEmploymentDateKey,
  isEmployedOnDate,
  buildEmployedAsOfFilter,
  parseAsOfQuery,
}
