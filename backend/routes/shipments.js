const express = require('express')
const Joi = require('joi')
const { protect } = require('../middleware/auth')
const { validateBody, validateParams } = require('../middleware/validate')
const OpsShipment = require('../models/OpsShipment')
const { canViewOperationsModule, canManageSuppliers, isSuperAdmin } = require('../services/permissions/moduleAccessPolicy')
const { auditLog } = require('../middleware/audit')

const router = express.Router()
const idParam = Joi.object({ id: Joi.string().hex().length(24).required() })

function canWriteShipments(user) {
  return isSuperAdmin(user) || canManageSuppliers(user) || user?.role === 'department_head'
}

router.get('/', protect, async (req, res) => {
  try {
    if (!canViewOperationsModule(req.user) && !isSuperAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }
    const filter = {}
    if (req.query.status) filter.status = String(req.query.status).toUpperCase()
    const shipments = await OpsShipment.find(filter).sort({ updatedAt: -1 }).limit(200).lean()
    res.json({ success: true, shipments, demo: false })
  } catch (err) {
    console.error('List shipments error:', err)
    res.status(500).json({ success: false, message: 'Failed to list shipments' })
  }
})

router.post('/', protect, validateBody(Joi.object({
  shipmentId: Joi.string().trim().min(2).max(60).required(),
  batchId: Joi.string().hex().length(24).allow(null, ''),
  batchNumber: Joi.string().trim().allow(''),
  stockLotId: Joi.string().hex().length(24).allow(null, ''),
  weight: Joi.number().min(0),
  metalType: Joi.string().trim().allow(''),
  origin: Joi.string().trim().allow(''),
  destination: Joi.string().trim().allow(''),
  carrier: Joi.string().trim().allow(''),
  driver: Joi.string().trim().allow(''),
  vehicle: Joi.string().trim().allow(''),
  documents: Joi.array().items(Joi.string()),
  insurance: Joi.string().trim().allow(''),
  status: Joi.string().valid('DRAFT', 'IN_TRANSIT', 'ARRIVED', 'DELAYED', 'INCIDENT', 'CANCELLED'),
  eta: Joi.date().allow(null),
  notes: Joi.string().trim().allow(''),
})), async (req, res) => {
  try {
    if (!canWriteShipments(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }
    const body = { ...req.body }
    if (!body.batchId) body.batchId = null
    if (!body.stockLotId) body.stockLotId = null
    const shipment = await OpsShipment.create({
      ...body,
      shipmentId: String(body.shipmentId).toUpperCase(),
      createdById: req.user._id,
      createdByName: req.user.name || '',
    })
    await auditLog(req, {
      resource: 'OpsShipment',
      resourceId: shipment._id,
      action: 'create',
      detail: `Shipment ${shipment.shipmentId} created`,
    })
    res.status(201).json({ success: true, shipment })
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({ success: false, message: 'Shipment ID already exists' })
    }
    console.error('Create shipment error:', err)
    res.status(500).json({ success: false, message: 'Failed to create shipment' })
  }
})

router.patch('/:id', protect, validateParams(idParam), validateBody(Joi.object({
  status: Joi.string().valid('DRAFT', 'IN_TRANSIT', 'ARRIVED', 'DELAYED', 'INCIDENT', 'CANCELLED'),
  eta: Joi.date().allow(null),
  actualArrival: Joi.date().allow(null),
  incident: Joi.string().trim().allow(''),
  carrier: Joi.string().trim().allow(''),
  driver: Joi.string().trim().allow(''),
  vehicle: Joi.string().trim().allow(''),
  notes: Joi.string().trim().allow(''),
  weight: Joi.number().min(0),
})), async (req, res) => {
  try {
    if (!canWriteShipments(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }
    const shipment = await OpsShipment.findById(req.params.id)
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found' })
    Object.assign(shipment, req.body)
    await shipment.save()
    await auditLog(req, {
      resource: 'OpsShipment',
      resourceId: shipment._id,
      action: 'update',
      detail: `Shipment ${shipment.shipmentId} updated`,
    })
    res.json({ success: true, shipment })
  } catch (err) {
    console.error('Update shipment error:', err)
    res.status(500).json({ success: false, message: 'Failed to update shipment' })
  }
})

module.exports = router
