const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const SCALE_STATUSES = [
  'CONNECTED',
  'DISCONNECTED',
  'ERROR',
  'UNSTABLE',
  'STABLE',
  'CALIBRATION_DUE',
  'DISABLED',
]

const CONNECTION_TYPES = ['RS232', 'USB', 'BLUETOOTH', 'ETHERNET', 'WIFI', 'SIMULATOR']

const scaleSchema = new mongoose.Schema(
  {
    scaleId: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, trim: true, default: '' },
    manufacturer: { type: String, trim: true, default: 'Ming Heng' },
    model: { type: String, trim: true, default: 'MH-708' },
    serialNumber: { type: String, trim: true, default: '' },
    connectionType: { type: String, enum: CONNECTION_TYPES, default: 'RS232' },
    port: { type: String, trim: true, default: '' },
    baudRate: { type: Number, default: 9600 },
    dataBits: { type: Number, default: 8 },
    parity: { type: String, trim: true, default: 'none' },
    stopBits: { type: Number, default: 1 },
    ipAddress: { type: String, trim: true, default: '' },
    bluetoothId: { type: String, trim: true, default: '' },
    networkPort: { type: Number, default: null },
    department: { type: String, trim: true, default: '' },
    location: { type: String, trim: true, default: '' },
    unit: { type: String, trim: true, default: 'g' },
    precision: { type: Number, default: 2 },
    calibrationDate: { type: Date, default: null },
    nextCalibrationDate: { type: Date, default: null },
    gatewayId: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    status: { type: String, enum: SCALE_STATUSES, default: 'DISCONNECTED' },
    lastWeight: { type: Number, default: null },
    lastStable: { type: Boolean, default: false },
    lastSeenAt: { type: Date, default: null },
    lastError: { type: String, trim: true, default: '' },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true },
)

scaleSchema.index({ scaleId: 1 }, { unique: true })
scaleSchema.index({ gatewayId: 1, enabled: 1 })
scaleSchema.index({ department: 1 })
scaleSchema.index({ enabled: 1, status: 1 })
scaleSchema.index({ name: 1 })
scaleSchema.index({ model: 1 })

module.exports = createTenantModel('Scale', scaleSchema)
module.exports.SCALE_STATUSES = SCALE_STATUSES
module.exports.CONNECTION_TYPES = CONNECTION_TYPES
