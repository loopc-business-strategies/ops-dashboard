/**
 * Helpers for optional MongoDB session propagation and transactional workflows.
 */

const mongoose = require('mongoose')
const { getActiveTenantConnection } = require('../db/tenantModelProxy')

function withSession(query, session) {
  return session ? query.session(session) : query
}

function writeOpts(session) {
  return session ? { session } : {}
}

function resolveConnection() {
  return getActiveTenantConnection() || mongoose.connection
}

/**
 * Run `fn(session)` inside a MongoDB transaction (auto-commit/abort via withTransaction).
 * Uses the active tenant connection when request-scoped tenant context is bound.
 * @template T
 * @param {(session: import('mongoose').ClientSession) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function runInTransaction(fn) {
  const connection = resolveConnection()
  const session = await connection.startSession()
  try {
    let result
    await session.withTransaction(async () => {
      result = await fn(session)
    })
    return result
  } finally {
    await session.endSession()
  }
}

module.exports = {
  withSession,
  writeOpts,
  runInTransaction,
  resolveConnection,
}
