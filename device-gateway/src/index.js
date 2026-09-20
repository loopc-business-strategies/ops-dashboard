const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { ScaleManager } = require('./scales/ScaleManager')
const { XrfManager } = require('./xrf/XrfManager')
const { startLocalApi } = require('./api/localServer')
const { fetchGatewayDevices } = require('./api/backendClient')
const { DurableOutbox } = require('./outbox/DurableOutbox')
const { startOutboxWorker } = require('./outbox/worker')
const { createLogger } = require('./utils/logger')

const log = createLogger('main')

function expandSimulatorScales(scales, count) {
  const n = Number(count)
  if (!Number.isFinite(n) || n <= 0) return scales || []
  const out = []
  for (let i = 1; i <= n; i += 1) {
    const scaleId = `MG-SCALE-${String(i).padStart(3, '0')}`
    const existing = (scales || []).find((s) => String(s.scaleId).toUpperCase() === scaleId)
    out.push({
      scaleId,
      connectionType: 'SIMULATOR',
      unit: 'g',
      enabled: true,
      ...(existing || {}),
      scaleId,
      connectionType: existing?.connectionType === 'RS232' ? 'RS232' : 'SIMULATOR',
    })
  }
  return out
}

function loadConfig() {
  const configPath = process.env.MG_GATEWAY_CONFIG
    || path.join(__dirname, '..', 'config', 'default.json')
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  const simCount = process.env.MG_GATEWAY_SIM_SCALE_COUNT
  let scales = raw.scales || []
  if (simCount && (process.env.MG_GATEWAY_MODE || raw.mode || 'simulator') === 'simulator') {
    scales = expandSimulatorScales(scales, simCount)
  }
  return {
    ...raw,
    scales,
    mode: process.env.MG_GATEWAY_MODE || raw.mode || 'simulator',
    xrfMode: process.env.MG_XRF_MODE || raw.xrfMode || 'disabled',
    backendUrl: process.env.MG_API_BASE_URL || raw.backendUrl,
    authToken: process.env.MG_GATEWAY_TOKEN || raw.authToken,
    gatewaySecret: process.env.MG_GATEWAY_SECRET || raw.gatewaySecret || '',
    gatewayId: process.env.MG_GATEWAY_ID || raw.gatewayId || 'MG-GATEWAY-001',
    localPort: Number(process.env.MG_GATEWAY_PORT || raw.localPort || 7077),
    bindHost: process.env.MG_GATEWAY_BIND || raw.bindHost || '127.0.0.1',
    localToken: process.env.MG_GATEWAY_LOCAL_TOKEN || raw.localToken || '',
    registryRefreshMs: Number(process.env.MG_GATEWAY_REGISTRY_REFRESH_MS || 60000),
    dataDir: process.env.MG_GATEWAY_DATA_DIR || path.join(__dirname, '..', 'data'),
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
    outbox: config.dataDir,
  })

  const outbox = new DurableOutbox({ dataDir: config.dataDir, gatewayId: config.gatewayId })

  const scaleManager = new ScaleManager({
    gatewayId: config.gatewayId,
    scales: config.scales,
    stability: config.stability,
    mode: config.mode,
  })

  const xrfManager = new XrfManager({
    gatewayId: config.gatewayId,
    analyzers: Array.isArray(config.xrfAnalyzers) ? config.xrfAnalyzers : [],
    mode: config.xrfMode,
  })

  const creds = () => ({
    backendUrl: config.backendUrl,
    authToken: config.authToken,
    gatewayId: config.gatewayId,
    gatewaySecret: config.gatewaySecret,
  })

  const worker = startOutboxWorker({
    outbox,
    creds,
    intervalMs: Number(process.env.MG_GATEWAY_OUTBOX_INTERVAL_MS || 3000),
  })

  const lastPushAtByScale = new Map()
  const minPushIntervalMs = Number(process.env.MG_GATEWAY_MIN_PUSH_MS || 15000)
  let heartbeatCount = 0

  scaleManager.on('reading', (reading) => {
    if (!reading.stable) return
    const now = Date.now()
    const scaleId = reading.scaleId
    const last = lastPushAtByScale.get(scaleId) || 0
    if (now - last < minPushIntervalMs) return
    lastPushAtByScale.set(scaleId, now)

    const eventId = `scale:${scaleId}:${reading.timestamp || now}:${reading.weight}:${reading.stable}`
    outbox.enqueue({
      eventId,
      deviceId: reading.deviceId || scaleId,
      deviceType: 'weighing_scale',
      eventType: 'SCALE_READING',
      payload: {
        eventType: 'weight_reading',
        reading: {
          ...reading,
          // backendClient builds idempotency from reading fields; also pass eventId
          idempotencyKey: eventId,
        },
      },
    })
  })

  scaleManager.on('lifecycle', (evt) => {
    const eventId = `life:${evt.scaleId}:${evt.eventType}:${evt.timestamp || Date.now()}`
    outbox.enqueue({
      eventId,
      deviceId: evt.scaleId,
      deviceType: 'weighing_scale',
      eventType: evt.eventType === 'error' ? 'DEVICE_ERROR' : 'DEVICE_STATUS',
      payload: {
        eventType: evt.eventType,
        lifecycleEventType: evt.eventType,
        reading: {
          scaleId: evt.scaleId,
          deviceId: config.gatewayId,
          timestamp: evt.timestamp,
          error: evt.error,
        },
      },
    })
  })

  xrfManager.on('status', (status) => {
    const eventId = `xrf-status:${status.analyzerId}:${status.status}:${Date.now()}`
    outbox.enqueue({
      eventId,
      deviceId: status.analyzerId,
      deviceType: 'xrf_analyzer',
      eventType: 'XRF_STATUS',
      payload: {
        body: {
          analyzerId: status.analyzerId,
          eventType: 'status',
          status: status.status,
          error: status.error,
        },
      },
    })
  })

  xrfManager.on('result', (result) => {
    const ingestId = result.ingestId || `gw-${crypto.randomUUID()}`
    outbox.enqueue({
      eventId: ingestId,
      deviceId: result.analyzerId,
      deviceType: 'xrf_analyzer',
      eventType: 'XRF_RESULT',
      payload: {
        ingestId,
        body: {
          analyzerId: result.analyzerId,
          elements: result.elements || [],
          source: result.source || 'hardware',
          status: result.status || 'COMPLETED',
          ingestId,
          purity: result.purity,
          fineness: result.fineness,
          originalResult: result,
          rawData: result.rawData || result,
        },
      },
    })
  })

  await scaleManager.startAll()
  await xrfManager.startAll()

  const refreshRegistry = async () => {
    try {
      const data = await fetchGatewayDevices(creds())
      if (data?.scales) {
        let mapped = data.scales.map((s) => ({
          ...s,
          connectionType: config.mode === 'simulator' ? 'SIMULATOR' : (s.connectionType || 'RS232'),
          enabled: s.enabled !== false,
        }))
        const simCount = Number(process.env.MG_GATEWAY_SIM_SCALE_COUNT || 0)
        if (config.mode === 'simulator' && simCount > mapped.length) {
          mapped = expandSimulatorScales(mapped, simCount)
        }
        await scaleManager.syncScales(mapped)
      }
      if (Array.isArray(data?.xrfAnalyzers)) {
        await xrfManager.syncAnalyzers(data.xrfAnalyzers)
      }
      log.info('registry sync ok', {
        scales: data?.scales?.length || 0,
        xrf: data?.xrfAnalyzers?.length || 0,
      })
    } catch (err) {
      log.warn('registry sync failed — using local/fallback config', { message: err.message })
    }
  }
  await refreshRegistry()
  if (config.registryRefreshMs > 0) {
    setInterval(refreshRegistry, config.registryRefreshMs).unref?.()
  }

  const heartbeatMs = Number(process.env.MG_GATEWAY_HEARTBEAT_MS || 60000)
  setInterval(() => {
    heartbeatCount += 1
    const stats = worker.getStats()
    log.info('heartbeat', {
      gatewayId: config.gatewayId,
      pushCount: stats.pushCount,
      outbox: stats.counts,
      heartbeatCount,
      scales: scaleManager.getStatuses().map((s) => `${s.scaleId}:${s.status}`),
      xrf: xrfManager.getStatuses(),
      lastPushError: stats.lastError,
    })
  }, heartbeatMs).unref?.()

  startLocalApi({
    port: config.localPort,
    bindHost: config.bindHost,
    localToken: config.localToken,
    gatewayId: config.gatewayId,
    scaleManager,
    xrfManager,
    getHealth: () => {
      const stats = worker.getStats()
      return {
        ok: true,
        tenant: 'mg',
        gatewayId: config.gatewayId,
        mode: config.mode,
        xrfMode: config.xrfMode,
        bindHost: config.bindHost,
        version: '1.3.0',
        scales: scaleManager.getStatuses(),
        xrf: xrfManager.getStatuses(),
        pushCount: stats.pushCount,
        outbox: stats.counts,
        heartbeatCount,
        lastPushError: stats.lastError,
        startedAt: new Date().toISOString(),
        driverNotes: {
          rs232: 'production-ready when serialport installed and COM configured',
          ethernet: 'TCP line-oriented scales supported',
          usb: 'stub — not commissioned / not production-ready',
          bluetooth: 'stub — not commissioned / not production-ready',
          xrf: config.xrfMode === 'simulator'
            ? 'simulator only — LANScientific protocol TBD; results tagged simulated'
            : 'disabled or adapter stub — do not claim hardware verified',
          outbox: 'durable file-backed queue (data/outbox.json); survives restart',
        },
      }
    },
  })
}

main().catch((err) => {
  log.error('fatal', { message: err.message })
  process.exit(1)
})
