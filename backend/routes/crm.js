// FILE: backend/routes/crm.js
// CRM routes — Contacts, Companies, Leads, Deals, Activities, Follow-ups

const express = require('express')
const fs = require('fs')
const path = require('path')
const multer = require('multer')
const { protect } = require('../middleware/auth')
const { Joi, validateBody, validateParams, validateQuery } = require('../middleware/validate')
const { escapeRegex } = require('../utils/escapeRegex')
const CrmContact  = require('../models/CrmContact')
const CrmCompany  = require('../models/CrmCompany')
const CrmLead     = require('../models/CrmLead')
const CrmDeal     = require('../models/CrmDeal')
const CrmActivity = require('../models/CrmActivity')
const { resolveUploadDir } = require('../services/erpAccounting/uploadMiddleware')

const {
  canViewCrm,
  canEditCrm,
  canDeleteCrm,
  isSalesRep,
  isSalesHead,
} = require('../services/permissions/moduleAccessPolicy')

const router = express.Router()
router.use(protect)

// ─── Joi Schemas ────────────────────────────────────────────────────────────
const LEAD_STAGES = ['Prospect', 'Contacted', 'Qualified', 'Proposal', 'Negotiating', 'Closed Won', 'Closed Lost']
const DEAL_STAGES = [...LEAD_STAGES]
const idParam = Joi.object({ id: Joi.string().hex().length(24).required() })

const activitiesListQuerySchema = Joi.object({
  contactId: Joi.string().hex().length(24).optional(),
})

const kycPatchSchema = Joi.object({
  status:         Joi.string().valid('Not Started', 'In Progress', 'Verified', 'Expired').optional(),
  riskRating:     Joi.string().valid('Low', 'Medium', 'High').optional(),
  nextReview:     Joi.string().trim().allow('').max(30).optional(),
  amlClear:       Joi.boolean().optional(),
  pepClear:       Joi.boolean().optional(),
  sanctionsClear: Joi.boolean().optional(),
})

const nextActionPatchSchema = Joi.object({
  description: Joi.string().trim().allow('').max(500).optional(),
  dueDate:     Joi.alternatives().try(Joi.date(), Joi.string().allow('')).optional(),
  assignedTo:  Joi.string().trim().allow('').max(120).optional(),
  isDone:      Joi.boolean().optional(),
})

const scorePatchSchema = Joi.object({
  companyFit:  Joi.number().min(0).max(25).optional(),
  budgetMatch: Joi.number().min(0).max(25).optional(),
  timeline:    Joi.number().min(0).max(25).optional(),
  engagement:  Joi.number().min(0).max(25).optional(),
})

const contactCreateSchema = Joi.object({
  firstName:      Joi.string().trim().min(1).max(80).required(),
  lastName:       Joi.string().trim().min(1).max(80).required(),
  email:          Joi.string().email({ tlds: { allow: false } }).allow('').optional(),
  phone:          Joi.string().trim().allow('').max(30).optional(),
  jobTitle:       Joi.string().trim().allow('').max(120).optional(),
  companyName:    Joi.string().trim().allow('').max(200).optional(),
  companyId:      Joi.string().hex().length(24).allow('', null).optional(),
  contactType:    Joi.string().trim().allow('').max(50).optional(),
  country:        Joi.string().trim().allow('').max(80).optional(),
  city:           Joi.string().trim().allow('').max(80).optional(),
  status:         Joi.string().trim().allow('').max(50).optional(),
  assignedRep:    Joi.string().trim().allow('').max(120).optional(),
  leadSource:     Joi.string().trim().allow('').max(80).optional(),
  estDealValue:   Joi.number().min(0).optional(),
  volumeTargetKg: Joi.number().min(0).optional(),
  paymentTerms:   Joi.string().trim().allow('').max(60).optional(),
  priority:       Joi.string().valid('Low', 'Medium', 'High').optional(),
  tags:           Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
  kyc:            kycPatchSchema.optional(),
})

const contactPatchSchema = Joi.object({
  firstName:      Joi.string().trim().min(1).max(80).optional(),
  lastName:       Joi.string().trim().min(1).max(80).optional(),
  email:          Joi.string().email({ tlds: { allow: false } }).allow('').optional(),
  phone:          Joi.string().trim().allow('').max(30).optional(),
  whatsApp:       Joi.string().trim().allow('').max(30).optional(),
  jobTitle:       Joi.string().trim().allow('').max(120).optional(),
  companyName:    Joi.string().trim().allow('').max(200).optional(),
  companyId:      Joi.string().hex().length(24).allow('', null).optional(),
  contactType:    Joi.string().trim().allow('').max(50).optional(),
  country:        Joi.string().trim().allow('').max(80).optional(),
  city:           Joi.string().trim().allow('').max(80).optional(),
  website:        Joi.string().trim().allow('').max(200).optional(),
  industry:       Joi.string().trim().allow('').max(100).optional(),
  status:         Joi.string().trim().allow('').max(50).optional(),
  assignedRep:    Joi.string().trim().allow('').max(120).optional(),
  leadSource:     Joi.string().trim().allow('').max(80).optional(),
  estDealValue:   Joi.number().min(0).optional(),
  volumeTargetKg: Joi.number().min(0).optional(),
  paymentTerms:   Joi.string().trim().allow('').max(60).optional(),
  priority:       Joi.string().valid('Low', 'Medium', 'High').optional(),
  tags:           Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
  kyc:            kycPatchSchema.optional(),
}).min(1)

const companyCreateSchema = Joi.object({
  name:        Joi.string().trim().min(1).max(200).required(),
  type:        Joi.string().trim().allow('').max(80).optional(),
  country:     Joi.string().trim().allow('').max(80).optional(),
  city:        Joi.string().trim().allow('').max(80).optional(),
  website:     Joi.string().uri({ allowRelative: true }).allow('').optional(),
  industry:    Joi.string().trim().allow('').max(100).optional(),
  status:      Joi.string().trim().allow('').max(50).optional(),
  riskRating:  Joi.string().valid('Low', 'Medium', 'High').optional(),
  notes:       Joi.string().trim().allow('').max(2000).optional(),
})

