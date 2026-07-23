const fs = require('fs')
const path = require('path')
const { registerAllOnConnection } = require('../db/tenantModelRegistry')

/**
 * Ensure Mongoose indexes exist on hardened deploys where autoIndex is false.
 * Idempotent — safe to re-run. Unique index conflicts require data cleanup first.
 */
module.exports = {
  id: '004-sync-mongoose-indexes',
  async up({ tenant, connection }) {
    if (!connection) {
      throw new Error(`[${tenant}] connection required for syncIndexes`)
    }

    const modelsDir = path.join(__dirname, '..', 'models')
    for (const file of fs.readdirSync(modelsDir).filter((name) => name.endsWith('.js')).sort()) {
      require(path.join(modelsDir, file))
    }

    registerAllOnConnection(connection)

    const modelNames = Object.keys(connection.models).sort()
    let synced = 0
    for (const name of modelNames) {
      await connection.models[name].syncIndexes()
      synced += 1
    }

    console.log(`[${tenant}] syncIndexes complete for ${synced} models`)
  },
}
