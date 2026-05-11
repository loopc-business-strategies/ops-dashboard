/**
 * Cursor-based pagination utility for MongoDB queries
 * Supports forward/backward pagination without offset
 */

/**
 * Parse pagination params from query
 * @param {Object} query - Express query object
 * @returns {Object} { limit, cursor, sortOrder }
 */
function parsePaginationParams(query) {
  const parsedLimit = parseInt(query.limit, 10)
  const limit = isNaN(parsedLimit) ? 50 : Math.min(Math.max(parsedLimit, 1), 100) // 1-100 default 50
  const cursor = query.cursor || null
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1

  return { limit, cursor, sortOrder }
}

/**
 * Apply cursor-based pagination to Mongoose query
 * @param {Object} query - Mongoose query object
 * @param {String} sortField - Field to sort by (default: '_id')
 * @param {Object} paginationParams - { limit, cursor, sortOrder }
 * @returns {Object} Mongoose query with skip/limit applied
 */
function applyCursorPagination(query, sortField = '_id', paginationParams) {
  const { limit, cursor, sortOrder } = paginationParams

  // Sort by specified field
  query.sort({ [sortField]: sortOrder })

  // If cursor exists, filter to documents after/before cursor
  if (cursor) {
    const operator = sortOrder === 1 ? '$gt' : '$lt'
    const filterObj = {}
    filterObj[sortField] = { [operator]: cursor }
    query.find(filterObj)
  }

  // Fetch limit + 1 to detect if more results exist
  query.limit(limit + 1)

  return query
}

/**
 * Format pagination response with next cursor
 * @param {Array} documents - Query results
 * @param {Object} paginationParams - { limit, cursor, sortOrder }
 * @param {String} sortField - Field used for sorting
 * @returns {Object} { data, hasMore, nextCursor }
 */
function formatPaginationResponse(documents, paginationParams, sortField = '_id') {
  const { limit } = paginationParams
  const hasMore = documents.length > limit
  const data = hasMore ? documents.slice(0, limit) : documents
  const nextCursor = hasMore ? data[data.length - 1][sortField] : null

  return {
    data,
    hasMore,
    nextCursor,
    count: data.length,
  }
}

/**
 * Combined utility: parse, apply, format pagination in one call
 * @param {Object} mongooseQuery - Mongoose query
 * @param {String} sortField - Field to sort by
 * @param {Object} expressQuery - Express query object
 * @returns {Promise<Object>} { data, hasMore, nextCursor, count }
 */
async function paginateQuery(mongooseQuery, sortField = '_id', expressQuery = {}) {
  const params = parsePaginationParams(expressQuery)
  applyCursorPagination(mongooseQuery, sortField, params)
  const results = await mongooseQuery.exec()
  return formatPaginationResponse(results, params, sortField)
}

module.exports = {
  parsePaginationParams,
  applyCursorPagination,
  formatPaginationResponse,
  paginateQuery,
}
