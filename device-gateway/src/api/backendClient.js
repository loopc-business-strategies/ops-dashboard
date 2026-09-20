const { createLogger } = require('../utils/logger')

const log = createLogger('backend')

function authHeaders({ authToken, gatewayId, gatewaySecret }) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'x-tenant': 'mg',
    'x-company': 'mg',
    'X-Client': 'mg-device-gateway',
    'X-Gateway-Id': gatewayId || '',
  }
  if (gatewaySecret) {
    headers['X-Gateway-Secret'] = gatewaySecret
  }
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }
  return headers
}

function canIngest({ backendUrl, authToken, gatewaySecret }) {
  if (!backendUrl) return false
  if (gatewaySecret) return true
  if (authToken && String(process.env.MG_GATEWAY_ALLOW_JWT_FALLBACK || '').trim() === '1') return true
  return false
}

async function postScaleReading({
  backendUrl,
  authToken,
  gatewayId,
  gatewaySecret,
  reading,
  eventType = 'weight_reading',
}) {
  if (!canIngest({ backendUrl, authToken, gatewaySecret })) {
    log.warn('skip ingest — backendUrl or gateway credentials missing')
    return null
  }

  const url = `${String(backendUrl).replace(/\/$/, '')}/api/mg-floor/scales/ingest`
  const body = {
    deviceType: 'weighing_scale',
    deviceId: reading.deviceId || gatewayId,
    scaleId: reading.scaleId,
    gatewayId,
    eventType,
    idempotencyKey: eventType === 'weight_reading'
      ? `${reading.scaleId}:${reading.timestamp}:${reading.weight}:${reading.stable}`
      : `${reading.scaleId}:${eventType}:${reading.timestamp || Date.now()}`,
    recordedAt: reading.timestamp || new Date().toISOString(),
    payload: {
      weight: reading.weight,
      unit: reading.unit,
      stable: reading.stable,
      connectionType: reading.connectionType,
      rawData: reading.rawData,
      scaleId: reading.scaleId,
      error: reading.error,
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders({ authToken, gatewayId, gatewaySecret }),
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.message || `Ingest failed (${res.status})`)
  }
  return data
}

async function postXrfIngest({ backendUrl, authToken, gatewayId, gatewaySecret, body }) {
  if (!canIngest({ backendUrl, authToken, gatewaySecret })) {
    log.warn('skip XRF ingest — backendUrl or gateway credentials missing')
    return null
  }
  const url = `${String(backendUrl).replace(/\/$/, '')}/api/mg-floor/xrf/ingest`
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders({ authToken, gatewayId, gatewaySecret }),
    body: JSON.stringify({ ...body, gatewayId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || `XRF ingest failed (${res.status})`)
  return data
}

async function postXrfResult({ backendUrl, authToken, gatewayId, gatewaySecret, body }) {
  if (!canIngest({ backendUrl, authToken, gatewaySecret })) {
    log.warn('skip XRF result ingest — backendUrl or gateway credentials missing')
    return null
  }
  const url = `${String(backendUrl).replace(/\/$/, '')}/api/mg-floor/xrf/ingest/result`
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders({ authToken, gatewayId, gatewaySecret }),
    body: JSON.stringify({ ...body, gatewayId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || `XRF result ingest failed (${res.status})`)
  return data
}

module.exports = { postScaleReading, postXrfIngest, postXrfResult }
