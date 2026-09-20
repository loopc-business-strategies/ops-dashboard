const { EventEmitter } = require('events')
const { XrfSimulator } = require('./simulator/XrfSimulator')
const { LanScientificAdapter } = require('./adapters/LanScientificAdapter')
const { createLogger } = require('../utils/logger')

const log = createLogger('xrf-manager')

function createAdapter(mode, cfg) {
  return mode === 'simulator' ? new XrfSimulator(cfg) : new LanScientificAdapter(cfg)
}

class XrfManager extends EventEmitter {
  constructor({ gatewayId, analyzers = [], mode = 'disabled' }) {
    super()
    this.gatewayId = gatewayId
    this.mode = String(mode || 'disabled').toLowerCase()
    this.connections = new Map()

    for (const cfg of analyzers || []) {
      if (cfg.enabled === false) continue
      const id = String(cfg.analyzerId || '').trim().toUpperCase()
      if (!id) {
        log.warn('skipping XRF config without analyzerId')
        continue
      }
      const adapter = createAdapter(this.mode, { ...cfg, analyzerId: id })
      adapter.on?.('status', (s) => this.emit('status', s))
      this.connections.set(id, adapter)
    }

    if (!this.connections.size) {
      log.info('XRF unavailable — no analyzers configured')
    }
  }

  async startAll() {
    if (this.mode === 'disabled') {
      log.info('XRF manager disabled (set MG_XRF_MODE=simulator to enable)')
      return
    }
    if (!this.connections.size) {
      log.info('XRF start skipped — no analyzers configured')
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
    const id = String(analyzerId || '').trim().toUpperCase()
    if (!id) throw new Error('analyzerId is required')
    const adapter = this.getConnection(id)
    if (!adapter) throw new Error(`XRF analyzer not found: ${id}`)
    const result = await adapter.runTest(opts)
    const payload = {
      analyzerId: id,
      ...result,
      source: this.mode === 'simulator' ? 'simulated' : 'hardware',
      ingestId: result?.ingestId || `gw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    }
    this.emit('result', payload)
    return payload
  }

  /**
   * Merge backend-assigned analyzers (add new, drop unassigned).
   */
  async syncAnalyzers(analyzerConfigs = []) {
    if (this.mode === 'disabled') return
    const nextIds = new Set()
    for (const cfg of analyzerConfigs || []) {
      if (cfg.enabled === false) continue
      const id = String(cfg.analyzerId || '').trim().toUpperCase()
      if (!id) continue
      nextIds.add(id)
      if (this.connections.has(id)) continue
      const adapter = createAdapter(this.mode, { ...cfg, analyzerId: id })
      adapter.on?.('status', (s) => this.emit('status', s))
      this.connections.set(id, adapter)
      try {
        await adapter.connect()
        this.emit('status', { analyzerId: id, status: adapter.status || 'READY' })
        log.info('synced XRF started', { analyzerId: id })
      } catch (err) {
        log.warn('synced XRF start failed', { analyzerId: id, message: err.message })
        this.emit('status', { analyzerId: id, status: 'ERROR', error: err.message })
      }
    }
    for (const [id, adapter] of [...this.connections.entries()]) {
      if (nextIds.has(id)) continue
      try {
        await adapter.disconnect?.()
      } catch {
        // ignore
      }
      this.connections.delete(id)
      log.info('synced XRF removed', { analyzerId: id })
    }
  }
}

module.exports = { XrfManager }