const companyPatchSchema = Joi.object({
  name:        Joi.string().trim().min(1).max(200).optional(),
  type:        Joi.string().trim().allow('').max(80).optional(),
  country:     Joi.string().trim().allow('').max(80).optional(),
  city:        Joi.string().trim().allow('').max(80).optional(),
  website:     Joi.string().uri({ allowRelative: true }).allow('').optional(),
  industry:    Joi.string().trim().allow('').max(100).optional(),
  status:      Joi.string().trim().allow('').max(50).optional(),
  riskRating:  Joi.string().valid('Low', 'Medium', 'High').optional(),
  notes:       Joi.string().trim().allow('').max(2000).optional(),
}).min(1)

const leadCreateSchema = Joi.object({
  name:               Joi.string().trim().min(1).max(200).required(),
  contactId:          Joi.string().hex().length(24).allow('', null).optional(),
  contactName:        Joi.string().trim().allow('').max(200).optional(),
  companyName:        Joi.string().trim().allow('').max(200).optional(),
  source:             Joi.string().trim().allow('').max(80).optional(),
  stage:              Joi.string().valid(...LEAD_STAGES).optional(),
  assignedRep:        Joi.string().trim().allow('').max(120).optional(),
  estValueUSD:        Joi.number().min(0).optional(),
  volumeKg:           Joi.number().min(0).optional(),
  probability:        Joi.number().min(0).max(100).optional(),
  expectedCloseDate:  Joi.string().allow('', null).optional(),
  temperature:        Joi.string().valid('Cold', 'Warm', 'Hot', 'Very Hot').optional(),
  score:              Joi.object().optional(),
  nextAction:         Joi.object().optional(),
  stageHistory:       Joi.array().optional(),
})

const leadPatchSchema = Joi.object({
  name:               Joi.string().trim().min(1).max(200).optional(),
  contactId:          Joi.string().hex().length(24).allow('', null).optional(),
  contactName:        Joi.string().trim().allow('').max(200).optional(),
  companyName:        Joi.string().trim().allow('').max(200).optional(),
  source:             Joi.string().trim().allow('').max(80).optional(),
  stage:              Joi.string().valid(...LEAD_STAGES).optional(),
  assignedRep:        Joi.string().trim().allow('').max(120).optional(),
  estValueUSD:        Joi.number().min(0).optional(),
  volumeKg:           Joi.number().min(0).optional(),
  probability:        Joi.number().min(0).max(100).optional(),
  expectedCloseDate:  Joi.alternatives().try(Joi.date(), Joi.string().allow('')).optional(),
  temperature:        Joi.string().valid('Cold', 'Warm', 'Hot', 'Very Hot').optional(),
  score:              scorePatchSchema.optional(),
  nextAction:         nextActionPatchSchema.optional(),
  lostReason:         Joi.string().trim().allow('').max(500).optional(),
  closedDate:         Joi.alternatives().try(Joi.date(), Joi.string().allow('')).optional(),
}).min(1)

const stageSchema = Joi.object({
  stage: Joi.string().valid(...LEAD_STAGES).required(),
  note:  Joi.string().trim().allow('').max(500).optional(),
})

const dealCreateSchema = Joi.object({
  name:              Joi.string().trim().min(1).max(200).required(),
  companyName:       Joi.string().trim().allow('').max(200).optional(),
  companyId:         Joi.string().hex().length(24).allow('', null).optional(),
  contactName:       Joi.string().trim().allow('').max(200).optional(),
  contactId:         Joi.string().hex().length(24).allow('', null).optional(),
  stage:             Joi.string().valid(...DEAL_STAGES).optional(),
  assignedRep:       Joi.string().trim().allow('').max(120).optional(),
  volumeKg:          Joi.number().min(0).optional(),
  valueUSD:          Joi.number().min(0).optional(),
  probability:       Joi.number().min(0).max(100).optional(),
  paymentTerms:      Joi.string().trim().allow('').max(60).optional(),
  expectedCloseDate: Joi.string().allow('', null).optional(),
  nextAction:        Joi.object().optional(),
  stageHistory:      Joi.array().optional(),
})

const dealPatchSchema = Joi.object({
  name:              Joi.string().trim().min(1).max(200).optional(),
  companyName:       Joi.string().trim().allow('').max(200).optional(),
  companyId:         Joi.string().hex().length(24).allow('', null).optional(),
  contactName:       Joi.string().trim().allow('').max(200).optional(),
  contactId:         Joi.string().hex().length(24).allow('', null).optional(),
  stage:             Joi.string().valid(...DEAL_STAGES).optional(),
  assignedRep:       Joi.string().trim().allow('').max(120).optional(),
  volumeKg:          Joi.number().min(0).optional(),
  valueUSD:          Joi.number().min(0).optional(),
  probability:       Joi.number().min(0).max(100).optional(),
  quotedPricePerKg:  Joi.number().min(0).optional(),
  paymentTerms:      Joi.string().trim().allow('').max(60).optional(),
  expectedPaymentDate: Joi.alternatives().try(Joi.date(), Joi.string().allow('')).optional(),
  expectedCloseDate: Joi.alternatives().try(Joi.date(), Joi.string().allow('')).optional(),
  nextAction:        nextActionPatchSchema.optional(),
}).min(1)

const closeSchema = Joi.object({
  outcome:        Joi.string().valid('won', 'lost').required(),
  finalValue:     Joi.number().min(0).optional(),
  closeDate:      Joi.string().allow('', null).optional(),
  contractSigned: Joi.boolean().optional(),
  reason:         Joi.string().trim().allow('').max(500).optional(),
  competitor:     Joi.string().trim().allow('').max(200).optional(),
  notes:          Joi.string().trim().allow('').max(2000).optional(),
})

const noteSchema = Joi.object({
  text:      Joi.string().trim().min(1).max(2000).required(),
  isPrivate: Joi.boolean().optional(),
})

