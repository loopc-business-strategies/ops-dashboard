const { createLogger } = require('../utils/logger')

const log = createLogger('backend')

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
    idempotencyKey: `${reading.scaleId}:${reading.timestamp}:${reading.weight}:${reading.stable}`,
    recordedAt: reading.timestamp,
    payload: {
      weight: reading.weight,
      unit: reading.unit,
      stable: reading.stable,
      connectionType: reading.connectionType,
      rawData: reading.rawData,
      scaleId: reading.scaleId,
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
      'x-tenant': 'mg',
      'x-company': 'mg',
      'X-Client': 'mg-device-gateway',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.message || `Ingest failed (${res.status})`)
  }
  return data
}

module.exports = { postScaleReading }
