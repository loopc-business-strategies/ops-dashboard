const express = require('express')
const { WebSocketServer } = require('ws')
const { createLogger } = require('../utils/logger')

const log = createLogger('local-api')

function startLocalApi({ port, gatewayId, scaleManager, getHealth }) {
  const app = express()
  app.use(express.json())

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

  app.post('/scales/:scaleId/reconnect', async (req, res) => {
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

  app.post('/simulator/:scaleId/weight', (req, res) => {
    const conn = scaleManager.getConnection(req.params.scaleId)
    if (!conn) return res.status(404).json({ success: false, message: 'Scale not found' })
    if (typeof conn.driver.setWeight !== 'function') {
      return res.status(400).json({ success: false, message: 'Not a simulator scale' })
    }
    conn.driver.setWeight(req.body.weight)
    if (req.body.stable != null) conn.driver.setStable(req.body.stable)
    res.json({ success: true })
  })

  app.post('/simulator/:scaleId/malformed', (req, res) => {
    const conn = scaleManager.getConnection(req.params.scaleId)
    if (!conn?.driver?.setMalformed) {
      return res.status(400).json({ success: false, message: 'Not a simulator scale' })
    }
    conn.driver.setMalformed(Boolean(req.body.on))
    res.json({ success: true })
  })

  const server = app.listen(port, () => {
    log.info('local API listening', { port, gatewayId })
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

  return { app, server, wss, broadcast }
}

module.exports = { startLocalApi }
