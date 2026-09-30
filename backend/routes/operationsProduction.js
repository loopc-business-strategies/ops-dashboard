const express = require('express')
const Joi = require('joi')
const { protect } = require('../middleware/auth')
const { validateBody, validateQuery, validateParams } = require('../middleware/validate')
const { requireProductionPermission } = require('../services/productionControl/permissions')
const OperationsProductionEntry = require('../models/OperationsProductionEntry')
const { PRODUCTION_DEPARTMENT_KEYS: DEPARTMENT_KEYS } = require('../constants/productionDepartments')

const router = express.Router()

const idParam = Joi.object({ id: Joi.string().hex().length(24).required() })

const dateKeySchema = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)

const entryBodySchema = Joi.object({
  departmentKey: Joi.string().valid(...DEPARTMENT_KEYS).required(),
  batchNumber: Joi.string().allow('', null).max(120),
  metalIn: Joi.number().min(0).allow(null),
  metalOut: Joi.number().min(0).allow(null),
  metalLoss: Joi.number().min(0).allow(null),
  purity: Joi.number().min(0).max(100).allow(null),
  purityOut: Joi.number().min(0).max(100).allow(null),
  employeeName: Joi.string().allow('', null).max(200),
  departmentManagerName: Joi.string().allow('', null).max(200),
  batchStartedAt: Joi.alternatives().try(Joi.date().iso(), Joi.string().allow('', null), Joi.valid(null)),
  batchOverAt: Joi.alternatives().try(Joi.date().iso(), Joi.string().allow('', null), Joi.valid(null)),
  rating: Joi.string().allow('', null).max(80),
  breakdown: Joi.string().allow('', null).max(2000),
  requests: Joi.string().allow('', null).max(2000),
  date: dateKeySchema.required(),
}).unknown(false)

const entryPatchSchema = entryBodySchema.fork(
  ['departmentKey', 'date'],
  (s) => s.optional(),
)

const listQuerySchema = Joi.object({
  department: Joi.string().valid(...DEPARTMENT_KEYS).allow('', null),
  departmentKey: Joi.string().valid(...DEPARTMENT_KEYS).allow('', null),
  dateFrom: dateKeySchema.allow('', null),
  dateTo: dateKeySchema.allow('', null),
  date: dateKeySchema.allow('', null),
  limit: Joi.number().integer().min(1).max(500),
  skip: Joi.number().integer().min(0),
  includeCount: Joi.alternatives().try(Joi.boolean(), Joi.string(), Joi.number()),
}).unknown(true)

function handleError(res, err) {
  const status = err.status || 500
  if (status >= 500) console.error('[operations-production]', err)
  return res.status(status).json({ success: false, message: err.message || 'Operations production error' })
}

function toNumOrNull(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function parseOptionalDate(v) {
  if (v == null || v === '') return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isFinite(d.getTime()) ? d : null
}

function computeMetalLoss(metalIn, metalOut, explicit) {
  const inn = toNumOrNull(metalIn)
  const out = toNumOrNull(metalOut)
  if (explicit != null && explicit !== '') {
    const e = toNumOrNull(explicit)
    if (e != null) return Math.max(0, e)
  }
  if (inn != null && out != null) return Math.max(0, inn - out)
  return null
}

function computeFineGold(metalIn, purity) {
  const inn = toNumOrNull(metalIn)
  const p = toNumOrNull(purity)
  if (inn == null || p == null) return null
  return Math.round(inn * p * 10) / 1000
}

/** Fields a user may still edit on rows written by MG Floor approvals. */
const MG_FLOOR_EDITABLE_FIELDS = ['rating', 'breakdown', 'requests']

function normalizePayload(body, { partial = false } = {}) {
  const out = {}
  if (!partial || body.departmentKey !== undefined) {
    out.departmentKey = String(body.departmentKey || '').trim()
  }
  if (!partial || body.batchNumber !== undefined) {
    out.batchNumber = String(body.batchNumber || '').trim()
  }
  if (!partial || body.metalIn !== undefined) {
    out.metalIn = toNumOrNull(body.metalIn)
  }
  if (!partial || body.metalOut !== undefined) {
    out.metalOut = toNumOrNull(body.metalOut)
  }
  if (!partial || body.purity !== undefined) {
    out.purity = toNumOrNull(body.purity)
  }
  if (!partial || body.purityOut !== undefined) {
    out.purityOut = toNumOrNull(body.purityOut)
  }
  if (!partial || body.employeeName !== undefined) {
    out.employeeName = String(body.employeeName || '').trim()
  }
  if (!partial || body.departmentManagerName !== undefined) {
    out.departmentManagerName = String(body.departmentManagerName || '').trim()
  }
  if (!partial || body.batchStartedAt !== undefined) {
    out.batchStartedAt = parseOptionalDate(body.batchStartedAt)
  }
  if (!partial || body.batchOverAt !== undefined) {
    out.batchOverAt = parseOptionalDate(body.batchOverAt)
  }
  if (!partial || body.rating !== undefined) {
    out.rating = String(body.rating || '').trim()
  }
  if (!partial || body.breakdown !== undefined) {
    out.breakdown = String(body.breakdown || '').trim()
  }
  if (!partial || body.requests !== undefined) {
    out.requests = String(body.requests || '').trim()
  }
  if (!partial || body.date !== undefined) {
    out.date = String(body.date || '').trim()
  }

  const lossSource = body.metalLoss
  const inn = out.metalIn !== undefined ? out.metalIn : toNumOrNull(body.metalIn)
  const mout = out.metalOut !== undefined ? out.metalOut : toNumOrNull(body.metalOut)
  if (!partial || body.metalLoss !== undefined || body.metalIn !== undefined || body.metalOut !== undefined) {
    out.metalLoss = computeMetalLoss(inn, mout, lossSource)
  }
  return out
}

router.use(protect)

router.get(
  '/',
  requireProductionPermission('view'),
  validateQuery(listQuerySchema),
  async (req, res) => {
    try {
      const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200))
      const skip = Math.max(0, Number(req.query.skip) || 0)
      const includeCount = req.query.includeCount === '1'
        || req.query.includeCount === 1
        || req.query.includeCount === true

      const filter = {}
      const dept = String(req.query.department || req.query.departmentKey || '').trim()
      if (dept) filter.departmentKey = dept

      const dateExact = String(req.query.date || '').trim()
      const dateFrom = String(req.query.dateFrom || '').trim()
      const dateTo = String(req.query.dateTo || '').trim()
      if (dateExact) {
        filter.date = dateExact
      } else if (dateFrom || dateTo) {
        filter.date = {}
        if (dateFrom) filter.date.$gte = dateFrom
        if (dateTo) filter.date.$lte = dateTo
      }

      const rows = await OperationsProductionEntry.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit + 1)
        .lean()

      const hasMore = rows.length > limit
      const entries = hasMore ? rows.slice(0, limit) : rows
      let total
      if (includeCount) {
        total = await OperationsProductionEntry.countDocuments(filter)
      } else {
        total = skip + entries.length + (hasMore ? 1 : 0)
      }

      res.json({ success: true, entries, items: entries, total, hasMore, limit, skip })
    } catch (err) {
      handleError(res, err)
    }
  },
)

