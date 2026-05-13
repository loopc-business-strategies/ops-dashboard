const express = require('express')
const { protect } = require('../middleware/auth')
const DepartmentState = require('../models/DepartmentState')

const router = express.Router()

const normalize = (value = '') => String(value).trim().toLowerCase()
const allowedModules = ['finance', 'compliance', 'training']

const canAccessModule = (user, module) => {
  if (!user) return false
  if (user.role === 'super_admin' || user.role === 'management') return true

  const dept = normalize(user.department)
  if (module === 'finance') return dept === 'finance'
  if (module === 'compliance') return dept === 'government' || dept === 'compliance'
  if (module === 'training') return dept === 'hr' || dept === 'training'
  return false
}

router.get('/:module', protect, async (req, res) => {
  try {
    const module = normalize(req.params.module)
    if (!allowedModules.includes(module)) {
      return res.status(400).json({ success: false, message: 'Unsupported module.' })
    }

    if (!canAccessModule(req.user, module)) {
      return res.status(403).json({ success: false, message: 'Access denied for this module.' })
    }

    const row = await DepartmentState.findOne({ module }).lean()
    res.json({ success: true, module, state: row?.state || null, updatedAt: row?.updatedAt || null })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load module state.' })
  }
})

router.put('/:module', protect, async (req, res) => {
  try {
    const module = normalize(req.params.module)
    if (!allowedModules.includes(module)) {
      return res.status(400).json({ success: false, message: 'Unsupported module.' })
    }

    if (!canAccessModule(req.user, module)) {
      return res.status(403).json({ success: false, message: 'Access denied for this module.' })
    }

    const state = req.body?.state
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      return res.status(400).json({ success: false, message: 'State payload is required.' })
    }

    const row = await DepartmentState.findOneAndUpdate(
      { module },
      {
        $set: {
          module,
          state,
          updatedById: req.user._id,
          updatedByName: req.user.name,
        },
      },
      { upsert: true, returnDocument: 'after' }
    )

    res.json({ success: true, module, state: row.state, updatedAt: row.updatedAt })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to save module state.' })
  }
})

module.exports = router

