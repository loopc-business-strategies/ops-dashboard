const fs = require('fs')
const path = require('path')
const { registerAllOnConnection } = require('../db/tenantModelRegistry')

/**
 * Additive: sync indexes for PCC hardening fields
 * (pass batchId+status, QC reworkOf, alert acknowledge fields, issueIdempotencyKey).
 * Idempotent — does not mutate or delete existing production documents.
 */
module.exports = {
  id: '007-production-hardening-indexes',
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
      'ProductionPass',
      'ProductionBatch',
      'QcInspection',
      'ProductionAlert',
      'ProcessRun',
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

    console.log(`[${tenant}] production hardening syncIndexes complete (${synced} models)`)
  },
}
