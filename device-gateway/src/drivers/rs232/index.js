const { EventEmitter } = require('events')
const { createLogger } = require('../../utils/logger')

const log = createLogger('rs232')

/**
 * RS232 driver for Ming Heng MH-708 style scales.
 * Serial settings are fully configurable — do not assume baud/parity until verified on hardware.
 */
class Rs232Driver extends EventEmitter {
  constructor(scaleConfig) {
    super()
    this.config = scaleConfig
    this._port = null
    this._open = false
  }

  async connect() {
    let SerialPort
    let ReadlineParser
    try {
      ;({ SerialPort } = require('serialport'))
      ;({ ReadlineParser } = require('@serialport/parser-readline'))
    } catch {
      throw new Error(
        `serialport not installed. Install optional dependency or use SIMULATOR for ${this.config.scaleId}`,
      )
    }

    if (!this.config.port) {
      throw new Error(`RS232 port not configured for ${this.config.scaleId}`)
    }

    this._port = new SerialPort({
      path: this.config.port,
      baudRate: Number(this.config.baudRate) || 9600,
      dataBits: Number(this.config.dataBits) || 8,
      parity: this.config.parity || 'none',
      stopBits: Number(this.config.stopBits) || 1,
      autoOpen: false,
    })

    await new Promise((resolve, reject) => {
      this._port.open((err) => (err ? reject(err) : resolve()))
    })

    const parser = this._port.pipe(new ReadlineParser({ delimiter: '\r\n' }))
    parser.on('data', (line) => this.emit('raw', String(line)))
    this._port.on('error', (err) => {
      log.error('port error', { scaleId: this.config.scaleId, message: err.message })
      this.emit('error', err)
    })
    this._port.on('close', () => {
      this._open = false
      this.emit('disconnect')
    })
    this._open = true
    log.info('connected', { scaleId: this.config.scaleId, port: this.config.port })
    this.emit('connect')
  }

  async disconnect() {
    if (this._port && this._open) {
      await new Promise((resolve) => this._port.close(() => resolve()))
    }
    this._open = false
  }

  get connected() {
    return this._open
  }
}

module.exports = { Rs232Driver }
