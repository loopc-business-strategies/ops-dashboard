const { EventEmitter } = require('events')

/** Placeholder USB HID/CDC driver — wire vendor SDK when available. */
class UsbDriver extends EventEmitter {
  constructor(scaleConfig) {
    super()
    this.config = scaleConfig
  }

  async connect() {
    throw new Error(`USB driver not yet implemented for ${this.config.scaleId}`)
  }

  async disconnect() {}

  get connected() {
    return false
  }
}

module.exports = { UsbDriver }
