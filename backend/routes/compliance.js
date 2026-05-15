const express = require('express')
const { protect } = require('../middleware/auth')
const { Joi, validateBody, validateParams } = require('../middleware/validate')
const { softDeleteById } = require('../utils/softDelete')
const {
  ComplianceEligibility,
  ComplianceApproval,
  ComplianceDoc,
  ComplianceUpdate,
  ComplianceAgreement,
} = require('../models/ComplianceModels')

const router = express.Router()

// Only super_admin or government/compliance department heads may write
const canWrite = (user) => {
  if (!user) return false
  if (user.role === 'super_admin') return true
  if (user.role === 'department_head') {
    const dept = String(user.department || '').toLowerCase()
    return dept === 'government' || dept === 'compliance' || dept === 'finance'
  }
  return false
}

const idParam = Joi.object({ id: Joi.string().hex().length(24).required() })

const eligibilitySchema = Joi.object({
  refId:      Joi.string().trim().allow('').max(60).optional(),
  entity:     Joi.string().trim().min(1).max(200).required(),
  permit:     Joi.string().trim().allow('').max(200).optional(),
  status:     Joi.string().trim().allow('').max(50).optional(),
  lastReview: Joi.string().trim().allow('').max(30).optional(),
  owner:      Joi.string().trim().allow('').max(120).optional(),
  notes:      Joi.string().trim().allow('').max(1000).optional(),
})

const approvalSchema = Joi.object({
  refId:         Joi.string().trim().allow('').max(60).optional(),
  authority:     Joi.string().trim().min(1).max(200).required(),
  filing:        Joi.string().trim().allow('').max(200).optional(),
  dueDate:       Joi.string().trim().allow('').max(30).optional(),
  submittedDate: Joi.string().trim().allow('').max(30).optional(),
  status:        Joi.string().trim().allow('').max(50).optional(),
  refNo:         Joi.string().trim().allow('').max(60).optional(),
})

const docSchema = Joi.object({
  title:   Joi.string().trim().min(1).max(200).required(),
  docType: Joi.string().trim().allow('').max(100).optional(),
  status:  Joi.string().trim().allow('').max(50).optional(),
  expiry:  Joi.string().trim().allow('').max(30).optional(),
  owner:   Joi.string().trim().allow('').max(120).optional(),
  notes:   Joi.string().trim().allow('').max(1000).optional(),
})

const updateSchema = Joi.object({
  title:    Joi.string().trim().min(1).max(200).required(),
  category: Joi.string().trim().allow('').max(100).optional(),
  date:     Joi.string().trim().allow('').max(30).optional(),
  status:   Joi.string().trim().allow('').max(50).optional(),
  impact:   Joi.string().trim().allow('').max(50).optional(),
  summary:  Joi.string().trim().allow('').max(2000).optional(),
})

const agreementSchema = Joi.object({
  counterparty: Joi.string().trim().min(1).max(200).required(),
  type:         Joi.string().trim().allow('').max(100).optional(),
  status:       Joi.string().trim().allow('').max(50).optional(),
  signed:       Joi.string().trim().allow('').max(30).optional(),
  expiry:       Joi.string().trim().allow('').max(30).optional(),
  value:        Joi.string().trim().allow('').max(60).optional(),
  notes:        Joi.string().trim().allow('').max(1000).optional(),
})

const patchSchema = Joi.object({}).unknown(true)

function crudRoutes(router, path, Model, createSchema) {
  router.get(path, protect, async (req, res) => {
    try {
      const TenantModel = await Model.getTenantModel(req.tenant)
      const rows = await TenantModel.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 }).limit(500).lean()
      res.json({ success: true, data: rows })
    } catch (err) {
      console.error('[compliance] list error:', err)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  })

  router.post(path, protect, validateBody(createSchema), async (req, res) => {
    if (!canWrite(req.user)) return res.status(403).json({ success: false, message: 'Access denied.' })
    try {
      const TenantModel = await Model.getTenantModel(req.tenant)
      const doc = await TenantModel.create({
        ...req.body,
        createdById:   req.user._id,
        createdByName: req.user.name,
      })
      res.status(201).json({ success: true, data: doc })
    } catch (err) {
      res.status(400).json({ success: false, message: err.message })
    }
  })

  router.put(`${path}/:id`, protect, validateParams(idParam), validateBody(patchSchema), async (req, res) => {
    if (!canWrite(req.user)) return res.status(403).json({ success: false, message: 'Access denied.' })
    try {
      const TenantModel = await Model.getTenantModel(req.tenant)
      const doc = await TenantModel.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { returnDocument: 'after', runValidators: true }
      )
      if (!doc) return res.status(404).json({ success: false, message: 'Not found' })
      res.json({ success: true, data: doc })
    } catch (err) {
      res.status(400).json({ success: false, message: err.message })
    }
  })

  router.delete(`${path}/:id`, protect, validateParams(idParam), async (req, res) => {
    if (req.user?.role !== 'super_admin') return res.status(403).json({ success: false, message: 'Only super admin can delete records.' })
    try {
      const TenantModel = await Model.getTenantModel(req.tenant)
      const doc = await softDeleteById(TenantModel, req.params.id, req)
      if (!doc) return res.status(404).json({ success: false, message: 'Not found' })
      res.json({ success: true })
    } catch (err) {
      console.error('[compliance] delete error:', err)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  })
}

crudRoutes(router, '/eligibility', ComplianceEligibility, eligibilitySchema)
crudRoutes(router, '/approvals',   ComplianceApproval,    approvalSchema)
crudRoutes(router, '/docs',        ComplianceDoc,         docSchema)
crudRoutes(router, '/updates',     ComplianceUpdate,      updateSchema)
crudRoutes(router, '/agreements',  ComplianceAgreement,   agreementSchema)

module.exports = router
