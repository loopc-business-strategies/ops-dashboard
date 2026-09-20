const fs = require('fs')
const path = require('path')
const { ScaleManager } = require('./scales/ScaleManager')
const { XrfManager } = require('./xrf/XrfManager')
const { startLocalApi } = require('./api/localServer')
const { postScaleReading, postXrfIngest, postXrfResult } = require('./api/backendClient')
const { createLogger } = require('./utils/logger')

const log = createLogger('main')

function loadConfig() {
  const configPath = process.env.MG_GATEWAY_CONFIG
    || path.join(__dirname, '..', 'config', 'default.json')
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  return {
    ...raw,
    mode: process.env.MG_GATEWAY_MODE || raw.mode || 'simulator',
    xrfMode: process.env.MG_XRF_MODE || raw.xrfMode || 'disabled',
    backendUrl: process.env.MG_API_BASE_URL || raw.backendUrl,
    authToken: process.env.MG_GATEWAY_TOKEN || raw.authToken,
    gatewaySecret: process.env.MG_GATEWAY_SECRET || raw.gatewaySecret || '',
    gatewayId: process.env.MG_GATEWAY_ID || raw.gatewayId || 'MG-GATEWAY-001',
    localPort: Number(process.env.MG_GATEWAY_PORT || raw.localPort || 7077),
    bindHost: process.env.MG_GATEWAY_BIND || raw.bindHost || '127.0.0.1',
    localToken: process.env.MG_GATEWAY_LOCAL_TOKEN || raw.localToken || '',
  }
}

async function main() {
  const config = loadConfig()
  if (String(config.tenant || 'mg').toLowerCase() !== 'mg') {
    throw new Error('MG Device Gateway is MG-only (tenant must be mg)')
  }

  const jwtFallback = String(process.env.MG_GATEWAY_ALLOW_JWT_FALLBACK || '').trim() === '1'
  if (!config.gatewaySecret && !(config.authToken && jwtFallback)) {
    log.warn('No MG_GATEWAY_SECRET set — ingest will be skipped unless JWT fallback is enabled (dev only)')
  }

  log.info('starting', {
    gatewayId: config.gatewayId,
    mode: config.mode,
    xrfMode: config.xrfMode,
    bindHost: config.bindHost,
    auth: config.gatewaySecret ? 'gateway-secret' : (jwtFallback && config.authToken ? 'jwt-fallback' : 'none'),
    scales: (config.scales || []).length,
  })

  const scaleManager = new ScaleManager({
    gatewayId: config.gatewayId,
    scales: config.scales,
    stability: config.stability,
    mode: config.mode,
  })

  const xrfManager = new XrfManager({
    gatewayId: config.gatewayId,
    analyzers: config.xrfAnalyzers || [{ analyzerId: 'MG-XRF-001', enabled: true, model: '' }],
    mode: config.xrfMode,
  })

  const creds = () => ({
    backendUrl: config.backendUrl,
    authToken: config.authToken,
    gatewayId: config.gatewayId,
    gatewaySecret: config.gatewaySecret,
  })

  let lastPushError = null
  let pushCount = 0
  const lastPushAtByScale = new Map()
  const inFlightByScale = new Set()
  const minPushIntervalMs = Number(process.env.MG_GATEWAY_MIN_PUSH_MS || 15000)
  let rateLimitUntil = 0
  let heartbeatCount = 0

  scaleManager.on('reading', async (reading) => {
    if (!reading.stable) return
    const now = Date.now()
    if (now < rateLimitUntil) return
    const scaleId = reading.scaleId
    if (inFlightByScale.has(scaleId)) return
    const last = lastPushAtByScale.get(scaleId) || 0
    if (now - last < minPushIntervalMs) return
    lastPushAtByScale.set(scaleId, now)
    inFlightByScale.add(scaleId)
    try {
      await postScaleReading({
        ...creds(),
        reading,
      })
      pushCount += 1
      lastPushError = null
    } catch (err) {
      lastPushError = err.message
      if (/too many requests/i.test(err.message)) {
        rateLimitUntil = Date.now() + Number(process.env.MG_GATEWAY_RATE_LIMIT_BACKOFF_MS || 60000)
      }
      log.warn('ingest failed', { scaleId, message: err.message })
    } finally {
      inFlightByScale.delete(scaleId)
    }
  })

  scaleManager.on('lifecycle', async (evt) => {
    try {
      await postScaleReading({
        ...creds(),
        reading: {
          scaleId: evt.scaleId,
          deviceId: config.gatewayId,
          timestamp: evt.timestamp,
          error: evt.error,
        },
        eventType: evt.eventType,
      })
    } catch (err) {
      log.warn('lifecycle ingest failed', { scaleId: evt.scaleId, message: err.message })
    }
  })

  xrfManager.on('status', async (status) => {
    try {
      await postXrfIngest({
        ...creds(),
        body: {
          analyzerId: status.analyzerId,
          eventType: 'status',
          status: status.status,
          error: status.error,
        },
      })
    } catch (err) {
      log.warn('xrf status ingest failed', { message: err.message })
    }
  })

  xrfManager.on('result', async (result) => {
    try {
      await postXrfResult({
        ...creds(),
        body: {
          analyzerId: result.analyzerId,
          elements: result.elements || [],
          source: result.source || 'hardware',
          status: result.status || 'COMPLETED',
          ingestId: result.ingestId,
          purity: result.purity,
          fineness: result.fineness,
          originalResult: result,
          rawData: result.rawData || result,
        },
      })
    } catch (err) {
      log.warn('xrf result ingest failed', { message: err.message })
    }
  })

  await scaleManager.startAll()
  await xrfManager.startAll()

  const heartbeatMs = Number(process.env.MG_GATEWAY_HEARTBEAT_MS || 60000)
  setInterval(() => {
    heartbeatCount += 1
    log.info('heartbeat', {
      gatewayId: config.gatewayId,
      pushCount,
      heartbeatCount,
      scales: scaleManager.getStatuses().map((s) => `${s.scaleId}:${s.status}`),
      xrf: xrfManager.getStatuses(),
      lastPushError,
    })
  }, heartbeatMs).unref?.()

  startLocalApi({
    port: config.localPort,
    bindHost: config.bindHost,
    localToken: config.localToken,
    gatewayId: config.gatewayId,
    scaleManager,
    xrfManager,
    getHealth: () => ({
      ok: true,
      tenant: 'mg',
      gatewayId: config.gatewayId,
      mode: config.mode,
      xrfMode: config.xrfMode,
      bindHost: config.bindHost,
      version: '1.2.0',
      scales: scaleManager.getStatuses(),
      xrf: xrfManager.getStatuses(),
      pushCount,
      heartbeatCount,
      lastPushError,
      startedAt: new Date().toISOString(),
      driverNotes: {
        rs232: 'production-ready when serialport installed and COM configured',
        ethernet: 'TCP line-oriented scales supported',
        usb: 'stub — not commissioned / not production-ready',
        bluetooth: 'stub — not commissioned / not production-ready',
        xrf: config.xrfMode === 'simulator'
          ? 'simulator only — LANScientific protocol TBD; results tagged simulated'
          : 'disabled or adapter stub — do not claim hardware verified',
      },
    }),
  })
}

main().catch((err) => {
  log.error('fatal', { message: err.message })
  process.exit(1)
})
