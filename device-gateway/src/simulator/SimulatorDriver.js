const { EventEmitter } = require('events')

/**
 * Development/test virtual scales MG-SCALE-001..007.
 * Never use simulator readings as production data unless MODE=simulator explicitly.
 */
class SimulatorDriver extends EventEmitter {
  constructor(scaleConfig, { initialWeight = 100 } = {}) {
    super()
    this.config = scaleConfig
    this._weight = initialWeight + Math.random() * 50
    this._stable = false
    this._connected = false
    this._timer = null
    this._malformed = false
  }

  async connect() {
    this._connected = true
    this.emit('connect')
    this._timer = setInterval(() => this._tick(), 400)
  }

  _tick() {
    if (!this._connected) return
    if (this._malformed) {
      this.emit('raw', '??BADFRAME##')
      return
    }
    // Occasionally drift then settle
    if (Math.random() < 0.15) {
      this._weight += (Math.random() - 0.5) * 2
      this._stable = false
    } else {
      this._stable = true
    }
    const flag = this._stable ? 'ST' : 'US'
    const line = `${flag},GS,+${this._weight.toFixed(2)} g`
    this.emit('raw', line)
  }

  setWeight(weight) {
    this._weight = Number(weight)
    this._stable = false
  }

  setStable(stable) {
    this._stable = Boolean(stable)
  }

  setMalformed(on) {
    this._malformed = Boolean(on)
  }

  async disconnect() {
    this._connected = false
    if (this._timer) clearInterval(this._timer)
    this._timer = null
    this.emit('disconnect')
  }

  async reconnect() {
    await this.disconnect()
    await this.connect()
  }

  get connected() {
    return this._connected
  }
}

module.exports = { SimulatorDriver }
