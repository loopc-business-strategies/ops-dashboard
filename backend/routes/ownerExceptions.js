const express = require('express')
const { protect } = require('../middleware/auth')
const ProductionAlert = require('../models/ProductionAlert')
const ProductionBatch = require('../models/ProductionBatch')
const ProductionMachine = require('../models/ProductionMachine')
const { TrainingCert } = require('../models/TrainingModels')
const { isSuperAdmin } = require('../services/erpAccounting/accessPolicy')

const router = express.Router()

/**
 * Owner Exception Center — aggregates high-severity operational problems.
 * Read-only; does not mutate source records.
 */
router.get('/', protect, async (req, res) => {
  try {
    if (!(isSuperAdmin(req.user) || req.user?.role === 'management' || req.user?.productionRole === 'production_manager')) {
      // Still allow floor managers to see production exceptions
      const role = String(req.user?.role || '')
      if (!['department_head', 'super_admin', 'management'].includes(role)) {
        return res.status(403).json({ success: false, message: 'Forbidden' })
      }
    }

    const now = new Date()
    const exceptions = []

    const alerts = await ProductionAlert.find({
      status: { $in: ['OPEN', 'ACKNOWLEDGED'] },
      severity: { $in: ['warning', 'critical'] },
    }).sort({ createdAt: -1 }).limit(50).lean()

    for (const a of alerts) {
      exceptions.push({
        id: `alert:${a._id}`,
        type: a.code || 'production_alert',
        severity: a.severity,
        title: a.title,
        message: a.message,
        owner: a.raisedByName || '',
        status: a.status,
        createdAt: a.createdAt,
        href: '/production?section=alerts',
        entity: { kind: 'ProductionAlert', id: String(a._id) },
      })
    }

    const delayed = await ProductionBatch.find({
      status: { $in: ['IN_PROCESS', 'WAITING', 'HOLD', 'QC', 'QC_FAILED', 'REWORK'] },
      updatedAt: { $lt: new Date(now.getTime() - 24 * 3600 * 1000) },
    }).sort({ updatedAt: 1 }).limit(30).lean()

    for (const b of delayed) {
      exceptions.push({
        id: `delay:${b._id}`,
        type: 'production_delay',
        severity: 'warning',
        title: `Delayed batch ${b.batchNumber}`,
        message: `Status ${b.status} since ${b.updatedAt?.toISOString?.() || ''}`,
        owner: b.currentHolderName || '',
        status: 'OPEN',
        createdAt: b.updatedAt,
        href: `/production?batchId=${b._id}`,
        entity: { kind: 'ProductionBatch', id: String(b._id) },
      })
    }

    const downMachines = await ProductionMachine.find({
      isActive: { $ne: false },
      status: { $in: ['FAULT', 'MAINTENANCE', 'OFFLINE'] },
    }).limit(30).lean()

    for (const m of downMachines) {
      exceptions.push({
        id: `machine:${m._id}`,
        type: 'machine_breakdown',
        severity: m.status === 'FAULT' ? 'critical' : 'warning',
        title: `Machine ${m.machineCode || m.name}`,
        message: `Status ${m.status}`,
        owner: '',
        status: 'OPEN',
        createdAt: m.updatedAt,
        href: '/production?section=machines',
        entity: { kind: 'ProductionMachine', id: String(m._id) },
      })
    }

    let expiringCerts = []
    try {
      const in30 = new Date(now.getTime() + 30 * 86400000)
      expiringCerts = await TrainingCert.find({
        expiry: { $ne: null, $lte: in30 },
      }).limit(30).lean()
    } catch {
      expiringCerts = []
    }

    for (const c of expiringCerts) {
      exceptions.push({
        id: `cert:${c._id}`,
        type: 'training_expiry',
        severity: new Date(c.expiry) < now ? 'critical' : 'warning',
        title: `Training cert ${c.cert || c._id}`,
        message: `Expires ${c.expiry}`,
        owner: c.trainee || '',
        status: 'OPEN',
        createdAt: c.updatedAt || c.createdAt,
        href: '/dashboard?tab=training',
        entity: { kind: 'TrainingCert', id: String(c._id) },
      })
    }

    const severityRank = { critical: 0, warning: 1, info: 2 }
    exceptions.sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9))

    res.json({
      success: true,
      generatedAt: now.toISOString(),
      count: exceptions.length,
      exceptions,
    })
  } catch (err) {
    console.error('Owner exceptions error:', err)
    res.status(500).json({ success: false, message: 'Failed to load exceptions' })
  }
})

module.exports = router
