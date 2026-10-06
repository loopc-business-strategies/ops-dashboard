// FILE: backend/routes/websiteEnquiries.js
// Website enquiries — one record per website submission, shared by the Sales and Procurement views.

const express = require('express')
const rateLimit = require('express-rate-limit')
const { protect } = require('../middleware/auth')
const { Joi, validateBody, validateParams, validateQuery } = require('../middleware/validate')
const { escapeRegex } = require('../utils/escapeRegex')
const { timingSafeEqualString } = require('../utils/timingSafeEqualString')
const { normalizeTenant } = require('../config/tenants')
const {
  ENQUIRY_STATUSES,
  ENQUIRY_TYPES,
  ENQUIRY_TYPE_CODES,
  resolveEnquiryType,
} = require('../utils/websiteEnquiryConstants')
const WebsiteEnquiry = require('../models/WebsiteEnquiry')
const User = require('../models/User')
const { sendWebsiteEnquiryNotification } = require('../services/websiteEnquiryEmail')
const {
  canViewCrm,
  canViewOperationsModule,
  resolveModuleAccess,
  userDept,
} = require('../services/permissions/moduleAccessPolicy')

const router = express.Router()

const isProduction = process.env.NODE_ENV === 'production'
const ASSIGNEE_DEPARTMENTS = ['sales', 'operations', 'management']
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9-]{8,100}$/
const OPTIONAL_TEXT_FIELDS = ['company', 'email', 'requirement', 'message']

const submitLimiter = rateLimit({
  windowMs: Number(process.env.WEBSITE_ENQUIRY_RATE_LIMIT_WINDOW_MS || 60 * 1000),
  max: Number(process.env.WEBSITE_ENQUIRY_RATE_LIMIT_MAX || 60),
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction,
  message: { success: false, message: 'Too many enquiry submissions. Please try again later.' },
})

// ─── Access ─────────────────────────────────────────────────────────────────

function canViewProcurement(user) {
  return canViewOperationsModule(user)
    || resolveModuleAccess(user, 'procurement-plus', (subject) => userDept(subject) === 'operations')
}

function canViewEnquiries(user) {
  return canViewCrm(user) || canViewProcurement(user)
}

function canEditEnquiries(user) {
  return canViewEnquiries(user) && user?.role !== 'external'
}

function viewOnly(req, res, next) {
  if (!canViewEnquiries(req.user)) {
    return res.status(403).json({ success: false, message: 'Access denied — Sales or Procurement access required.' })
  }
  next()
}

function editOnly(req, res, next) {
  if (!canEditEnquiries(req.user)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to update website enquiries.' })
  }
  next()
}

// ─── Schemas ────────────────────────────────────────────────────────────────

const submitSchema = Joi.object({
  name:        Joi.string().trim().min(1).max(120).required(),
  phone:       Joi.string().trim().min(5).max(40).pattern(/^[0-9+()\-.\s]+$/).required(),
  enquiryType: Joi.string().valid(...Object.keys(ENQUIRY_TYPE_CODES), ...ENQUIRY_TYPES).default('sell_gold'),
  company:     Joi.string().trim().allow('').max(160),
  email:       Joi.string().trim().allow('').email({ tlds: { allow: false } }).max(200),
  requirement: Joi.string().trim().allow('').max(1000),
  message:     Joi.string().trim().allow('').max(3000),
  source:      Joi.string().valid('website').default('website'),
  status:      Joi.string().valid('new', 'NEW'),
})

const phoneDigits = (value) => String(value || '').replace(/\D/g, '')

const listQuerySchema = Joi.object({
  page:   Joi.number().integer().min(1).default(1),
  limit:  Joi.number().integer().min(1).max(200).default(50),
  status: Joi.string().valid(...ENQUIRY_STATUSES).optional(),
  search: Joi.string().trim().allow('').max(120).optional(),
})

const idParam = Joi.object({ id: Joi.string().hex().length(24).required() })

const statusSchema = Joi.object({
  status: Joi.string().valid(...ENQUIRY_STATUSES).required(),
  note:   Joi.string().trim().allow('').max(500).default(''),
})

const assignSchema = Joi.object({
  userId: Joi.alternatives().try(Joi.string().hex().length(24), Joi.string().valid('')).required(),
})

// ─── Public submission (server-to-server from the MG Website backend) ───────

