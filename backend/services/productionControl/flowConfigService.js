const ProductionFlowConfig = require('../../models/ProductionFlowConfig')
const { DEFAULT_FLOW_STAGES, DEFAULT_WEIGHT_TOLERANCE_PCT } = require('./constants')
const { withSession, writeOpts } = require('../../utils/mongoTransaction')

/** Idempotent: create default flow only when none exists. Never overwrites existing config. */
async function ensureDefaultFlowConfig(session = null) {
  const existing = await withSession(
    ProductionFlowConfig.findOne({ key: 'default' }),
    session,
  )
  if (existing) return existing

  const [created] = await ProductionFlowConfig.create(
    [
      {
        key: 'default',
        name: 'Default Production Flow',
        stages: DEFAULT_FLOW_STAGES.map((s) => ({ ...s })),
        weightTolerancePct: DEFAULT_WEIGHT_TOLERANCE_PCT,
        autoHoldOnVariance: true,
        isActive: true,
      },
    ],
    writeOpts(session),
  )
  return created
}

async function getActiveFlowConfig(session = null) {
  const cfg = await ensureDefaultFlowConfig(session)
  return cfg
}

module.exports = {
  ensureDefaultFlowConfig,
  getActiveFlowConfig,
}
