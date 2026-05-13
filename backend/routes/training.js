const express = require('express')
const { protect } = require('../middleware/auth')
const { Joi, validateBody, validateParams } = require('../middleware/validate')
const {
  TrainingSession,
  TrainingBatch,
  TrainingAttendance,
  TrainingResource,
  TrainingAssessment,
  TrainingCert,
  TrainingFeedback,
  TrainingTrainee,
} = require('../models/TrainingModels')

const router = express.Router()

const canWrite = (user) => user?.role === 'super_admin' || user?.role === 'department_head'

const idParam = Joi.object({ id: Joi.string().hex().length(24).required() })

const sessionSchema = Joi.object({
  title:   Joi.string().trim().min(1).max(200).required(),
  prog:    Joi.string().trim().allow('').max(200).optional(),
  date:    Joi.string().trim().allow('').max(30).optional(),
  day:     Joi.number().integer().min(1).optional(),
  time:    Joi.string().trim().allow('').max(20).optional(),
  trainer: Joi.string().trim().allow('').max(120).optional(),
  batch:   Joi.string().trim().allow('').max(120).optional(),
  venue:   Joi.string().trim().allow('').max(200).optional(),
  st:      Joi.string().trim().allow('').max(50).optional(),
})

const batchSchema = Joi.object({
  name:       Joi.string().trim().min(1).max(200).required(),
  prog:       Joi.string().trim().allow('').max(200).optional(),
  start:      Joi.string().trim().allow('').max(30).optional(),
  end:        Joi.string().trim().allow('').max(30).optional(),
  trainer:    Joi.string().trim().allow('').max(120).optional(),
  trainees:   Joi.number().integer().min(0).optional(),
  st:         Joi.string().trim().allow('').max(50).optional(),
  completion: Joi.number().min(0).max(100).optional(),
})

const attendanceSchema = Joi.object({
  sess:     Joi.string().trim().min(1).max(200).required(),
  date:     Joi.string().trim().allow('').max(30).optional(),
  trainee:  Joi.string().trim().allow('').max(120).optional(),
  status:   Joi.string().valid('Present', 'Absent', 'Late').optional(),
  batch:    Joi.string().trim().allow('').max(120).optional(),
  duration: Joi.number().min(0).optional(),
})

const resourceSchema = Joi.object({
  title:    Joi.string().trim().min(1).max(200).required(),
  type:     Joi.string().trim().allow('').max(80).optional(),
  url:      Joi.string().uri({ allowRelative: true }).allow('').optional(),
  prog:     Joi.string().trim().allow('').max(200).optional(),
  uploader: Joi.string().trim().allow('').max(120).optional(),
  size:     Joi.string().trim().allow('').max(30).optional(),
})

const assessmentSchema = Joi.object({
  title:   Joi.string().trim().min(1).max(200).required(),
  prog:    Joi.string().trim().allow('').max(200).optional(),
  type:    Joi.string().trim().allow('').max(80).optional(),
  date:    Joi.string().trim().allow('').max(30).optional(),
  maxScore:Joi.number().min(0).optional(),
  passing: Joi.number().min(0).max(100).optional(),
})

const certSchema = Joi.object({
  trainee:  Joi.string().trim().min(1).max(120).required(),
  prog:     Joi.string().trim().allow('').max(200).optional(),
  issued:   Joi.string().trim().allow('').max(30).optional(),
  expiry:   Joi.string().trim().allow('').max(30).optional(),
  certNo:   Joi.string().trim().allow('').max(60).optional(),
  status:   Joi.string().trim().allow('').max(50).optional(),
})

const feedbackSchema = Joi.object({
  trainee:  Joi.string().trim().allow('').max(120).optional(),
  sess:     Joi.string().trim().allow('').max(200).optional(),
  rating:   Joi.number().integer().min(1).max(5).optional(),
  comments: Joi.string().trim().allow('').max(2000).optional(),
  date:     Joi.string().trim().allow('').max(30).optional(),
})

const traineeSchema = Joi.object({
  name:   Joi.string().trim().min(1).max(120).required(),
  emp:    Joi.string().trim().allow('').max(60).optional(),
  dept:   Joi.string().trim().allow('').max(80).optional(),
  email:  Joi.string().email({ tlds: { allow: false } }).allow('').optional(),
  phone:  Joi.string().trim().allow('').max(30).optional(),
  status: Joi.string().trim().allow('').max(50).optional(),
})

const patchSchema = Joi.object({}).unknown(true)

function crudRoutes(router, path, Model, createSchema) {
  router.get(path, protect, async (req, res) => {
    try {
      const TenantModel = await Model.getTenantModel(req.tenant)
      const rows = await TenantModel.find().sort({ createdAt: -1 }).limit(500).lean()
      res.json({ success: true, data: rows })
    } catch (err) {
        console.error('[training] list error:', err)
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
      const doc = await TenantModel.findByIdAndDelete(req.params.id)
      if (!doc) return res.status(404).json({ success: false, message: 'Not found' })
      res.json({ success: true })
    } catch (err) {
        console.error('[training] delete error:', err)
        res.status(500).json({ success: false, message: 'Internal server error' })
    }
  })
}

crudRoutes(router, '/sessions',    TrainingSession,    sessionSchema)
crudRoutes(router, '/batches',     TrainingBatch,      batchSchema)
crudRoutes(router, '/attendance',  TrainingAttendance, attendanceSchema)
crudRoutes(router, '/resources',   TrainingResource,   resourceSchema)
crudRoutes(router, '/assessments', TrainingAssessment, assessmentSchema)
crudRoutes(router, '/certs',       TrainingCert,       certSchema)
crudRoutes(router, '/feedback',    TrainingFeedback,   feedbackSchema)
crudRoutes(router, '/trainees',    TrainingTrainee,    traineeSchema)

module.exports = router

