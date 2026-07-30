/**
 * Build Mongo date clauses from list year/month filters.
 * year: "2026"
 * months: "7,8" or [7, 8]
 */

function normalizeYear(value) {
  const year = String(value || '').trim()
  return /^\d{4}$/.test(year) ? Number(year) : null
}

function normalizeMonths(value) {
  const raw = Array.isArray(value)
    ? value
    : String(value || '').split(',')
  const unique = new Set()
  raw.forEach((entry) => {
    const month = Number(entry)
    if (Number.isInteger(month) && month >= 1 && month <= 12) unique.add(month)
  })
  return Array.from(unique).sort((a, b) => a - b)
}

function monthUtcRange(year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
  return { start, end }
}

/**
 * @returns {null | { date?: object } | { $or: object[] } | { $expr: object }}
 */
function buildYearMonthsDateFilter(yearValue, monthsValue) {
  const year = normalizeYear(yearValue)
  const months = normalizeMonths(monthsValue)
  if (!year && !months.length) return null

  if (year && (!months.length || months.length === 12)) {
    return {
      date: {
        $gte: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
        $lte: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
      },
    }
  }

  if (year && months.length) {
    return {
      $or: months.map((month) => {
        const { start, end } = monthUtcRange(year, month)
        return { date: { $gte: start, $lte: end } }
      }),
    }
  }

  // Months without year: match those calendar months in any year.
  return {
    $expr: {
      $in: [{ $month: '$date' }, months],
    },
  }
}

/**
 * Merge a year/months clause into an existing Mongo query object (mutates query).
 */
function applyYearMonthsDateFilter(query, yearValue, monthsValue) {
  const clause = buildYearMonthsDateFilter(yearValue, monthsValue)
  if (!clause) return query

  if (clause.date) {
    query.$and = [...(query.$and || []), { date: clause.date }]
    return query
  }
  if (clause.$or) {
    query.$and = [...(query.$and || []), { $or: clause.$or }]
    return query
  }
  if (clause.$expr) {
    query.$and = [...(query.$and || []), { $expr: clause.$expr }]
  }
  return query
}

module.exports = {
  normalizeYear,
  normalizeMonths,
  buildYearMonthsDateFilter,
  applyYearMonthsDateFilter,
}