router.post(
  '/',
  requireProductionPermission('createBatch'),
  validateBody(entryBodySchema),
  async (req, res) => {
    try {
      const data = normalizePayload(req.body)
      if (!DEPARTMENT_KEYS.includes(data.departmentKey)) {
        return res.status(400).json({ success: false, message: 'Invalid departmentKey' })
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date || '')) {
        return res.status(400).json({ success: false, message: 'date must be YYYY-MM-DD' })
      }

      const doc = await OperationsProductionEntry.create({
        ...data,
        fineGold: computeFineGold(data.metalIn, data.purity),
        fineGoldOut: computeFineGold(data.metalOut, data.purityOut),
        source: 'manual',
        createdById: req.user?._id || null,
        createdByName: String(req.user?.name || '').trim(),
      })
      res.status(201).json({ success: true, entry: doc.toObject ? doc.toObject() : doc })
    } catch (err) {
      handleError(res, err)
    }
  },
)

router.patch(
  '/:id',
  requireProductionPermission('createBatch'),
  validateParams(idParam),
  validateBody(entryPatchSchema),
  async (req, res) => {
    try {
      const existing = await OperationsProductionEntry.findById(req.params.id)
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Entry not found' })
      }

      if (existing.source === 'mg_floor') {
        const locked = Object.keys(req.body || {}).filter((k) => !MG_FLOOR_EDITABLE_FIELDS.includes(k))
        if (locked.length) {
          return res.status(409).json({
            success: false,
            code: 'MG_FLOOR_ROW_LOCKED',
            message: `This row comes from an approved MG Floor batch; only ${MG_FLOOR_EDITABLE_FIELDS.join(', ')} can be edited`,
          })
        }
        Object.assign(existing, normalizePayload(req.body, { partial: true }))
        await existing.save()
        return res.json({ success: true, entry: existing.toObject() })
      }

      const data = normalizePayload(
        {
          departmentKey: existing.departmentKey,
          metalIn: existing.metalIn,
          metalOut: existing.metalOut,
          metalLoss: existing.metalLoss,
          ...req.body,
        },
        { partial: true },
      )

      Object.assign(existing, data)
      // Recompute loss when metals change
      existing.metalLoss = computeMetalLoss(
        existing.metalIn,
        existing.metalOut,
        req.body.metalLoss !== undefined ? req.body.metalLoss : existing.metalLoss,
      )
      existing.fineGold = computeFineGold(existing.metalIn, existing.purity)
      existing.fineGoldOut = computeFineGold(existing.metalOut, existing.purityOut)
      await existing.save()
      res.json({ success: true, entry: existing.toObject() })
    } catch (err) {
      handleError(res, err)
    }
  },
)

router.delete(
  '/:id',
  requireProductionPermission('createBatch'),
  validateParams(idParam),
  async (req, res) => {
    try {
      const existing = await OperationsProductionEntry.findById(req.params.id)
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Entry not found' })
      }
      if (existing.source === 'mg_floor') {
        return res.status(409).json({
          success: false,
          code: 'MG_FLOOR_ROW_LOCKED',
          message: 'Rows from approved MG Floor batches cannot be deleted',
        })
      }
      await existing.deleteOne()
      res.json({ success: true, deleted: true, id: req.params.id })
    } catch (err) {
      handleError(res, err)
    }
  },
)

module.exports = router