const activityCreateSchema = Joi.object({
  type:       Joi.string().trim().min(1).max(80).required(),
  contactId:  Joi.string().hex().length(24).allow('', null).optional(),
  contactName:Joi.string().trim().allow('').max(200).optional(),
  companyName:Joi.string().trim().allow('').max(200).optional(),
  date:       Joi.string().allow('', null).optional(),
  duration:   Joi.number().min(0).optional(),
  notes:      Joi.string().trim().allow('').max(5000).optional(),
  outcome:    Joi.string().trim().allow('').max(50).optional(),
  assignedRep:Joi.string().trim().allow('').max(120).optional(),
  nextAction: Joi.object().optional(),
})

const activityPatchSchema = Joi.object({
  type:        Joi.string().trim().min(1).max(80).optional(),
  contactId:   Joi.string().hex().length(24).allow('', null).optional(),
  contactName: Joi.string().trim().allow('').max(200).optional(),
  companyName: Joi.string().trim().allow('').max(200).optional(),
  date:        Joi.alternatives().try(Joi.date(), Joi.string().allow('')).optional(),
  duration:    Joi.number().min(0).optional(),
  durationMin: Joi.number().min(0).optional(),
  subject:     Joi.string().trim().min(1).max(200).optional(),
  notes:       Joi.string().trim().allow('').max(5000).optional(),
  outcome:     Joi.string().trim().allow('').max(50).optional(),
  assignedRep: Joi.string().trim().allow('').max(120).optional(),
  nextAction:  nextActionPatchSchema.optional(),
  isPrivate:   Joi.boolean().optional(),
}).min(1)

const contactDocParam = Joi.object({
  id: Joi.string().hex().length(24).required(),
  docId: Joi.string().hex().length(24).required(),
})
// ────────────────────────────────────────────────────────────────────────────

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
})

