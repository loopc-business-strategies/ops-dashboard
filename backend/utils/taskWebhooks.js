const crypto = require('crypto')

function getWebhookUrls() {
  const raw = String(process.env.TASK_WEBHOOK_URLS || '').trim()
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function isTaskWebhookEnabled() {
  return String(process.env.TASK_WEBHOOK_ENABLED || '').trim().toLowerCase() === 'true'
}

function signPayload(secret, body) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex')
}

/**
 * Fire-and-forget POST to TASK_WEBHOOK_URLS when TASK_WEBHOOK_ENABLED=true (comma-separated URLs).
 * Optional HMAC: TASK_WEBHOOK_SECRET → header X-Task-Signature (sha256 hex of body).
 * Each request body includes `webhookDeliveryId` (UUID) so receivers can treat duplicate deliveries idempotently.
 */
function emitTaskWebhook(eventType, payload) {
  if (!isTaskWebhookEnabled()) return
  const urls = getWebhookUrls()
  const secret = String(process.env.TASK_WEBHOOK_SECRET || '').trim()
  if (!urls.length) return

  const bodyObj = {
    event: eventType,
    time: new Date().toISOString(),
    webhookDeliveryId: crypto.randomUUID(),
    ...payload,
  }
  const body = JSON.stringify(bodyObj)

  for (const url of urls) {
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (secret) headers['X-Task-Signature'] = signPayload(secret, body)
      fetch(url, { method: 'POST', headers, body }).catch(() => {})
    } catch {
      /* ignore */
    }
  }
}

module.exports = { emitTaskWebhook }
