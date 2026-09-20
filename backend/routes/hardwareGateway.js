const express = require('express')
const Joi = require('joi')
const { protect, restrictTo } = require('../middleware/auth')
const { validateBody } = require('../middleware/validate')
const mgFloor = require('../services/mgFloor')

const router = express.Router()

/**
 * Hardware edge gateway contract.
 *
 * Device → Local Gateway → POST /api/hardware/ingest → Backend → DB → Dashboard
 */

const DEVICE_TYPES = [
  'weighing_scale',
  'barcode_scanner',
  'qr_scanner',
  'label_printer',
  'attendance_device',
  'rfid',
  'gps',
  'machine_telemetry',
]

router.get('/contract', protect, (_req, res) => {
  res.json({
    success: true,
    architecture: 'FactoryDevice → EdgeGateway → SecureAPI → Backend → Database → Dashboard',
    deviceTypes: DEVICE_TYPES,
    ingestPath: 'POST /api/hardware/ingest',
    scanResolvePath: 'POST /api/scan/resolve',
    mgFloorIngestPath: 'POST /api/mg-floor/scales/ingest',
    auth: 'Tenant-scoped session cookie or Bearer JWT + CSRF for cookie sessions',
    notes: [
      'Do not depend on browser WebUSB/serial hacks for production weighing.',
      'Gateway must authenticate as a service user or device credential.',
      'Idempotency-Key header recommended for ingest retries.',
      'MG Floor weighing scales must be registered (MG-SCALE-001..007).',
    ],
  })
})

router.post(
  '/ingest',
  protect,
  restrictTo('super_admin', 'department_head', 'department_user', 'management'),
  validateBody(Joi.object({
    deviceType: Joi.string().valid(...DEVICE_TYPES).required(),
    deviceId: Joi.string().trim().max(120).required(),
    eventType: Joi.string().trim().max(80).required(),
    payload: Joi.object().unknown(true).default({}),
    recordedAt: Joi.date().allow(null),
    idempotencyKey: Joi.string().trim().max(120).allow('', null),
    scaleId: Joi.string().trim().allow('', null),
    gatewayId: Joi.string().trim().allow('', null),
  })),
  async (req, res) => {
    try {
      // Weighing scale events for MG persist via MG Floor ingest (tenant must be mg).
      if (req.body.deviceType === 'weighing_scale') {
        const tenant = String(req.tenant || req.user?.company || '').toLowerCase()
        if (tenant !== 'mg') {
          return res.status(403).json({
            success: false,
            message: 'Weighing scale ingest for production floor is MG-only.',
            code: 'MG_TENANT_REQUIRED',
          })
        }
        const result = await mgFloor.ingestScaleReading(req, {
          ...req.body,
          scaleId: req.body.scaleId || req.body.payload?.scaleId || req.body.deviceId,
        })
        const io = req.app?.get?.('io')
        if (io && !result.reused) {
          io.to('tenant:mg').emit('mg-floor:scale', {
            scaleId: result.scale?.scaleId,
            weight: result.event?.weight,
            stable: result.event?.stable,
            status: result.scale?.status,
            timestamp: result.event?.recordedAt || result.event?.receivedAt,
          })
        }
        return res.status(result.reused ? 200 : 202).json({ success: true, ...result })
      }

      // Non-scale devices: accept + echo (additive; no destructive behavior)
      const event = {
        id: `hw_${Date.now()}`,
        tenantHint: req.tenant || req.user?.company || null,
        deviceType: req.body.deviceType,
        deviceId: req.body.deviceId,
        eventType: req.body.eventType,
        payload: req.body.payload || {},
        recordedAt: req.body.recordedAt || new Date().toISOString(),
        receivedAt: new Date().toISOString(),
        receivedBy: req.user?._id,
        idempotencyKey: req.body.idempotencyKey || null,
        status: 'accepted',
      }
      console.info('[hardware-gateway] ingest', {
        deviceType: event.deviceType,
        deviceId: event.deviceId,
        eventType: event.eventType,
        idempotencyKey: event.idempotencyKey,
      })
      return res.status(202).json({ success: true, event })
    } catch (err) {
      const status = err.status || err.statusCode || 400
      return res.status(status).json({ success: false, message: err.message || 'Ingest failed' })
    }
  },
)

module.exports = router
