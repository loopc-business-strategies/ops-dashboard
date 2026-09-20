const { EventEmitter } = require('events')

/** Placeholder Bluetooth driver. */
class BluetoothDriver extends EventEmitter {
  constructor(scaleConfig) {
    super()
    this.config = scaleConfig
  }

  async connect() {
    throw new Error(`Bluetooth driver not yet implemented for ${this.config.scaleId}`)
  }

  async disconnect() {}

  get connected() {
    return false
  }
}

module.exports = { BluetoothDriver }