const contactDocDir = resolveUploadDir('CRM_CONTACT_UPLOAD_DIR', 'crm-contacts')
const ALLOWED_DOC_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
])
const docFileFilter = (req, file, cb) => {
  if (ALLOWED_DOC_MIME_TYPES.has(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Only images (JPEG, PNG, GIF, WebP, SVG) and PDF files are allowed.'), false)
  }
}
const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(contactDocDir)) fs.mkdirSync(contactDocDir, { recursive: true })
    cb(null, contactDocDir)
  },
  filename: (req, file, cb) => {
    const safe = String(file.originalname || 'document').replace(/[^a-zA-Z0-9._-]/g, '_')
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safe}`)
  },
})
const docUpload = multer({ storage: docStorage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: docFileFilter })

const csvEscape = (value) => {
  const text = value == null ? '' : String(value)
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

const toCsv = (rows, headers) => {
  const lines = [headers.join(',')]
  rows.forEach((row) => {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','))
  })
  return lines.join('\n')
}

const sendTemplateCsv = (res, filename, headers) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(toCsv([], headers))
}

const parseCsvLine = (line) => {
  const values = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"'
        i += 1
      } else {
        quoted = !quoted
      }
    } else if (ch === ',' && !quoted) {
      values.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  values.push(cur)
  return values.map((v) => v.trim())
}

const parseCsvBuffer = (buffer) => {
  const raw = String(buffer || '').replace(/\r/g, '')
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return []
  const headers = parseCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    const out = {}
    headers.forEach((h, idx) => { out[h] = values[idx] || '' })
    return out
  })
}

async function ensureCrmSeedData(user) {
  const existing = await Promise.all([
    CrmContact.countDocuments({ isDeleted: false }),
    CrmCompany.countDocuments({ isDeleted: false }),
    CrmLead.countDocuments({ isDeleted: false }),
    CrmDeal.countDocuments({ isDeleted: false }),
  ])
  if (existing.some((count) => count > 0)) return

  const now = new Date()
  const inDays = (n) => {
    const d = new Date(now)
    d.setDate(d.getDate() + n)
    return d
  }

  const [kazGold, dubaiCommodities, tashkentTrade] = await CrmCompany.create([
    { name: 'KazGold Distributors', type: 'Partner', country: 'Kazakhstan', city: 'Almaty', industry: 'Precious Metals', status: 'Active', riskRating: 'Low', createdBy: user._id },
    { name: 'Dubai Commodity House', type: 'Customer', country: 'UAE', city: 'Dubai', industry: 'Commodity Trading', status: 'Negotiating', riskRating: 'Medium', createdBy: user._id },
    { name: 'Tashkent Trading Co', type: 'Prospect', country: 'Uzbekistan', city: 'Tashkent', industry: 'Gold Distribution', status: 'Contacted', riskRating: 'Medium', createdBy: user._id },
  ])

  const [c1, c2, c3] = await CrmContact.create([
    {
      firstName: 'Nursultan',
      lastName: 'Abenov',
      email: 'nursultan@kazgold.example',
      jobTitle: 'Director',
      companyName: kazGold.name,
      companyId: kazGold._id,
      contactType: 'Partner',
      country: 'Kazakhstan',
      city: 'Almaty',
      status: 'Active',
      assignedRep: user.name,
      leadSource: 'Referral',
      estDealValue: 120000,
      volumeTargetKg: 80,
      paymentTerms: 'Net 30',
      priority: 'High',
      createdBy: user._id,
      notes: [{ text: 'Strong existing partnership.', author: user.name }],
      kyc: { status: 'Verified', riskRating: 'Low', amlClear: true, pepClear: true, sanctionsClear: true },
    },
    {
      firstName: 'Khalid',
      lastName: 'Al-Rashid',
      email: 'khalid@dch.example',
      jobTitle: 'Procurement Head',
      companyName: dubaiCommodities.name,
      companyId: dubaiCommodities._id,
      contactType: 'Customer',
      country: 'UAE',
      city: 'Dubai',
      status: 'Negotiating',
      assignedRep: user.name,
      leadSource: 'Exhibition',
      estDealValue: 95000,
      volumeTargetKg: 60,
      paymentTerms: 'Net 15',
      priority: 'High',
      createdBy: user._id,
      notes: [{ text: 'Awaiting final commercial terms.', author: user.name }],
      kyc: { status: 'In Progress', riskRating: 'Medium' },
    },
    {
      firstName: 'Dilnoza',
      lastName: 'Yusupova',
      email: 'dilnoza@tashkenttrade.example',
      jobTitle: 'General Manager',
      companyName: tashkentTrade.name,
      companyId: tashkentTrade._id,
      contactType: 'Prospect',
      country: 'Uzbekistan',
      city: 'Tashkent',
      status: 'Contacted',
      assignedRep: user.name,
      leadSource: 'LinkedIn',
      estDealValue: 60000,
      volumeTargetKg: 45,
      paymentTerms: 'Net 30',
      priority: 'Medium',
      createdBy: user._id,
      notes: [{ text: 'Positive first call completed.', author: user.name }],
      kyc: { status: 'Not Started', riskRating: 'Medium' },
    },
  ])

  const [l1, l2, l3] = await CrmLead.create([
    {
      name: 'KazGold Q3 Expansion',
      contactId: c1._id,
      contactName: `${c1.firstName} ${c1.lastName}`,
      companyName: kazGold.name,
      source: 'Referral',
      stage: 'Qualified',
      assignedRep: user.name,
      estValueUSD: 120000,
      volumeKg: 80,
      probability: 70,
      expectedCloseDate: inDays(25),
      score: { companyFit: 24, budgetMatch: 22, timeline: 20, engagement: 22 },
      temperature: 'Very Hot',
      nextAction: { description: 'Send updated annual contract', dueDate: inDays(2), assignedTo: user.name },
      stageHistory: [{ stage: 'Qualified', date: now, by: user.name }],
      createdBy: user._id,
    },
    {
      name: 'Dubai Commodity Annual Deal',
      contactId: c2._id,
      contactName: `${c2.firstName} ${c2.lastName}`,
      companyName: dubaiCommodities.name,
      source: 'Exhibition',
      stage: 'Negotiating',
      assignedRep: user.name,
      estValueUSD: 95000,
      volumeKg: 60,
      probability: 65,
      expectedCloseDate: inDays(15),
      score: { companyFit: 22, budgetMatch: 19, timeline: 16, engagement: 20 },
      temperature: 'Hot',
      nextAction: { description: 'Legal review with buyer team', dueDate: inDays(1), assignedTo: user.name },
      stageHistory: [{ stage: 'Negotiating', date: now, by: user.name }],
      createdBy: user._id,
    },
    {
      name: 'Tashkent Intro Opportunity',
      contactId: c3._id,
      contactName: `${c3.firstName} ${c3.lastName}`,
      companyName: tashkentTrade.name,
      source: 'LinkedIn',
      stage: 'Contacted',
      assignedRep: user.name,
      estValueUSD: 60000,
      volumeKg: 45,
      probability: 45,
      expectedCloseDate: inDays(40),
      score: { companyFit: 17, budgetMatch: 13, timeline: 10, engagement: 12 },
      temperature: 'Warm',
      nextAction: { description: 'Share compliance package', dueDate: inDays(4), assignedTo: user.name },
      stageHistory: [{ stage: 'Contacted', date: now, by: user.name }],
      createdBy: user._id,
    },
  ])

  await CrmDeal.create([
    {
      name: 'KazGold Renewal 2026',
      contactName: `${c1.firstName} ${c1.lastName}`,
      contactId: c1._id,
      companyName: kazGold.name,
      companyId: kazGold._id,
      leadId: l1._id,
      stage: 'Proposal',
      assignedRep: user.name,
      volumeKg: 80,
      valueUSD: 120000,
      probability: 72,
      paymentTerms: 'Net 30',
      expectedCloseDate: inDays(21),
      nextAction: { description: 'Finalize proposal pricing', dueDate: inDays(2), assignedTo: user.name },
      stageHistory: [{ stage: 'Proposal', date: now, by: user.name }],
      createdBy: user._id,
    },
    {
      name: 'Dubai Commodity House Q2',
      contactName: `${c2.firstName} ${c2.lastName}`,
      contactId: c2._id,
      companyName: dubaiCommodities.name,
      companyId: dubaiCommodities._id,
      leadId: l2._id,
      stage: 'Negotiating',
      assignedRep: user.name,
      volumeKg: 60,
      valueUSD: 95000,
      probability: 65,
      paymentTerms: 'Net 15',
      expectedCloseDate: inDays(13),
      nextAction: { description: 'Commercial negotiation call', dueDate: inDays(1), assignedTo: user.name },
      stageHistory: [{ stage: 'Negotiating', date: now, by: user.name }],
      createdBy: user._id,
    },
    {
      name: 'Tashkent Pilot Shipment',
      contactName: `${c3.firstName} ${c3.lastName}`,
      contactId: c3._id,
      companyName: tashkentTrade.name,
      companyId: tashkentTrade._id,
      leadId: l3._id,
      stage: 'Qualified',
      assignedRep: user.name,
      volumeKg: 30,
      valueUSD: 52000,
      probability: 48,
      paymentTerms: 'Net 30',
      expectedCloseDate: inDays(33),
      nextAction: { description: 'Draft pilot shipment terms', dueDate: inDays(5), assignedTo: user.name },
      stageHistory: [{ stage: 'Qualified', date: now, by: user.name }],
      createdBy: user._id,
    },
  ])

  await CrmActivity.create([
    {
      type: 'Call',
      contactId: c1._id,
      contactName: `${c1.firstName} ${c1.lastName}`,
      date: inDays(-2),
      durationMin: 35,
      subject: 'Quarterly volume review',
      outcome: 'Positive',
      notes: 'Counterparty confirmed stable demand for Q3.',
      nextAction: { description: 'Send revised contract', dueDate: inDays(-1), assignedTo: user.name, isDone: false },
      createdBy: user._id,
      createdByName: user.name,
    },
    {
      type: 'Meeting',
      contactId: c2._id,
      contactName: `${c2.firstName} ${c2.lastName}`,
      date: inDays(-1),
      durationMin: 50,
      subject: 'Deal negotiation session',
      outcome: 'Follow-up needed',
      notes: 'Buyer requested adjusted payment milestone.',
      nextAction: { description: 'Share revised payment schedule', dueDate: inDays(0), assignedTo: user.name, isDone: false },
      createdBy: user._id,
      createdByName: user.name,
    },
    {
      type: 'Email',
      contactId: c3._id,
      contactName: `${c3.firstName} ${c3.lastName}`,
      date: inDays(-3),
      durationMin: 10,
      subject: 'Compliance package sent',
      outcome: 'Neutral',
      notes: 'Awaiting confirmation from legal team.',
      nextAction: { description: 'Follow up on legal review', dueDate: inDays(3), assignedTo: user.name, isDone: false },
      createdBy: user._id,
      createdByName: user.name,
    },
  ])
}

// ── Role helpers ────────────────────────────────────────────────────────────
const canView = canViewCrm
const canEdit = canEditCrm
const canDelete = canDeleteCrm

function salesOnly(req, res, next) {
  if (!canView(req.user)) return res.status(403).json({ success: false, message: 'Access denied — Sales module only.' })
  next()
}

function salesEditOnly(req, res, next) {
  if (!canView(req.user)) return res.status(403).json({ success: false, message: 'Access denied — Sales module only.' })
  if (!canEdit(req.user)) return res.status(403).json({ success: false, message: 'Sales Head or above required to modify CRM records.' })
  next()
}

function resolveContactDocumentPath(relativePath) {
  const normalized = String(relativePath || '').replace(/^\//, '')
  if (!normalized.startsWith('uploads/crm-contacts/')) return null
  const filename = path.basename(normalized)
  if (!filename || filename.includes('..')) return null
  const filePath = path.resolve(contactDocDir, filename)
  if (!filePath.startsWith(contactDocDir)) return null
  return filePath
}

// ─── DASHBOARD STATS ────────────────────────────────────────────────────────
router.get('/dashboard', salesOnly, async (req, res) => {
  try {
    await ensureCrmSeedData(req.user)

    const now   = new Date()
    const bom   = new Date(now.getFullYear(), now.getMonth(), 1)
    const eom   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const repFilter = isSalesRep(req.user) && !isSalesHead(req.user)
      ? { assignedRep: req.user.name } : {}

    const [totalContacts, activeLeads, hotLeads, deals, activities] = await Promise.all([
      CrmContact.countDocuments({ isDeleted: false, ...repFilter }),
      CrmLead.countDocuments({ isDeleted: false, stage: { $nin: ['Closed Won','Closed Lost'] }, ...repFilter }),
      CrmLead.countDocuments({ isDeleted: false, temperature: { $in: ['Hot','Very Hot'] }, stage: { $nin: ['Closed Won','Closed Lost'] }, ...repFilter }),
      CrmDeal.find({ isDeleted: false, ...repFilter }),
      CrmActivity.find({ isDeleted: false, 'nextAction.isDone': false, 'nextAction.dueDate': { $lt: now }, ...repFilter }),
    ])

    const dealsClosedWon    = deals.filter(d => d.stage === 'Closed Won').length
    const pipelineValue     = deals.filter(d => !['Closed Won','Closed Lost'].includes(d.stage)).reduce((s, d) => s + (d.valueUSD || 0), 0)
    const totalDeals        = deals.length
    const wonDeals          = deals.filter(d => d.stage === 'Closed Won').length
    const winRate           = totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0
    const overdueFollowups  = activities.length
    const revenueThisMonth  = deals.filter(d => d.stage === 'Closed Won' && d.closedWon?.closeDate >= bom && d.closedWon?.closeDate <= eom)
                                   .reduce((s, d) => s + (d.closedWon?.finalValue || d.valueUSD || 0), 0)

    res.json({ success: true, data: { totalContacts, activeLeads, hotLeads, dealsClosedWon, pipelineValue, winRate, overdueFollowups, revenueThisMonth } })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ─── CSV TEMPLATES ──────────────────────────────────────────────────────────
router.get('/templates/contacts', salesOnly, async (req, res) => {
  sendTemplateCsv(res, 'crm-contacts-template.csv', [
    'firstName',
    'lastName',
    'email',
    'phone',
    'companyName',
    'contactType',
    'country',
    'city',
    'assignedRep',
    'status',
    'leadSource',
    'estDealValue',
    'volumeTargetKg',
    'paymentTerms',
    'priority',
    'tags',
  ])
})

router.get('/templates/companies', salesOnly, async (req, res) => {
  sendTemplateCsv(res, 'crm-companies-template.csv', [
    'name',
    'type',
    'country',
    'city',
    'website',
    'industry',
    'status',
    'riskRating',
    'notes',
  ])
})

router.get('/templates/deals', salesOnly, async (req, res) => {
  sendTemplateCsv(res, 'crm-deals-template.csv', [
    'name',
    'companyName',
    'contactName',
    'stage',
    'assignedRep',
    'volumeKg',
    'valueUSD',
    'probability',
    'paymentTerms',
    'expectedCloseDate',
  ])
})

// ─── CONTACTS ───────────────────────────────────────────────────────────────
router.get('/contacts/export', salesOnly, async (req, res) => {
  try {
    const filter = { isDeleted: false }
    if (isSalesRep(req.user) && !isSalesHead(req.user)) filter.assignedRep = req.user.name
    const contacts = await CrmContact.find(filter).sort({ createdAt: -1 })
    const rows = contacts.map((c) => ({
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      companyName: c.companyName,
      contactType: c.contactType,
      country: c.country,
      city: c.city,
      assignedRep: c.assignedRep,
      status: c.status,
      leadSource: c.leadSource,
      estDealValue: c.estDealValue,
      volumeTargetKg: c.volumeTargetKg,
      paymentTerms: c.paymentTerms,
      priority: c.priority,
      tags: (c.tags || []).join('|'),
    }))
    const headers = ['firstName', 'lastName', 'email', 'phone', 'companyName', 'contactType', 'country', 'city', 'assignedRep', 'status', 'leadSource', 'estDealValue', 'volumeTargetKg', 'paymentTerms', 'priority', 'tags']
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="crm-contacts.csv"')
    res.send(toCsv(rows, headers))
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.post('/contacts/import', salesEditOnly, csvUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'CSV file is required.' })
    const rows = parseCsvBuffer(req.file.buffer)
    if (!rows.length) return res.status(400).json({ success: false, message: 'CSV has no data rows.' })
    const docs = rows.map((r) => ({
      firstName: r.firstName || r.first_name || '',
      lastName: r.lastName || r.last_name || '',
      email: r.email || '',
      phone: r.phone || '',
      companyName: r.companyName || r.company || '',
      contactType: r.contactType || 'Prospect',
      country: r.country || '',
      city: r.city || '',
      assignedRep: r.assignedRep || req.user.name,
      status: r.status || 'Prospect',
      leadSource: r.leadSource || '',
      estDealValue: Number(r.estDealValue || 0),
      volumeTargetKg: Number(r.volumeTargetKg || 0),
      paymentTerms: r.paymentTerms || 'Net 30',
      priority: r.priority || 'Medium',
      tags: String(r.tags || '').split('|').map((x) => x.trim()).filter(Boolean),
      createdBy: req.user._id,
      isDeleted: false,
    })).filter((r) => r.firstName && r.lastName)
    if (!docs.length) return res.status(400).json({ success: false, message: 'No valid rows found (firstName and lastName required).' })
    const inserted = await CrmContact.insertMany(docs)
    res.json({ success: true, imported: inserted.length })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
})

router.get('/contacts', salesOnly, async (req, res) => {
  try {
    const { type, status, rep, search } = req.query
    const filter = { isDeleted: false }
    if (isSalesRep(req.user) && !isSalesHead(req.user)) filter.assignedRep = req.user.name
    if (type   && type !== 'All')   filter.contactType = type
    if (status && status !== 'All') filter.status = status
    if (rep    && rep !== 'All')    filter.assignedRep = rep
    if (search) {
      const regex = new RegExp(escapeRegex(String(search).trim()), 'i')
      filter.$or = [
      { firstName: regex }, { lastName: regex },
      { email: regex }, { companyName: regex },
    ]
    }
    const contacts = await CrmContact.find(filter).sort({ createdAt: -1 })
    res.json({ success: true, data: contacts })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.post('/contacts', salesEditOnly, validateBody(contactCreateSchema), async (req, res) => {
  try {
    const contact = await CrmContact.create({ ...req.body, createdBy: req.user._id })
    res.status(201).json({ success: true, data: contact })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
})

router.put('/contacts/:id', salesEditOnly, validateParams(idParam), validateBody(contactPatchSchema), async (req, res) => {
  try {
    const contact = await CrmContact.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: req.body },
      { returnDocument: 'after', runValidators: true }
    )
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found.' })
    res.json({ success: true, data: contact })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
})

router.delete('/contacts/:id', salesOnly, async (req, res) => {
  try {
    if (!canDelete(req.user)) return res.status(403).json({ success: false, message: 'Only Super Admin can delete contacts.' })
    await CrmContact.findByIdAndUpdate(req.params.id, { isDeleted: true })
    res.json({ success: true, message: 'Contact deleted.' })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.post('/contacts/:id/notes', salesEditOnly, validateParams(idParam), validateBody(noteSchema), async (req, res) => {
  try {
    const { text, isPrivate } = req.body
    if (!text) return res.status(400).json({ success: false, message: 'Note text is required.' })
    const contact = await CrmContact.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $push: { notes: { text, author: req.user.name, isPrivate: !!isPrivate } } },
      { returnDocument: 'after' }
    )
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found.' })
    res.json({ success: true, data: contact })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.post('/contacts/:id/documents', salesEditOnly, docUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'File is required.' })
    const contact = await CrmContact.findOne({ _id: req.params.id, isDeleted: false })
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found.' })

    const relativePath = `/uploads/crm-contacts/${req.file.filename}`
    const newDoc = {
      name: req.file.originalname,
      status: req.body.status || 'Pending',
      verifiedDate: req.body.verifiedDate || '',
      relativePath,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date(),
      uploadedByName: req.user.name,
    }

    contact.kyc = contact.kyc || {}
    contact.kyc.documents = contact.kyc.documents || []
    contact.kyc.documents.push(newDoc)
    await contact.save()

    res.status(201).json({ success: true, data: contact })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
})

router.delete('/contacts/:id/documents/:docId', salesEditOnly, async (req, res) => {
  try {
    const contact = await CrmContact.findOne({ _id: req.params.id, isDeleted: false })
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found.' })

    const docs = contact.kyc?.documents || []
    const doc = docs.find((d) => String(d._id) === String(req.params.docId))
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' })

    if (doc.relativePath) {
      const filePath = resolveContactDocumentPath(doc.relativePath)
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath)
    }

    contact.kyc = contact.kyc || {}
    contact.kyc.documents = docs.filter((d) => String(d._id) !== String(req.params.docId))
    await contact.save()

    res.json({ success: true, data: contact })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.get('/contacts/:id/documents/:docId/download', salesOnly, validateParams(contactDocParam), async (req, res) => {
  try {
    const contact = await CrmContact.findOne({ _id: req.params.id, isDeleted: false })
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found.' })

    const docs = contact.kyc?.documents || []
    const doc = docs.find((d) => String(d._id) === String(req.params.docId))
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' })

    const filePath = resolveContactDocumentPath(doc.relativePath)
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found.' })
    }

    if (doc.mimeType) res.setHeader('Content-Type', doc.mimeType)
    const downloadName = String(doc.name || 'document').replace(/"/g, '')
    res.setHeader('Content-Disposition', `inline; filename="${downloadName}"`)
    return res.sendFile(filePath)
  } catch (e) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── COMPANIES ──────────────────────────────────────────────────────────────
router.get('/companies/export', salesOnly, async (req, res) => {
  try {
    const companies = await CrmCompany.find({ isDeleted: false }).sort({ name: 1 })
    const rows = companies.map((c) => ({
      name: c.name,
      type: c.type,
      country: c.country,
      city: c.city,
      website: c.website,
      industry: c.industry,
      status: c.status,
      riskRating: c.riskRating,
      notes: c.notes,
    }))
    const headers = ['name', 'type', 'country', 'city', 'website', 'industry', 'status', 'riskRating', 'notes']
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="crm-companies.csv"')
    res.send(toCsv(rows, headers))
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.post('/companies/import', salesEditOnly, csvUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'CSV file is required.' })
    const rows = parseCsvBuffer(req.file.buffer)
    if (!rows.length) return res.status(400).json({ success: false, message: 'CSV has no data rows.' })
    const docs = rows.map((r) => ({
      name: r.name || '',
      type: r.type || 'Prospect',
      country: r.country || '',
      city: r.city || '',
      website: r.website || '',
      industry: r.industry || '',
      status: r.status || 'Prospect',
      riskRating: r.riskRating || 'Medium',
      notes: r.notes || '',
      createdBy: req.user._id,
      isDeleted: false,
    })).filter((r) => r.name)
    if (!docs.length) return res.status(400).json({ success: false, message: 'No valid rows found (name required).' })
    const inserted = await CrmCompany.insertMany(docs)
    res.json({ success: true, imported: inserted.length })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
})

router.get('/companies', salesOnly, async (req, res) => {
  try {
    const companies = await CrmCompany.find({ isDeleted: false }).sort({ name: 1 })
    // Enrich with contact/deal counts
    const enriched = await Promise.all(companies.map(async (co) => {
      const [contacts, deals] = await Promise.all([
        CrmContact.countDocuments({ isDeleted: false, companyId: co._id }),
        CrmDeal.find({ isDeleted: false, companyId: co._id }, 'valueUSD stage'),
      ])
      const totalValue = deals.reduce((s, d) => s + (d.valueUSD || 0), 0)
      return { ...co.toObject(), contactCount: contacts, dealCount: deals.length, totalValue }
    }))
    res.json({ success: true, data: enriched })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.post('/companies', salesEditOnly, validateBody(companyCreateSchema), async (req, res) => {
  try {
    const co = await CrmCompany.create({ ...req.body, createdBy: req.user._id })
    res.status(201).json({ success: true, data: co })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
})

router.put('/companies/:id', salesEditOnly, validateParams(idParam), validateBody(companyPatchSchema), async (req, res) => {
  try {
    const co = await CrmCompany.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: req.body },
      { returnDocument: 'after', runValidators: true }
    )
    if (!co) return res.status(404).json({ success: false, message: 'Company not found.' })
    res.json({ success: true, data: co })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
})

router.delete('/companies/:id', salesOnly, async (req, res) => {
  try {
    if (!canDelete(req.user)) return res.status(403).json({ success: false, message: 'Only Super Admin can delete companies.' })
    await CrmCompany.findByIdAndUpdate(req.params.id, { isDeleted: true })
    res.json({ success: true, message: 'Company deleted.' })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ─── LEADS ──────────────────────────────────────────────────────────────────
router.get('/leads', salesOnly, async (req, res) => {
  try {
    const filter = { isDeleted: false }
    if (isSalesRep(req.user) && !isSalesHead(req.user)) filter.assignedRep = req.user.name
    const leads = await CrmLead.find(filter).sort({ createdAt: -1 })
    res.json({ success: true, data: leads })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.post('/leads', salesEditOnly, validateBody(leadCreateSchema), async (req, res) => {
  try {
    const body = { ...req.body, createdBy: req.user._id }
    if (!body.stageHistory) {
      body.stageHistory = [{ stage: body.stage || 'Prospect', date: new Date(), by: req.user.name }]
    }
    const lead = await CrmLead.create(body)
    res.status(201).json({ success: true, data: lead })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
})

router.put('/leads/:id', salesEditOnly, validateParams(idParam), validateBody(leadPatchSchema), async (req, res) => {
  try {
    const lead = await CrmLead.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: req.body },
      { returnDocument: 'after', runValidators: true }
    )
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found.' })
    res.json({ success: true, data: lead })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
})

router.post('/leads/:id/stage', salesEditOnly, validateParams(idParam), validateBody(stageSchema), async (req, res) => {
  try {
    const { stage, note } = req.body
    const lead = await CrmLead.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      {
        $set:  { stage },
        $push: { stageHistory: { stage, date: new Date(), note: note || '', by: req.user.name } },
      },
      { returnDocument: 'after' }
    )
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found.' })
    res.json({ success: true, data: lead })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
})

router.delete('/leads/:id', salesOnly, async (req, res) => {
  try {
    if (!canDelete(req.user)) return res.status(403).json({ success: false, message: 'Only Super Admin can delete leads.' })
    await CrmLead.findByIdAndUpdate(req.params.id, { isDeleted: true })
    res.json({ success: true, message: 'Lead deleted.' })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ─── DEALS ──────────────────────────────────────────────────────────────────
router.get('/deals/export', salesOnly, async (req, res) => {
  try {
    const filter = { isDeleted: false }
    if (isSalesRep(req.user) && !isSalesHead(req.user)) filter.assignedRep = req.user.name
    const deals = await CrmDeal.find(filter).sort({ createdAt: -1 })
    const rows = deals.map((d) => ({
      name: d.name,
      companyName: d.companyName,
      contactName: d.contactName,
      stage: d.stage,
      assignedRep: d.assignedRep,
      volumeKg: d.volumeKg,
      valueUSD: d.valueUSD,
      probability: d.probability,
      paymentTerms: d.paymentTerms,
      expectedCloseDate: d.expectedCloseDate ? new Date(d.expectedCloseDate).toISOString().slice(0, 10) : '',
    }))
    const headers = ['name', 'companyName', 'contactName', 'stage', 'assignedRep', 'volumeKg', 'valueUSD', 'probability', 'paymentTerms', 'expectedCloseDate']
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="crm-deals.csv"')
    res.send(toCsv(rows, headers))
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.post('/deals/import', salesEditOnly, csvUpload.single('file'), async (req, res) => {
  try {
    if (!canEdit(req.user)) return res.status(403).json({ success: false, message: 'Sales Head or above required to import deals.' })
    if (!req.file) return res.status(400).json({ success: false, message: 'CSV file is required.' })
    const rows = parseCsvBuffer(req.file.buffer)
    if (!rows.length) return res.status(400).json({ success: false, message: 'CSV has no data rows.' })

    const companies = await CrmCompany.find({ isDeleted: false }, 'name _id')
    const contacts = await CrmContact.find({ isDeleted: false }, 'firstName lastName _id')
    const companyMap = new Map(companies.map((c) => [String(c.name || '').toLowerCase(), c._id]))
    const contactMap = new Map(contacts.map((c) => [`${c.firstName} ${c.lastName}`.toLowerCase(), c._id]))

    const docs = rows.map((r) => {
      const companyName = r.companyName || ''
      const contactName = r.contactName || ''
      const companyId = companyMap.get(companyName.toLowerCase())
      const contactId = contactMap.get(contactName.toLowerCase())
      return {
        name: r.name || '',
        companyName,
        companyId,
        contactName,
        contactId,
        stage: r.stage || 'Prospect',
        assignedRep: r.assignedRep || req.user.name,
        volumeKg: Number(r.volumeKg || 0),
        valueUSD: Number(r.valueUSD || 0),
        probability: Number(r.probability || 0),
        paymentTerms: r.paymentTerms || 'Net 30',
        expectedCloseDate: r.expectedCloseDate ? new Date(r.expectedCloseDate) : null,
        nextAction: { description: 'Imported from CSV', assignedTo: r.assignedRep || req.user.name },
        stageHistory: [{ stage: r.stage || 'Prospect', date: new Date(), by: req.user.name, note: 'Imported via CSV' }],
        createdBy: req.user._id,
        isDeleted: false,
      }
    }).filter((r) => r.name)

    if (!docs.length) return res.status(400).json({ success: false, message: 'No valid rows found (name required).' })
    const inserted = await CrmDeal.insertMany(docs)
    res.json({ success: true, imported: inserted.length })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
})

router.get('/deals', salesOnly, async (req, res) => {
  try {
    const filter = { isDeleted: false }
    if (isSalesRep(req.user) && !isSalesHead(req.user)) filter.assignedRep = req.user.name
    const deals = await CrmDeal.find(filter).sort({ createdAt: -1 })
    res.json({ success: true, data: deals })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.post('/deals', salesEditOnly, validateBody(dealCreateSchema), async (req, res) => {
  try {
    const body = { ...req.body, createdBy: req.user._id }
    if (!body.stageHistory) {
      body.stageHistory = [{ stage: body.stage || 'Prospect', date: new Date(), by: req.user.name }]
    }
    const deal = await CrmDeal.create(body)
    res.status(201).json({ success: true, data: deal })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
})

router.put('/deals/:id', salesEditOnly, validateParams(idParam), validateBody(dealPatchSchema), async (req, res) => {
  try {
    const deal = await CrmDeal.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: req.body },
      { returnDocument: 'after', runValidators: true }
    )
    if (!deal) return res.status(404).json({ success: false, message: 'Deal not found.' })
    res.json({ success: true, data: deal })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
})

router.post('/deals/:id/close', salesEditOnly, validateParams(idParam), validateBody(closeSchema), async (req, res) => {
  try {
    const { outcome, finalValue, closeDate, contractSigned, reason, competitor, notes: lostNotes } = req.body
    const newStage = outcome === 'won' ? 'Closed Won' : 'Closed Lost'
    const update = {
      stage:        newStage,
      $push: { stageHistory: { stage: newStage, date: new Date(), by: req.user.name, note: outcome === 'won' ? 'Deal closed — won' : `Lost — ${reason}` } },
    }
    if (outcome === 'won') update.closedWon = { finalValue, closeDate: new Date(closeDate), contractSigned: !!contractSigned }
    else                   update.closedLost = { reason, competitor, notes: lostNotes }

    const deal = await CrmDeal.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      update,
      { returnDocument: 'after' }
    )
    if (!deal) return res.status(404).json({ success: false, message: 'Deal not found.' })
    res.json({ success: true, data: deal })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
})

router.delete('/deals/:id', salesOnly, async (req, res) => {
  try {
    if (!canDelete(req.user)) return res.status(403).json({ success: false, message: 'Only Super Admin can delete deals.' })
    await CrmDeal.findByIdAndUpdate(req.params.id, { isDeleted: true })
    res.json({ success: true, message: 'Deal deleted.' })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ─── ACTIVITIES ──────────────────────────────────────────────────────────────
router.get('/activities', salesOnly, validateQuery(activitiesListQuerySchema), async (req, res) => {
  try {
    const filter = { isDeleted: false }
    if (isSalesRep(req.user) && !isSalesHead(req.user)) filter.createdBy = req.user._id
    if (req.query.contactId) filter.contactId = req.query.contactId
    const activities = await CrmActivity.find(filter).sort({ date: -1 }).limit(200)
    res.json({ success: true, data: activities })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.post('/activities', salesEditOnly, validateBody(activityCreateSchema), async (req, res) => {
  try {
    const activity = await CrmActivity.create({
      ...req.body,
      createdBy:     req.user._id,
      createdByName: req.user.name,
    })
    res.status(201).json({ success: true, data: activity })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
})

router.put('/activities/:id', salesEditOnly, validateParams(idParam), validateBody(activityPatchSchema), async (req, res) => {
  try {
    const act = await CrmActivity.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: req.body },
      { returnDocument: 'after' }
    )
    if (!act) return res.status(404).json({ success: false, message: 'Activity not found.' })
    res.json({ success: true, data: act })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
})

router.delete('/activities/:id', salesOnly, async (req, res) => {
  try {
    await CrmActivity.findByIdAndUpdate(req.params.id, { isDeleted: true })
    res.json({ success: true, message: 'Activity deleted.' })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.patch('/activities/:id/followup-done', salesEditOnly, async (req, res) => {
  try {
    const act = await CrmActivity.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: { 'nextAction.isDone': true } },
      { returnDocument: 'after' }
    )
    if (!act) return res.status(404).json({ success: false, message: 'Activity not found.' })
    res.json({ success: true, data: act })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ─── FOLLOW-UPS ──────────────────────────────────────────────────────────────
router.get('/followups', salesOnly, async (req, res) => {
  try {
    const filter = {
      isDeleted: false,
      'nextAction.description': { $exists: true, $ne: '' },
      'nextAction.isDone': false,
    }
    if (isSalesRep(req.user) && !isSalesHead(req.user)) filter['nextAction.assignedTo'] = req.user.name
    const followups = await CrmActivity.find(filter).sort({ 'nextAction.dueDate': 1 }).limit(100)
    res.json({ success: true, data: followups })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

module.exports = router

