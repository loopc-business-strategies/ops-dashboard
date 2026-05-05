const express = require('express')
const { protect } = require('../middleware/auth')
const { bus } = require('../utils/realtimeBus')

const router = express.Router()

router.get('/events', protect, (req, res) => {
  const tenantKey = String(req.tenant?.key || req.user?.tenant || 'default')

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (typeof res.flushHeaders === 'function') res.flushHeaders()

  res.write(`event: connected\n`)
  res.write(`data: ${JSON.stringify({ ok: true, tenant: tenantKey, time: new Date().toISOString() })}\n\n`)

  const onEvent = (event) => {
    if (String(event.tenant || 'default') !== tenantKey) return
    res.write(`event: ${event.type}\n`)
    res.write(`data: ${JSON.stringify(event.data || {})}\n\n`)
  }

  bus.on('event', onEvent)

  const heartbeat = setInterval(() => {
    res.write(`: keep-alive ${Date.now()}\n\n`)
  }, 25000)

  req.on('close', () => {
    clearInterval(heartbeat)
    bus.off('event', onEvent)
    res.end()
  })
})

module.exports = router