router.post('/', submitLimiter, (req, res, next) => {
  const expectedToken = String(process.env.WEBSITE_ENQUIRY_TOKEN || '').trim()
  if (!expectedToken) {
    return res.status(503).json({ success: false, message: 'Website enquiries are not configured.' })
  }
  const token = String(req.headers['x-website-enquiry-token'] || '').trim()
  if (!token || !timingSafeEqualString(token, expectedToken)) {
    return res.status(401).json({ success: false, message: 'Invalid website enquiry token.' })
  }
  next()
}, validateBody(submitSchema), async (req, res) => {
  try {
    const tenant = normalizeTenant(process.env.WEBSITE_ENQUIRY_TENANT || 'mg')
    const TenantEnquiry = await WebsiteEnquiry.getTenantModel(tenant)

    const rawKey = String(req.headers['idempotency-key'] || '').trim()
    const idempotencyKey = IDEMPOTENCY_KEY_PATTERN.test(rawKey) ? rawKey : ''
    if (idempotencyKey) {
      const existing = await TenantEnquiry.findOne({ idempotencyKey }).select('_id').lean()
      if (existing) return res.status(200).json({ success: true, id: existing._id, duplicate: true })
    }

    const digits = phoneDigits(req.body.phone)
    const recent = await TenantEnquiry.find({
      source: 'website',
      isDeleted: { $ne: true },
      createdAt: { $gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    }).select('_id phone').sort({ createdAt: -1 }).limit(200).lean()
    const repeat = recent.find((row) => phoneDigits(row.phone) === digits)
    if (repeat) return res.status(200).json({ success: true, id: repeat._id, duplicate: true })

    const record = {
      name: req.body.name,
      phone: req.body.phone,
      enquiryType: resolveEnquiryType(req.body.enquiryType),
      source: 'website',
      status: 'NEW',
      statusHistory: [{ status: 'NEW', note: 'Submitted from website' }],
    }
    for (const field of OPTIONAL_TEXT_FIELDS) {
      if (req.body[field]) record[field] = req.body[field]
    }
    if (idempotencyKey) record.idempotencyKey = idempotencyKey

    const enquiry = await TenantEnquiry.create(record)

    sendWebsiteEnquiryNotification(enquiry).catch((err) => {
      console.error('[website-enquiries] notification email failed:', err.message)
    })

    res.status(201).json({ success: true, id: enquiry._id })
  } catch (err) {
    console.error('[website-enquiries] create failed:', err)
    res.status(500).json({ success: false, message: 'Unable to save enquiry.' })
  }
})

// ─── Dashboard (Sales + Procurement) ────────────────────────────────────────

router.get('/', protect, viewOnly, validateQuery(listQuerySchema), async (req, res) => {
  try {
    const { page, limit, status, search } = req.query
    const filter = { isDeleted: { $ne: true } }
    if (status) filter.status = status
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i')
      filter.$or = [{ name: rx }, { company: rx }, { email: rx }, { phone: rx }, { requirement: rx }]
    }
    const [data, total] = await Promise.all([
      WebsiteEnquiry.find(filter).select('-idempotencyKey').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      WebsiteEnquiry.countDocuments(filter),
    ])
    res.json({
      success: true,
      data,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      canEdit: canEditEnquiries(req.user),
    })
  } catch (err) {
    console.error('[website-enquiries] list failed:', err)
    res.status(500).json({ success: false, message: 'Unable to load website enquiries.' })
  }
})

router.get('/assignees', protect, viewOnly, async (req, res) => {
  try {
    const users = await User.find({
      isActive: true,
      isDeleted: { $ne: true },
      $or: [
        { department: { $in: ASSIGNEE_DEPARTMENTS } },
        { role: 'management' },
      ],
    }).select('name fullName department role').sort({ name: 1 }).limit(500).lean()
    res.json({
      success: true,
      data: users.map((u) => ({
        _id: u._id,
        name: u.fullName || u.name,
        department: u.department || '',
        role: u.role,
      })),
    })
  } catch (err) {
    console.error('[website-enquiries] assignees failed:', err)
    res.status(500).json({ success: false, message: 'Unable to load employees.' })
  }
})

router.patch('/:id/status', protect, editOnly, validateParams(idParam), validateBody(statusSchema), async (req, res) => {
  try {
    const enquiry = await WebsiteEnquiry.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found.' })
    if (enquiry.status !== req.body.status) {
      enquiry.status = req.body.status
      enquiry.statusHistory.push({
        status: req.body.status,
        note: req.body.note,
        by: req.user._id,
        byName: req.user.fullName || req.user.name,
      })
      await enquiry.save()
    }
    res.json({ success: true, data: enquiry })
  } catch (err) {
    console.error('[website-enquiries] status update failed:', err)
    res.status(500).json({ success: false, message: 'Unable to update status.' })
  }
})

router.patch('/:id/assign', protect, editOnly, validateParams(idParam), validateBody(assignSchema), async (req, res) => {
  try {
    const enquiry = await WebsiteEnquiry.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found.' })

    if (!req.body.userId) {
      enquiry.assignedTo = null
      enquiry.assignedToName = ''
    } else {
      const assignee = await User.findOne({
        _id: req.body.userId,
        isActive: true,
        isDeleted: { $ne: true },
      }).select('name fullName').lean()
      if (!assignee) return res.status(400).json({ success: false, message: 'Employee not found or inactive.' })
      enquiry.assignedTo = assignee._id
      enquiry.assignedToName = assignee.fullName || assignee.name
    }
    await enquiry.save()
    res.json({ success: true, data: enquiry })
  } catch (err) {
    console.error('[website-enquiries] assign failed:', err)
    res.status(500).json({ success: false, message: 'Unable to assign enquiry.' })
  }
})

module.exports = router
