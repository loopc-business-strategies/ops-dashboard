const { EventEmitter } = require('events')
const net = require('net')
const { createLogger } = require('../../utils/logger')

const log = createLogger('ethernet')

class EthernetDriver extends EventEmitter {
  constructor(scaleConfig) {
    super()
    this.config = scaleConfig
    this._socket = null
    this._open = false
  }

  async connect() {
    const host = this.config.ipAddress || this.config.host
    const port = Number(this.config.networkPort || this.config.port) || 4001
    if (!host) throw new Error(`Ethernet host not configured for ${this.config.scaleId}`)

    this._socket = net.createConnection({ host, port })
    await new Promise((resolve, reject) => {
      this._socket.once('connect', resolve)
      this._socket.once('error', reject)
    })
    this._open = true
    let buffer = ''
    this._socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8')
      const parts = buffer.split(/\r?\n/)
      buffer = parts.pop() || ''
      for (const line of parts) {
        if (line.trim()) this.emit('raw', line.trim())
      }
    })
    this._socket.on('close', () => {
      this._open = false
      this.emit('disconnect')
    })
    this._socket.on('error', (err) => {
      log.error('socket error', { scaleId: this.config.scaleId, message: err.message })
      this.emit('error', err)
    })
    log.info('connected', { scaleId: this.config.scaleId, host, port })
    this.emit('connect')
  }

  async disconnect() {
    if (this._socket) this._socket.destroy()
    this._open = false
  }

  get connected() {
    return this._open
  }
}

module.exports = { EthernetDriver }
