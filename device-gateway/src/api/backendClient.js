const { createLogger } = require('../utils/logger')

const log = createLogger('backend')

function authHeaders(authToken, gatewayId) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authToken}`,
    'x-tenant': 'mg',
    'x-company': 'mg',
    'X-Client': 'mg-device-gateway',
    'x-gateway-id': gatewayId || '',
  }
}

async function postScaleReading({ backendUrl, authToken, gatewayId, reading, eventType = 'weight_reading' }) {
  if (!backendUrl || !authToken) {
    log.warn('skip ingest — backendUrl or authToken missing')
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
    headers: authHeaders(authToken, gatewayId),
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.message || `Ingest failed (${res.status})`)
  }
  return data
}

async function postXrfIngest({ backendUrl, authToken, gatewayId, body }) {
  if (!backendUrl || !authToken) {
    log.warn('skip XRF ingest — backendUrl or authToken missing')
    return null
  }
  const url = `${String(backendUrl).replace(/\/$/, '')}/api/mg-floor/xrf/ingest`
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(authToken, gatewayId),
    body: JSON.stringify({ ...body, gatewayId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || `XRF ingest failed (${res.status})`)
  return data
}

module.exports = { postScaleReading, postXrfIngest }
