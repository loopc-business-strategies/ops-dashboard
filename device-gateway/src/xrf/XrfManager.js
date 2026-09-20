const { EventEmitter } = require('events')
const { XrfSimulator } = require('./simulator/XrfSimulator')
const { LanScientificAdapter } = require('./adapters/LanScientificAdapter')
const { createLogger } = require('../utils/logger')

const log = createLogger('xrf-manager')

class XrfManager extends EventEmitter {
  constructor({ gatewayId, analyzers = [], mode = 'disabled' }) {
    super()
    this.gatewayId = gatewayId
    this.mode = String(mode || 'disabled').toLowerCase()
    this.connections = new Map()

    for (const cfg of analyzers) {
      if (cfg.enabled === false) continue
      const adapter = this.mode === 'simulator'
        ? new XrfSimulator(cfg)
        : new LanScientificAdapter(cfg)
      adapter.on?.('status', (s) => this.emit('status', s))
      this.connections.set(String(cfg.analyzerId || 'MG-XRF-001').toUpperCase(), adapter)
    }

    if (!this.connections.size && this.mode === 'simulator') {
      const sim = new XrfSimulator({ analyzerId: 'MG-XRF-001' })
      this.connections.set('MG-XRF-001', sim)
    }
  }

  async startAll() {
    if (this.mode === 'disabled') {
      log.info('XRF manager disabled (set MG_XRF_MODE=simulator to enable)')
      return
    }
    for (const [id, adapter] of this.connections) {
      try {
        await adapter.connect()
        this.emit('status', { analyzerId: id, status: adapter.status || 'READY' })
      } catch (err) {
        log.warn('XRF connect failed', { analyzerId: id, message: err.message })
        this.emit('status', { analyzerId: id, status: 'ERROR', error: err.message })
      }
    }
  }

  getStatuses() {
    return [...this.connections.entries()].map(([analyzerId, adapter]) => ({
      analyzerId,
      status: adapter.status || (adapter.connected ? 'READY' : 'DISCONNECTED'),
      connected: Boolean(adapter.connected),
      mode: this.mode,
    }))
  }

  getConnection(analyzerId) {
    return this.connections.get(String(analyzerId || '').toUpperCase())
  }

  async runTest(analyzerId, opts = {}) {
    const adapter = this.getConnection(analyzerId)
    if (!adapter) throw new Error(`XRF analyzer not found: ${analyzerId}`)
    return adapter.runTest(opts)
  }
}

module.exports = { XrfManager }
