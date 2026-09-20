const { createLogger } = require('../utils/logger')
const {
  postScaleReading,
  postXrfIngest,
  postXrfResult,
} = require('../api/backendClient')

const log = createLogger('outbox')

async function deliverEvent(ev, creds) {
  const payload = ev.payload || {}
  switch (ev.eventType) {
    case 'SCALE_READING':
    case 'DEVICE_STATUS':
    case 'DEVICE_ERROR':
      return postScaleReading({
        ...creds,
        reading: payload.reading || payload,
        eventType: payload.eventType || (ev.eventType === 'SCALE_READING' ? 'weight_reading' : payload.lifecycleEventType || 'status'),
      })
    case 'XRF_RESULT':
      return postXrfResult({
        ...creds,
        body: {
          ...(payload.body || payload),
          ingestId: payload.ingestId || ev.eventId,
          idempotencyKey: payload.idempotencyKey || ev.eventId,
        },
      })
    case 'XRF_STATUS':
      return postXrfIngest({
        ...creds,
        body: payload.body || payload,
      })
    default:
      throw new Error(`Unsupported outbox eventType: ${ev.eventType}`)
  }
}

function startOutboxWorker({ outbox, creds, intervalMs = 3000 }) {
  let stopped = false
  let pushCount = 0
  let lastError = null

  const tick = async () => {
    if (stopped) return
    const due = outbox.listDue(20)
    for (const ev of due) {
      outbox.markSending(ev.eventId)
      try {
        await deliverEvent(ev, typeof creds === 'function' ? creds() : creds)
        outbox.markSent(ev.eventId)
        pushCount += 1
        lastError = null
      } catch (err) {
        lastError = err.message
        outbox.markFailed(ev.eventId, err.message)
        log.warn('outbox deliver failed', {
          eventId: ev.eventId,
          eventType: ev.eventType,
          message: err.message,
        })
      }
    }
  }

  const timer = setInterval(() => {
    tick().catch((err) => log.warn('outbox tick error', { message: err.message }))
  }, intervalMs)
  timer.unref?.()

  // Immediate flush
  tick().catch(() => {})

  return {
    stop: () => {
      stopped = true
      clearInterval(timer)
    },
    getStats: () => ({
      pushCount,
      lastError,
      counts: outbox.count(),
    }),
  }
}

module.exports = { startOutboxWorker, deliverEvent }
