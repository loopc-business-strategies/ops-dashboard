const fs = require('fs')
const path = require('path')
const { registerAllOnConnection } = require('../db/tenantModelRegistry')

/**
 * Additive indexes for Production Control Center live-floor / list / report hot paths.
 * Idempotent syncIndexes — does not mutate or delete production documents.
 */
module.exports = {
  id: '008-production-live-floor-perf-indexes',
  async up({ tenant, connection }) {
    if (!connection) {
      throw new Error(`[${tenant}] connection required for syncIndexes`)
    }

    const modelsDir = path.join(__dirname, '..', 'models')
    for (const file of fs.readdirSync(modelsDir).filter((name) => name.endsWith('.js')).sort()) {
      require(path.join(modelsDir, file))
    }

    registerAllOnConnection(connection)

    const targetModels = [
      'ProductionBatch',
      'MetalMovement',
      'ProductionAlert',
      'ProcessRun',
      'ProductionMachine',
      'ProductionPass',
    ]

    let synced = 0
    for (const name of targetModels) {
      const model = connection.models[name]
      if (!model) {
        console.warn(`[${tenant}] model ${name} not registered — skip`)
        continue
      }
      await model.syncIndexes()
      synced += 1
    }

    console.log(`[${tenant}] production live-floor perf syncIndexes complete (${synced} models)`)
  },
}
