const { EventEmitter } = require('events')
const { createLogger } = require('../utils/logger')

const log = createLogger('xrf-sim')

/**
 * Development-only XRF simulator.
 * Never enable via MG_XRF_MODE=simulator in production accidentally.
 */
class XrfSimulator extends EventEmitter {
  constructor(config = {}) {
    super()
    this.config = config
    this.analyzerId = config.analyzerId || 'MG-XRF-001'
    this.status = 'DISCONNECTED'
    this._connected = false
  }

  async connect() {
    this._connected = true
    this.status = 'READY'
    this.emit('status', { analyzerId: this.analyzerId, status: this.status })
    log.info('simulator connected', { analyzerId: this.analyzerId })
  }

  async disconnect() {
    this._connected = false
    this.status = 'DISCONNECTED'
    this.emit('status', { analyzerId: this.analyzerId, status: this.status })
  }

  get connected() {
    return this._connected
  }

  /**
   * @param {'ok'|'error'|'timeout'|'invalid'} outcome
   */
  async runTest({ outcome = 'ok' } = {}) {
    if (!this._connected) throw new Error('XRF simulator not connected')
    this.status = 'TESTING'
    this.emit('status', { analyzerId: this.analyzerId, status: this.status })

    await new Promise((r) => setTimeout(r, 400))

    if (outcome === 'timeout') {
      this.status = 'ERROR'
      this.emit('status', { analyzerId: this.analyzerId, status: this.status })
      throw Object.assign(new Error('XRF test timed out'), { code: 'TIMEOUT' })
    }
    if (outcome === 'error') {
      this.status = 'ERROR'
      this.emit('status', { analyzerId: this.analyzerId, status: this.status })
      throw new Error('XRF hardware error (simulated)')
    }
    if (outcome === 'invalid') {
      this.status = 'READY'
      this.emit('status', { analyzerId: this.analyzerId, status: this.status })
      return {
        analyzerId: this.analyzerId,
        status: 'INVALID',
        elements: [],
        testedAt: new Date().toISOString(),
        rawData: { note: 'invalid simulated result' },
      }
    }

    const elements = [
      { symbol: 'Au', value: 91.72, unit: '%' },
      { symbol: 'Ag', value: 5.41, unit: '%' },
      { symbol: 'Cu', value: 2.63, unit: '%' },
      { symbol: 'Zn', value: 0.24, unit: '%' },
    ]
    this.status = 'READY'
    this.emit('status', { analyzerId: this.analyzerId, status: this.status })
    return {
      analyzerId: this.analyzerId,
      manufacturer: 'LANScientific',
      model: this.config.model || '',
      status: 'COMPLETED',
      elements,
      purity: 91.72,
      testedAt: new Date().toISOString(),
      originalResult: { elements },
      rawData: { source: 'simulator', note: 'Not a real analyzer reading' },
    }
  }
}

module.exports = { XrfSimulator }
