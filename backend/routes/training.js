const express = require('express')
const { protect } = require('../middleware/auth')
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

function crudRoutes(router, path, Model) {
  router.get(path, protect, async (req, res) => {
    try {
      const TenantModel = await Model.getTenantModel(req.tenant)
      const rows = await TenantModel.find().sort({ createdAt: -1 }).limit(500).lean()
      res.json({ success: true, data: rows })
    } catch (err) {
      res.status(500).json({ success: false, message: err.message })
    }
  })

  router.post(path, protect, async (req, res) => {
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

  router.put(`${path}/:id`, protect, async (req, res) => {
    if (!canWrite(req.user)) return res.status(403).json({ success: false, message: 'Access denied.' })
    try {
      const TenantModel = await Model.getTenantModel(req.tenant)
      const doc = await TenantModel.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true, runValidators: true }
      )
      if (!doc) return res.status(404).json({ success: false, message: 'Not found' })
      res.json({ success: true, data: doc })
    } catch (err) {
      res.status(400).json({ success: false, message: err.message })
    }
  })

  router.delete(`${path}/:id`, protect, async (req, res) => {
    if (req.user?.role !== 'super_admin') return res.status(403).json({ success: false, message: 'Only super admin can delete records.' })
    try {
      const TenantModel = await Model.getTenantModel(req.tenant)
      const doc = await TenantModel.findByIdAndDelete(req.params.id)
      if (!doc) return res.status(404).json({ success: false, message: 'Not found' })
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ success: false, message: err.message })
    }
  })
}

crudRoutes(router, '/sessions',    TrainingSession)
crudRoutes(router, '/batches',     TrainingBatch)
crudRoutes(router, '/attendance',  TrainingAttendance)
crudRoutes(router, '/resources',   TrainingResource)
crudRoutes(router, '/assessments', TrainingAssessment)
crudRoutes(router, '/certs',       TrainingCert)
crudRoutes(router, '/feedback',    TrainingFeedback)
crudRoutes(router, '/trainees',    TrainingTrainee)

module.exports = router
