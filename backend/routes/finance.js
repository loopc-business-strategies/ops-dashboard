const express = require('express')
const { protect } = require('../middleware/auth')
const { Joi, validateBody, validateParams } = require('../middleware/validate')
const FinanceInvoice = require('../models/FinanceInvoice')
const FinanceExpense = require('../models/FinanceExpense')
const FinancePayroll = require('../models/FinancePayroll')
const FinanceBudget  = require('../models/FinanceBudget')
const FinanceTax     = require('../models/FinanceTax')

const router = express.Router()

// Only super_admin or finance/hr department heads may write finance records
const canWrite = (user) => {
  if (!user) return false
  if (user.role === 'super_admin') return true
  if (user.role === 'department_head') {
    const dept = String(user.department || '').toLowerCase()
    return dept === 'finance' || dept === 'hr'
  }
  return false
}

const idParam = Joi.object({ id: Joi.string().hex().length(24).required() })

const invoiceSchema = Joi.object({
  invoiceNo:   Joi.string().trim().allow('').max(60).optional(),
  client:      Joi.string().trim().min(1).max(200).required(),
  invoiceType: Joi.string().valid('Sales', 'Purchase').optional(),
  amount:      Joi.number().min(0).required(),
  issueDate:   Joi.string().trim().allow('').max(30).optional(),
  dueDate:     Joi.string().trim().allow('').max(30).optional(),
  status:      Joi.string().trim().allow('').max(30).optional(),
  daysOverdue: Joi.number().integer().min(0).optional(),
})

const expenseSchema = Joi.object({
  dept:       Joi.string().trim().allow('').max(80).optional(),
  cat:        Joi.string().trim().allow('').max(80).optional(),
  amount:     Joi.number().min(0).required(),
  date:       Joi.string().trim().allow('').max(30).optional(),
  by:         Joi.string().trim().allow('').max(120).optional(),
  status:     Joi.string().trim().allow('').max(30).optional(),
  approvedBy: Joi.string().trim().allow('').max(120).optional(),
  flagged:    Joi.boolean().optional(),
  desc:       Joi.string().trim().allow('').max(1000).optional(),
})

const payrollSchema = Joi.object({
  emp:    Joi.string().trim().min(1).max(120).required(),
  dept:   Joi.string().trim().allow('').max(80).optional(),
  role:   Joi.string().trim().allow('').max(80).optional(),
  basic:  Joi.number().min(0).optional(),
  allow:  Joi.number().min(0).optional(),
  ded:    Joi.number().min(0).optional(),
  net:    Joi.number().min(0).optional(),
  status: Joi.string().trim().allow('').max(30).optional(),
  date:   Joi.string().trim().allow('').max(30).optional(),
})

const budgetSchema = Joi.object({
  dept:   Joi.string().trim().min(1).max(120).required(),
  annual: Joi.number().min(0).required(),
  spent:  Joi.number().min(0).optional(),
  status: Joi.string().trim().allow('').max(30).optional(),
})

const taxSchema = Joi.object({
  type:   Joi.string().trim().min(1).max(100).required(),
  period: Joi.string().trim().min(1).max(60).required(),
  amount: Joi.number().min(0).required(),
  due:    Joi.string().trim().allow('').max(30).optional(),
  filed:  Joi.string().trim().allow('').max(30).optional(),
  status: Joi.string().trim().allow('').max(30).optional(),
})

const patchSchema = Joi.object({
  status:     Joi.string().trim().allow('').max(30).optional(),
  approvedBy: Joi.string().trim().allow('').max(120).optional(),
  daysOverdue:Joi.number().integer().min(0).optional(),
  filed:      Joi.string().trim().allow('').max(30).optional(),
  spent:      Joi.number().min(0).optional(),
}).unknown(true) // allow partial updates for the generic PUT

// ─── generic CRUD factory ──────────────────────────────────────
function crudRoutes(router, path, Model, createSchema) {
  // LIST
  router.get(path, protect, async (req, res) => {
    try {
      const TenantModel = await Model.getTenantModel(req.tenant)
      const rows = await TenantModel.find().sort({ createdAt: -1 }).limit(500).lean()
      res.json({ success: true, data: rows })
    } catch (err) {
      console.error('[finance] list error:', err)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  })

  // CREATE
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

  // UPDATE
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

  // DELETE
  router.delete(`${path}/:id`, protect, validateParams(idParam), async (req, res) => {
    if (req.user?.role !== 'super_admin') return res.status(403).json({ success: false, message: 'Only super admin can delete records.' })
    try {
      const TenantModel = await Model.getTenantModel(req.tenant)
      const doc = await TenantModel.findByIdAndDelete(req.params.id)
      if (!doc) return res.status(404).json({ success: false, message: 'Not found' })
      res.json({ success: true })
    } catch (err) {
      console.error('[finance] delete error:', err)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  })
}

crudRoutes(router, '/invoices',  FinanceInvoice,  invoiceSchema)
crudRoutes(router, '/expenses',  FinanceExpense,  expenseSchema)
crudRoutes(router, '/payroll',   FinancePayroll,  payrollSchema)
crudRoutes(router, '/budgets',   FinanceBudget,   budgetSchema)
crudRoutes(router, '/taxes',     FinanceTax,      taxSchema)

module.exports = router

