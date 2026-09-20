const { EventEmitter } = require('events')
const { StabilityDetector } = require('./StabilityDetector')
const { parseWeightFrame } = require('./WeightParser')
const { Rs232Driver } = require('../drivers/rs232')
const { UsbDriver } = require('../drivers/usb')
const { BluetoothDriver } = require('../drivers/bluetooth')
const { EthernetDriver } = require('../drivers/ethernet')
const { SimulatorDriver } = require('../simulator/SimulatorDriver')
const { createLogger } = require('../utils/logger')

const log = createLogger('scale-connection')

function createDriver(scaleConfig, mode) {
  const type = String(scaleConfig.connectionType || mode || 'SIMULATOR').toUpperCase()
  if (type === 'SIMULATOR' || mode === 'simulator') return new SimulatorDriver(scaleConfig)
  if (type === 'RS232') return new Rs232Driver(scaleConfig)
  if (type === 'USB') return new UsbDriver(scaleConfig)
  if (type === 'BLUETOOTH') return new BluetoothDriver(scaleConfig)
  if (type === 'ETHERNET' || type === 'WIFI') return new EthernetDriver(scaleConfig)
  return new SimulatorDriver(scaleConfig)
}

class ScaleConnection extends EventEmitter {
  constructor(scaleConfig, { gatewayId, stability, mode }) {
    super()
    this.config = scaleConfig
    this.gatewayId = gatewayId
    this.mode = mode
    this.driver = createDriver(scaleConfig, mode)
    this.stability = new StabilityDetector(stability)
    this.lastReading = null
    this.status = 'DISCONNECTED'
    this._onRaw = (raw) => this._handleRaw(raw)
    this._onError = (err) => {
      this.status = 'ERROR'
      this.emit('error', err)
    }
    this._onDisconnect = () => {
      this.status = 'DISCONNECTED'
      this.emit('status', this.getStatus())
    }
  }

  async start() {
    this.driver.on('raw', this._onRaw)
    this.driver.on('error', this._onError)
    this.driver.on('disconnect', this._onDisconnect)
    try {
      await this.driver.connect()
      this.status = 'CONNECTED'
      this.emit('status', this.getStatus())
    } catch (err) {
      this.status = 'ERROR'
      log.error('start failed', { scaleId: this.config.scaleId, message: err.message })
      throw err
    }
  }

  async stop() {
    this.driver.off('raw', this._onRaw)
    this.driver.off('error', this._onError)
    this.driver.off('disconnect', this._onDisconnect)
    await this.driver.disconnect()
    this.status = 'DISCONNECTED'
  }

  _handleRaw(raw) {
    const parsed = parseWeightFrame(raw, { unit: this.config.unit || 'g' })
    if (!parsed || parsed.parseError) {
      this.emit('malformed', { scaleId: this.config.scaleId, rawData: raw })
      return
    }

    const det = this.stability.update(parsed.weight)
    const stable = parsed.stableHint == null ? det.stable : Boolean(parsed.stableHint) && det.stable

    const reading = {
      scaleId: this.config.scaleId,
      deviceId: this.gatewayId,
      weight: det.weight,
      unit: 'g',
      stable,
      timestamp: new Date().toISOString(),
      connectionType: this.config.connectionType || 'SIMULATOR',
      rawData: parsed.rawData,
    }
    this.lastReading = reading
    this.status = stable ? 'STABLE' : 'UNSTABLE'
    this.emit('reading', reading)
    this.emit('status', this.getStatus())
  }

  getStatus() {
    return {
      scaleId: this.config.scaleId,
      status: this.status,
      connected: this.driver.connected,
      lastReading: this.lastReading,
    }
  }
}

class ScaleManager extends EventEmitter {
  constructor({ gatewayId, scales, stability, mode }) {
    super()
    this.gatewayId = gatewayId
    this.mode = mode
    this.connections = new Map()
    for (const scale of scales || []) {
      if (scale.enabled === false) continue
      const conn = new ScaleConnection(scale, { gatewayId, stability, mode })
      conn.on('reading', (r) => this.emit('reading', r))
      conn.on('status', (s) => this.emit('status', s))
      conn.on('malformed', (m) => this.emit('malformed', m))
      conn.on('error', (e) => this.emit('error', { scaleId: scale.scaleId, error: e }))
      this.connections.set(scale.scaleId, conn)
    }
  }

  async startAll() {
    for (const [scaleId, conn] of this.connections) {
      try {
        await conn.start()
      } catch (err) {
        log.error('scale start failed', { scaleId, message: err.message })
      }
    }
  }

  async stopAll() {
    for (const conn of this.connections.values()) {
      await conn.stop().catch(() => {})
    }
  }

  getStatuses() {
    return [...this.connections.values()].map((c) => c.getStatus())
  }

  getConnection(scaleId) {
    return this.connections.get(String(scaleId).toUpperCase())
      || this.connections.get(scaleId)
  }
}

module.exports = { ScaleManager, ScaleConnection }
