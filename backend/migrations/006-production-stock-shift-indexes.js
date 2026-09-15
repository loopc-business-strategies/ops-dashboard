const fs = require('fs')
const path = require('path')
const { registerAllOnConnection } = require('../db/tenantModelRegistry')

/**
 * Additive: sync indexes for new Production Control Center models/fields
 * (stock lots, stock status events, shifts, floor sessions, batch stockCode).
 * Idempotent — does not mutate or delete existing production documents.
 */
module.exports = {
  id: '006-production-stock-shift-indexes',
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
      'ProductionStockLot',
      'ProductionStockStatusEvent',
      'ProductionShiftConfig',
      'ProductionFloorSession',
      'ProductionBatch',
      'QcInspection',
      'ProductionFlowConfig',
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

    // Seed default Shift 1 (09:00–21:00) only when no shifts exist
    const Shift = connection.models.ProductionShiftConfig
    if (Shift) {
      const count = await Shift.countDocuments({})
      if (count === 0) {
        await Shift.create({
          name: 'Shift 1',
          startTime: '09:00',
          endTime: '21:00',
          breakMinutes: 0,
          isActive: true,
          workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
          sortOrder: 0,
        })
        console.log(`[${tenant}] seeded default Shift 1 09:00–21:00`)
      }
    }

    console.log(`[${tenant}] production stock/shift syncIndexes complete (${synced} models)`)
  },
}
