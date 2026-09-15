const express = require('express')
const Joi = require('joi')
const { protect } = require('../middleware/auth')
const { validateBody, validateQuery } = require('../middleware/validate')
const Customer = require('../models/Customer')
const Vendor = require('../models/Vendor')
const Employee = require('../models/Employee')
const Transaction = require('../models/Transaction')
const ProductionBatch = require('../models/ProductionBatch')
const ProductionStockLot = require('../models/ProductionStockLot')
const ProductionMachine = require('../models/ProductionMachine')
const WorkOrder = require('../models/WorkOrder')
const CrmContact = require('../models/CrmContact')
const InventoryItem = require('../models/InventoryItem')
const { canViewCustomers, canAccessVendors, canAccessOperationalTransactions, isSuperAdmin } = require('../services/erpAccounting/accessPolicy')
const { resolveModuleAccess, canViewCrm } = require('../services/permissions/moduleAccessPolicy')

const router = express.Router()

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function safeFind(Model, filter, projection, limit = 8) {
  try {
    return await Model.find(filter).select(projection).limit(limit).lean()
  } catch {
    return []
  }
}

router.get(
  '/',
  protect,
  validateQuery(Joi.object({
    q: Joi.string().trim().min(1).max(120).required(),
    limit: Joi.number().integer().min(1).max(20).default(8),
  })),
  async (req, res) => {
    try {
      const q = String(req.query.q || '').trim()
      const limit = Number(req.query.limit) || 8
      const re = new RegExp(escapeRegex(q), 'i')
      const results = []

      const push = (type, items, mapFn) => {
        for (const item of items) {
          results.push({ type, ...mapFn(item) })
        }
      }

      if (canViewCustomers(req.user) || isSuperAdmin(req.user)) {
        const customers = await safeFind(Customer, {
          isDeleted: { $ne: true },
          $or: [{ name: re }, { email: re }, { phone: re }],
        }, 'name email phone', limit)
        push('customer', customers, (c) => ({
          id: String(c._id),
          label: c.name,
          subtitle: c.email || c.phone || '',
          href: `/dashboard?tab=erp-customers&customerId=${c._id}`,
        }))
      }

      if (canAccessVendors(req.user) || isSuperAdmin(req.user)) {
        const vendors = await safeFind(Vendor, {
          isDeleted: { $ne: true },
          $or: [{ name: re }, { email: re }, { phone: re }],
        }, 'name email phone', limit)
        push('supplier', vendors, (v) => ({
          id: String(v._id),
          label: v.name,
          subtitle: v.email || v.phone || '',
          href: `/dashboard?tab=erp-vendors&vendorId=${v._id}`,
        }))
      }

      if (resolveModuleAccess(req.user, 'hr', () => true) || isSuperAdmin(req.user)) {
        const employees = await safeFind(Employee, {
          $or: [{ name: re }, { employeeCode: re }, { idNumber: re }, { email: re }],
        }, 'name employeeCode department email', limit)
        push('employee', employees, (e) => ({
          id: String(e._id),
          label: e.name,
          subtitle: [e.employeeCode, e.department].filter(Boolean).join(' · '),
          href: `/dashboard?tab=hr&employeeId=${e._id}`,
        }))
      }

      if (canViewCrm(req.user) || isSuperAdmin(req.user)) {
        const contacts = await safeFind(CrmContact, {
          $or: [{ firstName: re }, { lastName: re }, { email: re }, { companyName: re }],
        }, 'firstName lastName email companyName erpCustomerId', limit)
        push('crm_contact', contacts, (c) => ({
          id: String(c._id),
          label: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
          subtitle: c.companyName || c.email || '',
          href: `/dashboard?tab=sales&contactId=${c._id}`,
        }))
      }

      if (canAccessOperationalTransactions(req.user) || isSuperAdmin(req.user)) {
        const txs = await safeFind(Transaction, {
          isDeleted: { $ne: true },
          $or: [
            { description: re },
            { 'voucherMeta.vocNo': re },
            { 'voucherMeta.docNo': re },
          ],
        }, 'type status description voucherMeta amount', limit)
        push('voucher', txs, (t) => ({
          id: String(t._id),
          label: t.voucherMeta?.vocNo || t.description || t.type,
          subtitle: `${t.type} · ${t.status}`,
          href: `/dashboard?tab=vouchers&transactionId=${t._id}`,
        }))
      }

      const batches = await safeFind(ProductionBatch, {
        $or: [{ batchNumber: re }, { product: re }, { stockCode: re }],
      }, 'batchNumber status metalType product currentWeight', limit)
      push('batch', batches, (b) => ({
        id: String(b._id),
        label: b.batchNumber,
        subtitle: `${b.metalType || ''} ${b.status || ''}`.trim(),
        href: `/production?batchId=${b._id}`,
      }))

      const lots = await safeFind(ProductionStockLot, {
        $or: [{ stockCode: re }, { product: re }, { productCode: re }],
      }, 'stockCode status product netWeight', limit)
      push('stock_lot', lots, (l) => ({
        id: String(l._id),
        label: l.stockCode,
        subtitle: `${l.product || ''} · ${l.status}`,
        href: `/production?section=stock-overview&stockId=${l._id}`,
      }))

      const wos = await safeFind(WorkOrder, {
        $or: [{ woNumber: re }, { product: re }],
      }, 'woNumber status product', limit)
      push('work_order', wos, (w) => ({
        id: String(w._id),
        label: w.woNumber || String(w._id),
        subtitle: w.status || '',
        href: `/production?section=work-orders&woId=${w._id}`,
      }))

      const machines = await safeFind(ProductionMachine, {
        isActive: { $ne: false },
        $or: [{ machineCode: re }, { name: re }],
      }, 'machineCode name status department', limit)
      push('machine', machines, (m) => ({
        id: String(m._id),
        label: m.machineCode || m.name,
        subtitle: `${m.name || ''} · ${m.status || ''}`,
        href: `/production?section=machines&machineId=${m._id}`,
      }))

      const products = await safeFind(InventoryItem, {
        isDeleted: { $ne: true },
        $or: [{ name: re }, { sku: re }, { barcode: re }, { qrCode: re }],
      }, 'name sku barcode qrCode quantity unit', limit)
      push('product', products, (p) => ({
        id: String(p._id),
        label: p.name,
        subtitle: [p.sku, p.barcode || p.qrCode].filter(Boolean).join(' · '),
        href: `/dashboard?tab=operations&ops=inventory&itemId=${p._id}`,
      }))

      res.json({ success: true, query: q, results: results.slice(0, limit * 4) })
    } catch (err) {
      console.error('Global search error:', err)
      res.status(500).json({ success: false, message: 'Search failed' })
    }
  },
)

module.exports = router
