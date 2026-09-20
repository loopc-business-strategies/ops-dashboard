const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const XRF_STATUSES = [
  'CONNECTED',
  'DISCONNECTED',
  'ERROR',
  'TESTING',
  'READY',
  'CALIBRATION_DUE',
  'DISABLED',
]

const CONNECTION_TYPES = ['USB', 'BLUETOOTH', 'WIFI', 'ETHERNET', 'NETWORK', 'SIMULATOR', 'SDK', 'UNKNOWN']

const xrfAnalyzerSchema = new mongoose.Schema(
  {
    analyzerId: { type: String, required: true, trim: true, uppercase: true },
    manufacturer: { type: String, trim: true, default: 'LANScientific' },
    model: { type: String, trim: true, default: '' },
    serialNumber: { type: String, trim: true, default: '' },
    firmware: { type: String, trim: true, default: '' },
    softwareVersion: { type: String, trim: true, default: '' },
    connectionType: { type: String, enum: CONNECTION_TYPES, default: 'UNKNOWN' },
    usbId: { type: String, trim: true, default: '' },
    bluetoothId: { type: String, trim: true, default: '' },
    ipAddress: { type: String, trim: true, default: '' },
    networkPort: { type: Number, default: null },
    department: { type: String, trim: true, default: 'quality_control' },
    location: { type: String, trim: true, default: '' },
    gatewayId: { type: String, trim: true, default: '' },
    calibrationDate: { type: Date, default: null },
    nextCalibrationDate: { type: Date, default: null },
    status: { type: String, enum: XRF_STATUSES, default: 'DISCONNECTED' },
    lastSeenAt: { type: Date, default: null },
    lastError: { type: String, trim: true, default: '' },
    enabled: { type: Boolean, default: true },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
)

xrfAnalyzerSchema.index({ analyzerId: 1 }, { unique: true })
xrfAnalyzerSchema.index({ gatewayId: 1, enabled: 1 })

module.exports = createTenantModel('XrfAnalyzer', xrfAnalyzerSchema)
module.exports.XRF_STATUSES = XRF_STATUSES
module.exports.CONNECTION_TYPES = CONNECTION_TYPES
