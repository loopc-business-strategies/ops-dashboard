const fs = require('fs')
const path = require('path')
const { ScaleManager } = require('./scales/ScaleManager')
const { startLocalApi } = require('./api/localServer')
const { postScaleReading } = require('./api/backendClient')
const { createLogger } = require('./utils/logger')

const log = createLogger('main')

function loadConfig() {
  const configPath = process.env.MG_GATEWAY_CONFIG
    || path.join(__dirname, '..', 'config', 'default.json')
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  return {
    ...raw,
    mode: process.env.MG_GATEWAY_MODE || raw.mode || 'simulator',
    backendUrl: process.env.MG_API_BASE_URL || raw.backendUrl,
    authToken: process.env.MG_GATEWAY_TOKEN || raw.authToken,
    gatewayId: process.env.MG_GATEWAY_ID || raw.gatewayId || 'MG-GATEWAY-001',
    localPort: Number(process.env.MG_GATEWAY_PORT || raw.localPort || 7077),
  }
}

async function main() {
  const config = loadConfig()
  if (String(config.tenant || 'mg').toLowerCase() !== 'mg') {
    throw new Error('MG Device Gateway is MG-only (tenant must be mg)')
  }

  log.info('starting', {
    gatewayId: config.gatewayId,
    mode: config.mode,
    scales: (config.scales || []).length,
  })

  const scaleManager = new ScaleManager({
    gatewayId: config.gatewayId,
    scales: config.scales,
    stability: config.stability,
    mode: config.mode,
  })

  let lastPushError = null
  let pushCount = 0

  scaleManager.on('reading', async (reading) => {
    // Only push stable readings to backend by default to reduce noise
    if (!reading.stable) return
    try {
      await postScaleReading({
        backendUrl: config.backendUrl,
        authToken: config.authToken,
        gatewayId: config.gatewayId,
        reading,
      })
      pushCount += 1
      lastPushError = null
    } catch (err) {
      lastPushError = err.message
      log.warn('ingest failed', { scaleId: reading.scaleId, message: err.message })
    }
  })

  await scaleManager.startAll()

  startLocalApi({
    port: config.localPort,
    gatewayId: config.gatewayId,
    scaleManager,
    getHealth: () => ({
      ok: true,
      tenant: 'mg',
      gatewayId: config.gatewayId,
      mode: config.mode,
      version: '1.0.0',
      scales: scaleManager.getStatuses(),
      pushCount,
      lastPushError,
      startedAt: new Date().toISOString(),
    }),
  })
}

main().catch((err) => {
  log.error('fatal', { message: err.message })
  process.exit(1)
})
