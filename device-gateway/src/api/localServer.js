const express = require('express')
const { WebSocketServer } = require('ws')
const { createLogger } = require('../utils/logger')

const log = createLogger('local-api')

function requireLocalToken(localToken) {
  return (req, res, next) => {
    const bind = String(process.env.MG_GATEWAY_BIND || '127.0.0.1').trim()
    const token = String(req.headers['x-local-gateway-token'] || '').trim()
    // Defense in depth: always require token when bind is not loopback, or when token is configured
    const needsToken = Boolean(localToken) || bind === '0.0.0.0' || bind === '::'
    if (!needsToken) return next()
    if (!localToken) {
      return res.status(503).json({
        success: false,
        message: 'Set MG_GATEWAY_LOCAL_TOKEN when binding beyond localhost',
      })
    }
    if (token !== localToken) {
      return res.status(401).json({ success: false, message: 'Invalid or missing X-Local-Gateway-Token' })
    }
    return next()
  }
}

function startLocalApi({
  port,
  gatewayId,
  scaleManager,
  xrfManager,
  getHealth,
  bindHost,
  localToken,
}) {
  const app = express()
  app.use(express.json())

  const guard = requireLocalToken(localToken)
  const host = String(bindHost || process.env.MG_GATEWAY_BIND || '127.0.0.1').trim() || '127.0.0.1'

  app.get('/health', (_req, res) => {
    res.json(getHealth())
  })

  app.get('/scales', (_req, res) => {
    res.json({ success: true, gatewayId, scales: scaleManager.getStatuses() })
  })

  app.get('/scales/:scaleId', (req, res) => {
    const conn = scaleManager.getConnection(req.params.scaleId)
    if (!conn) return res.status(404).json({ success: false, message: 'Scale not found' })
    res.json({ success: true, ...conn.getStatus() })
  })

  app.post('/scales/:scaleId/reconnect', guard, async (req, res) => {
    const conn = scaleManager.getConnection(req.params.scaleId)
    if (!conn) return res.status(404).json({ success: false, message: 'Scale not found' })
    try {
      await conn.stop()
      await conn.start()
      res.json({ success: true, ...conn.getStatus() })
    } catch (err) {
      res.status(500).json({ success: false, message: err.message })
    }
  })

  app.post('/simulator/:scaleId/weight', guard, (req, res) => {
    const conn = scaleManager.getConnection(req.params.scaleId)
    if (!conn) return res.status(404).json({ success: false, message: 'Scale not found' })
    if (typeof conn.driver.setWeight !== 'function') {
      return res.status(400).json({ success: false, message: 'Not a simulator scale' })
    }
    conn.driver.setWeight(req.body.weight)
    if (req.body.stable != null) conn.driver.setStable(req.body.stable)
    res.json({ success: true })
  })

  app.post('/simulator/:scaleId/malformed', guard, (req, res) => {
    const conn = scaleManager.getConnection(req.params.scaleId)
    if (!conn?.driver?.setMalformed) {
      return res.status(400).json({ success: false, message: 'Not a simulator scale' })
    }
    conn.driver.setMalformed(Boolean(req.body.on))
    res.json({ success: true })
  })

  app.get('/xrf', (_req, res) => {
    res.json({ success: true, gatewayId, analyzers: xrfManager ? xrfManager.getStatuses() : [] })
  })

  app.post('/xrf/:analyzerId/test', guard, async (req, res) => {
    if (!xrfManager) return res.status(400).json({ success: false, message: 'XRF manager not enabled' })
    try {
      const result = await xrfManager.runTest(req.params.analyzerId, {
        outcome: req.body?.outcome || 'ok',
      })
      res.json({ success: true, result })
    } catch (err) {
      res.status(500).json({ success: false, message: err.message })
    }
  })

  const server = app.listen(port, host, () => {
    log.info('local API listening', { host, port, gatewayId })
  })

  const wss = new WebSocketServer({ server, path: '/ws' })
  const broadcast = (msg) => {
    const data = JSON.stringify(msg)
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(data)
    }
  }

  scaleManager.on('reading', (reading) => broadcast({ type: 'reading', reading }))
  scaleManager.on('status', (status) => broadcast({ type: 'status', status }))
  if (xrfManager) {
    xrfManager.on('status', (status) => broadcast({ type: 'xrf_status', status }))
    xrfManager.on('result', (result) => broadcast({ type: 'xrf_result', result }))
  }

  return { app, server, wss, broadcast }
}

module.exports = { startLocalApi }
