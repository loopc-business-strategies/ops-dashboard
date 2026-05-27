const express = require('express')
const InventoryItem = require('../models/InventoryItem')
const StockMovement = require('../models/StockMovement')
const Supplier = require('../models/Supplier')
const PurchaseOrder = require('../models/PurchaseOrder')
const WorkOrder = require('../models/WorkOrder')
const FinanceRecord = require('../models/FinanceRecord')
const ProcurementDoc = require('../models/ProcurementDoc')
const ExpiryAlert = require('../models/ExpiryAlert')
const { protect } = require('../middleware/auth')
const { Joi, validateBody, validateParams } = require('../middleware/validate')
const { softDeleteById } = require('../utils/softDelete')
const {
  isSuperAdmin,
  isDeptHead,
  isFinanceRole,
  canEditInventory,
  canViewInventoryCosts,
  canManageSuppliers,
  canCreatePO,
  canApprovePOBudget,
  canManageProduction,
  canManageLegacyErpFinance,
  canUploadProcDocs,
} = require('../services/permissions/moduleAccessPolicy')

const router = express.Router()

// ─── Joi Schemas ────────────────────────────────────────────────────────────
const idParam = Joi.object({ id: Joi.string().hex().length(24).required() })

const inventoryCreateSchema = Joi.object({
  type:            Joi.string().valid('raw', 'wip', 'finished', 'consumable').optional(),
  name:            Joi.string().trim().min(1).max(200).required(),
  sku:             Joi.string().trim().allow('').max(80).optional(),
  category:        Joi.string().trim().allow('').max(100).optional(),
  quantity:        Joi.number().min(0).optional(),
  unit:            Joi.string().trim().allow('').max(30).optional(),
  minThreshold:    Joi.number().min(0).optional(),
  unitCost:        Joi.number().min(0).optional(),
  supplierName:    Joi.string().trim().allow('').max(200).optional(),
  weight:          Joi.number().min(0).optional(),
  sellingPrice:    Joi.number().min(0).optional(),
  wipStage:        Joi.string().trim().allow('').max(80).optional(),
  lastRestockedAt: Joi.string().allow('', null).optional(),
})

const inventoryPatchSchema = Joi.object({
  type:            Joi.string().valid('raw', 'wip', 'finished', 'consumable').optional(),
  name:            Joi.string().trim().min(1).max(200).optional(),
  sku:             Joi.string().trim().allow('').max(80).optional(),
  category:        Joi.string().trim().allow('').max(100).optional(),
  quantity:        Joi.number().min(0).optional(),
  unit:            Joi.string().trim().allow('').max(30).optional(),
  minThreshold:    Joi.number().min(0).optional(),
  unitCost:        Joi.number().min(0).optional(),
  supplierName:    Joi.string().trim().allow('').max(200).optional(),
  weight:          Joi.number().min(0).optional(),
  sellingPrice:    Joi.number().min(0).optional(),
  wipStage:        Joi.string().trim().allow('').max(80).optional(),
  lastRestockedAt: Joi.string().allow('', null).optional(),
  reason:          Joi.string().trim().allow('').max(300).optional(),
}).min(1)

const supplierCreateSchema = Joi.object({
  name:         Joi.string().trim().min(1).max(200).required(),
  country:      Joi.string().trim().allow('').max(80).optional(),
  contact:      Joi.string().trim().allow('').max(120).optional(),
  productType:  Joi.string().trim().allow('').max(100).optional(),
  rating:       Joi.number().integer().min(1).max(5).optional(),
  paymentTerms: Joi.string().trim().allow('').max(60).optional(),
})

const supplierPatchSchema = Joi.object({
  name:         Joi.string().trim().min(1).max(200).optional(),
  country:      Joi.string().trim().allow('').max(80).optional(),
  contact:      Joi.string().trim().allow('').max(120).optional(),
  productType:  Joi.string().trim().allow('').max(100).optional(),
  rating:       Joi.number().integer().min(1).max(5).optional(),
  paymentTerms: Joi.string().trim().allow('').max(60).optional(),
}).min(1)

const poItemSchema = Joi.object({
  itemName:  Joi.string().trim().min(1).max(200).required(),
  quantity:  Joi.number().min(0).required(),
  unitPrice: Joi.number().min(0).required(),
})

const poCreateSchema = Joi.object({
  poNumber:             Joi.string().trim().min(1).max(80).required(),
  supplierId:           Joi.string().hex().length(24).required(),
  items:                Joi.array().items(poItemSchema).min(1).required(),
  expectedDeliveryDate: Joi.string().allow('', null).optional(),
  paymentTerms:         Joi.string().trim().allow('').max(60).optional(),
  status:               Joi.string().trim().allow('').max(30).optional(),
})

const poPatchSchema = Joi.object({}).unknown(true)

const workOrderCreateSchema = Joi.object({
  woNumber:        Joi.string().trim().min(1).max(80).required(),
  quantity:        Joi.number().min(1).optional(),
  stage:           Joi.string().valid('casting','filing','setting','polishing','quality','packaging').optional(),
  assignedTo:      Joi.string().trim().allow('').max(120).optional(),
  materialNeeded:  Joi.array().optional(),
  targetDate:      Joi.string().allow('', null).optional(),
})

const workOrderPatchSchema = Joi.object({}).unknown(true)
// ────────────────────────────────────────────────────────────────────────────

const ERP_PO_FINAL_APPROVAL_THRESHOLD = Number(process.env.ERP_PO_FINAL_APPROVAL_THRESHOLD || 50000)

const canManageFinance = canManageLegacyErpFinance

const parsePagination = (query, defaultLimit = 20, maxLimit = 100) => {
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || defaultLimit))
  const skip = (page - 1) * limit
  return { page, limit, skip }
}

const toInventoryResponse = (item, includeCostFields) => {
  const base = {
    _id: item._id,
    type: item.type,
    name: item.name,
    sku: item.sku,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    minThreshold: item.minThreshold,
    supplierName: item.supplierName,
    weight: item.weight,
    sellingPrice: item.sellingPrice,
    wipStage: item.wipStage,
    lastRestockedAt: item.lastRestockedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    isLowStock: item.quantity < item.minThreshold,
  }

  if (includeCostFields) {
    base.unitCost = item.unitCost
    base.inventoryValue = Number((item.quantity * item.unitCost).toFixed(2))
  }

  return base
}

const getPOAmount = (po) => (po.items || []).reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0)

router.get('/inventory', protect, async (req, res) => {
  try {
    const includeCostFields = canViewInventoryCosts(req.user)
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(50, Number(req.query.limit) || 20)
    const skip = (page - 1) * limit
    const search = String(req.query.search || '').trim().toLowerCase()
    const typeFilter = req.query.type
    const lowStockOnly = req.query.lowStockOnly === 'true'

    const query = { isDeleted: { $ne: true } }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { supplierName: { $regex: search, $options: 'i' } },
      ]
    }
    if (typeFilter) {
      query.type = typeFilter
    }
    if (lowStockOnly) {
      query.$expr = { $lt: ['$quantity', '$minThreshold'] }
    }

    const total = await InventoryItem.countDocuments(query)
    const items = await InventoryItem.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)

    res.json({
      success: true,
      count: items.length,
      total,
      page,
      limit,
      items: items.map((item) => toInventoryResponse(item, includeCostFields)),
      permissions: {
        canEdit: canEditInventory(req.user),
        canViewCosts: includeCostFields,
      },
    })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load inventory.' })
  }
})

router.post('/inventory', protect, validateBody(inventoryCreateSchema), async (req, res) => {
  try {
    if (!canEditInventory(req.user)) {
      return res.status(403).json({ success: false, message: 'Only Super Admin or Production Head can add inventory items.' })
    }

    const payload = {
      type: req.body.type,
      name: req.body.name,
      sku: req.body.sku,
      category: req.body.category,
      quantity: Number(req.body.quantity || 0),
      unit: req.body.unit,
      minThreshold: Number(req.body.minThreshold || 0),
      unitCost: Number(req.body.unitCost || 0),
      supplierName: req.body.supplierName,
      weight: Number(req.body.weight || 0),
      sellingPrice: Number(req.body.sellingPrice || 0),
      wipStage: req.body.wipStage,
      lastRestockedAt: req.body.lastRestockedAt || null,
    }

    if (!payload.name?.trim()) {
      return res.status(400).json({ success: false, message: 'Inventory item name is required.' })
    }

    const item = await InventoryItem.create(payload)

    await StockMovement.create({
      itemId: item._id,
      itemName: item.name,
      change: payload.quantity,
      quantityBefore: 0,
      quantityAfter: payload.quantity,
      reason: 'Initial stock entry',
      actorId: req.user._id,
      actorName: req.user.name,
    })

    res.status(201).json({ success: true, item: toInventoryResponse(item, true) })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to create inventory item.' })
  }
})

router.put('/inventory/:id', protect, validateParams(idParam), validateBody(inventoryPatchSchema), async (req, res) => {
  try {
    if (!canEditInventory(req.user)) {
      return res.status(403).json({ success: false, message: 'Only Super Admin or Production Head can edit inventory items.' })
    }

    const existing = await InventoryItem.findById(req.params.id)
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Inventory item not found.' })
    }

    const oldQty = Number(existing.quantity || 0)

    const update = {
      type: req.body.type ?? existing.type,
      name: req.body.name ?? existing.name,
      sku: req.body.sku ?? existing.sku,
      category: req.body.category ?? existing.category,
      quantity: req.body.quantity !== undefined ? Number(req.body.quantity) : oldQty,
      unit: req.body.unit ?? existing.unit,
      minThreshold: req.body.minThreshold !== undefined ? Number(req.body.minThreshold) : existing.minThreshold,
      unitCost: req.body.unitCost !== undefined ? Number(req.body.unitCost) : existing.unitCost,
      supplierName: req.body.supplierName ?? existing.supplierName,
      weight: req.body.weight !== undefined ? Number(req.body.weight) : existing.weight,
      sellingPrice: req.body.sellingPrice !== undefined ? Number(req.body.sellingPrice) : existing.sellingPrice,
      wipStage: req.body.wipStage ?? existing.wipStage,
      lastRestockedAt: req.body.lastRestockedAt !== undefined ? req.body.lastRestockedAt : existing.lastRestockedAt,
    }

    const updated = await InventoryItem.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after', runValidators: true })

    const delta = Number(updated.quantity || 0) - oldQty
    if (delta !== 0) {
      await StockMovement.create({
        itemId: updated._id,
        itemName: updated.name,
        change: delta,
        quantityBefore: oldQty,
        quantityAfter: Number(updated.quantity || 0),
        reason: String(req.body.reason || 'Manual stock update').trim(),
        actorId: req.user._id,
        actorName: req.user.name,
      })
    }

    res.json({ success: true, item: toInventoryResponse(updated, true) })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update inventory item.' })
  }
})

router.delete('/inventory/:id', protect, validateParams(idParam), async (req, res) => {
  try {
    if (!canEditInventory(req.user)) {
      return res.status(403).json({ success: false, message: 'Only Super Admin or Production Head can delete inventory items.' })
    }

    const existing = await InventoryItem.findById(req.params.id)
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Inventory item not found.' })
    }

    await StockMovement.create({
      itemId: existing._id,
      itemName: existing.name,
      change: -Number(existing.quantity || 0),
      quantityBefore: Number(existing.quantity || 0),
      quantityAfter: 0,
      reason: 'Inventory item removed',
      actorId: req.user._id,
      actorName: req.user.name,
    })

    await softDeleteById(InventoryItem, req.params.id, req, 'Inventory item removed')
    res.json({ success: true, message: 'Inventory item deleted.' })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to delete inventory item.' })
  }
})

router.get('/inventory/movements', protect, async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, 50, 200)
    const [movements, total] = await Promise.all([
      StockMovement.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
      StockMovement.countDocuments({}),
    ])
    res.json({ success: true, count: movements.length, total, page, limit, movements })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load stock movements.' })
  }
})

router.get('/procurement/suppliers', protect, async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, 20, 100)
    const [suppliers, total] = await Promise.all([
      Supplier.find({ isDeleted: { $ne: true } }).sort({ updatedAt: -1 }).skip(skip).limit(limit),
      Supplier.countDocuments({ isDeleted: { $ne: true } }),
    ])
    res.json({
      success: true,
      count: suppliers.length,
      total,
      page,
      limit,
      suppliers,
      permissions: { canEdit: canManageSuppliers(req.user) },
    })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load suppliers.' })
  }
})

router.post('/procurement/suppliers', protect, validateBody(supplierCreateSchema), async (req, res) => {
  try {
    if (!canManageSuppliers(req.user)) {
      return res.status(403).json({ success: false, message: 'Only Super Admin or Operations Head can create suppliers.' })
    }

    if (!String(req.body.name || '').trim()) {
      return res.status(400).json({ success: false, message: 'Supplier name is required.' })
    }

    const supplier = await Supplier.create({
      name: req.body.name,
      country: req.body.country,
      contact: req.body.contact,
      productType: req.body.productType,
      rating: Number(req.body.rating || 3),
      paymentTerms: req.body.paymentTerms,
    })

    res.status(201).json({ success: true, supplier })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to create supplier.' })
  }
})

router.put('/procurement/suppliers/:id', protect, validateParams(idParam), validateBody(supplierPatchSchema), async (req, res) => {
  try {
    if (!canManageSuppliers(req.user)) {
      return res.status(403).json({ success: false, message: 'Only Super Admin or Operations Head can update suppliers.' })
    }

    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true })
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found.' })
    }

    res.json({ success: true, supplier })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update supplier.' })
  }
})

router.delete('/procurement/suppliers/:id', protect, validateParams(idParam), async (req, res) => {
  try {
    if (!canManageSuppliers(req.user)) {
      return res.status(403).json({ success: false, message: 'Only Super Admin or Operations Head can delete suppliers.' })
    }

    const supplier = await Supplier.findById(req.params.id)
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found.' })
    }

    await softDeleteById(Supplier, req.params.id, req)
    res.json({ success: true, message: 'Supplier deleted.' })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to delete supplier.' })
  }
})

router.get('/procurement/purchase-orders', protect, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(50, Number(req.query.limit) || 20)
    const skip = (page - 1) * limit
    const search = String(req.query.search || '').trim().toLowerCase()
    const statusFilter = req.query.status

    const query = { isDeleted: { $ne: true } }
    if (search) {
      query.$or = [
        { poNumber: { $regex: search, $options: 'i' } },
        { supplierName: { $regex: search, $options: 'i' } },
      ]
    }
    if (statusFilter) {
      query.status = statusFilter
    }

    const total = await PurchaseOrder.countDocuments(query)
    const purchaseOrders = await PurchaseOrder.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)

    const mapped = purchaseOrders.map((po) => ({
      ...po.toObject(),
      totalAmount: getPOAmount(po),
      needsFinalApproval: getPOAmount(po) > ERP_PO_FINAL_APPROVAL_THRESHOLD,
    }))

    res.json({
      success: true,
      count: mapped.length,
      total,
      page,
      limit,
      purchaseOrders: mapped,
      threshold: ERP_PO_FINAL_APPROVAL_THRESHOLD,
      permissions: {
        canCreate: canCreatePO(req.user),
        canApproveBudget: canApprovePOBudget(req.user),
        canFinalApprove: isSuperAdmin(req.user),
      },
    })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load purchase orders.' })
  }
})

router.post('/procurement/purchase-orders', protect, validateBody(poCreateSchema), async (req, res) => {
  try {
    if (!canCreatePO(req.user)) {
      return res.status(403).json({ success: false, message: 'Only Operations Head or Super Admin can create purchase orders.' })
    }

    const poNumber = String(req.body.poNumber || '').trim()
    if (!poNumber) {
      return res.status(400).json({ success: false, message: 'PO number is required.' })
    }

    const supplier = await Supplier.findById(req.body.supplierId)
    if (!supplier) {
      return res.status(400).json({ success: false, message: 'Valid supplier is required.' })
    }

    const items = Array.isArray(req.body.items) ? req.body.items : []
    if (!items.length) {
      return res.status(400).json({ success: false, message: 'At least one PO item is required.' })
    }

    const purchaseOrder = await PurchaseOrder.create({
      poNumber,
      supplierId: supplier._id,
      supplierName: supplier.name,
      items: items.map((item) => ({
        itemName: item.itemName,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
      })),
      expectedDeliveryDate: req.body.expectedDeliveryDate || null,
      paymentTerms: req.body.paymentTerms,
      status: req.body.status || 'draft',
      createdById: req.user._id,
      createdByName: req.user.name,
    })

    const totalAmount = getPOAmount(purchaseOrder)
    res.status(201).json({
      success: true,
      purchaseOrder: {
        ...purchaseOrder.toObject(),
        totalAmount,
        needsFinalApproval: totalAmount > ERP_PO_FINAL_APPROVAL_THRESHOLD,
      },
    })
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'PO number already exists.' })
    }
    res.status(500).json({ success: false, message: 'Failed to create purchase order.' })
  }
})

router.put('/procurement/purchase-orders/:id', protect, validateParams(idParam), validateBody(poPatchSchema), async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id)
    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase order not found.' })
    }

    const status = req.body.status
    const update = { ...req.body }

    if (status === 'approved') {
      if (!canApprovePOBudget(req.user)) {
        return res.status(403).json({ success: false, message: 'Only Finance or Super Admin can approve PO budget.' })
      }
      update.budgetApprovedByFinance = true
    }

    const currentAmount = getPOAmount(po)
    const needsFinalApproval = currentAmount > ERP_PO_FINAL_APPROVAL_THRESHOLD

    if (req.body.finalApprovedBySuperAdmin === true || status === 'ordered') {
      if (needsFinalApproval && !isSuperAdmin(req.user)) {
        return res.status(403).json({ success: false, message: 'Only Super Admin can give final sign-off for high value POs.' })
      }
      if (needsFinalApproval) {
        update.finalApprovedBySuperAdmin = true
      }
    }

    const updated = await PurchaseOrder.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after', runValidators: true })
    const amount = getPOAmount(updated)

    res.json({
      success: true,
      purchaseOrder: {
        ...updated.toObject(),
        totalAmount: amount,
        needsFinalApproval: amount > ERP_PO_FINAL_APPROVAL_THRESHOLD,
      },
    })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update purchase order.' })
  }
})

router.delete('/procurement/purchase-orders/:id', protect, validateParams(idParam), async (req, res) => {
  try {
    if (!canCreatePO(req.user)) {
      return res.status(403).json({ success: false, message: 'Only Operations Head or Super Admin can delete purchase orders.' })
    }

    const po = await PurchaseOrder.findById(req.params.id)
    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase order not found.' })
    }

    await softDeleteById(PurchaseOrder, req.params.id, req)
    res.json({ success: true, message: 'Purchase order deleted.' })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to delete purchase order.' })
  }
})

// Production Management Routes
router.get('/production/work-orders', protect, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(50, Number(req.query.limit) || 20)
    const skip = (page - 1) * limit
    const search = String(req.query.search || '').trim().toLowerCase()
    const stageFilter = req.query.stage
    const statusFilter = req.query.status

    const query = { isDeleted: { $ne: true } }
    if (search) {
      query.$or = [{ woNumber: { $regex: search, $options: 'i' } }, { assignedTo: { $regex: search, $options: 'i' } }]
    }
    if (stageFilter) query.stage = stageFilter
    if (statusFilter) query.status = statusFilter

    const total = await WorkOrder.countDocuments(query)
    const workOrders = await WorkOrder.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)

    res.json({
      success: true,
      count: workOrders.length,
      total,
      page,
      limit,
      workOrders,
      permissions: { canEdit: canManageProduction(req.user) },
    })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load work orders.' })
  }
})

router.post('/production/work-orders', protect, validateBody(workOrderCreateSchema), async (req, res) => {
  try {
    if (!canManageProduction(req.user)) {
      return res.status(403).json({ success: false, message: 'Only Production Head or Super Admin can create work orders.' })
    }

    const woNumber = String(req.body.woNumber || '').trim()
    if (!woNumber) {
      return res.status(400).json({ success: false, message: 'Work order number is required.' })
    }

    const workOrder = await WorkOrder.create({
      woNumber,
      quantity: Number(req.body.quantity || 1),
      stage: req.body.stage || 'casting',
      assignedTo: req.body.assignedTo,
      materialNeeded: req.body.materialNeeded || [],
      targetDate: req.body.targetDate || null,
      status: 'pending',
      createdById: req.user._id,
      createdByName: req.user.name,
    })

    res.status(201).json({ success: true, workOrder })
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Work order number already exists.' })
    }
    res.status(500).json({ success: false, message: 'Failed to create work order.' })
  }
})

router.put('/production/work-orders/:id', protect, validateParams(idParam), validateBody(workOrderPatchSchema), async (req, res) => {
  try {
    if (!canManageProduction(req.user)) {
      return res.status(403).json({ success: false, message: 'Only Production Head or Super Admin can update work orders.' })
    }

    const workOrder = await WorkOrder.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true })
    if (!workOrder) {
      return res.status(404).json({ success: false, message: 'Work order not found.' })
    }

    res.json({ success: true, workOrder })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update work order.' })
  }
})

router.delete('/production/work-orders/:id', protect, validateParams(idParam), async (req, res) => {
  try {
    if (!canManageProduction(req.user)) {
      return res.status(403).json({ success: false, message: 'Only Production Head or Super Admin can delete work orders.' })
    }

    const workOrder = await softDeleteById(WorkOrder, req.params.id, req)
    if (!workOrder) {
      return res.status(404).json({ success: false, message: 'Work order not found.' })
    }

    res.json({ success: true, message: 'Work order deleted.' })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to delete work order.' })
  }
})

// Finance Management Routes
router.get('/finance/records', protect, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(50, Number(req.query.limit) || 20)
    const skip = (page - 1) * limit
    const search = String(req.query.search || '').trim().toLowerCase()
    const typeFilter = req.query.recordType
    const categoryFilter = req.query.category
    const deptFilter = req.query.department

    const query = { isDeleted: { $ne: true } }
    if (search) {
      query.$or = [{ description: { $regex: search, $options: 'i' } }, { category: { $regex: search, $options: 'i' } }]
    }
    if (typeFilter) query.recordType = typeFilter
    if (categoryFilter) query.category = categoryFilter
    if (deptFilter) query.department = deptFilter

    const total = await FinanceRecord.countDocuments(query)
    const records = await FinanceRecord.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)

    const totalAmount = (await FinanceRecord.aggregate([{ $match: query }, { $group: { _id: null, total: { $sum: '$amount' } } }])[0]) || { total: 0 }

    res.json({
      success: true,
      count: records.length,
      total,
      page,
      limit,
      records,
      totalAmount: totalAmount.total,
      permissions: { canEdit: canManageFinance(req.user) },
    })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load finance records.' })
  }
})

router.post('/finance/records', protect, async (req, res) => {
  try {
    if (!canManageFinance(req.user)) {
      return res.status(403).json({ success: false, message: 'Only Finance Head or Super Admin can create finance records.' })
    }

    if (!req.body.recordType || !req.body.amount) {
      return res.status(400).json({ success: false, message: 'Record type and amount are required.' })
    }

    const record = await FinanceRecord.create({
      recordType: req.body.recordType,
      category: req.body.category || 'other',
      department: req.body.department,
      amount: Number(req.body.amount),
      date: req.body.date || new Date(),
      description: req.body.description,
      approvalStatus: 'pending',
      createdById: req.user._id,
      createdByName: req.user.name,
    })

    res.status(201).json({ success: true, record })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to create finance record.' })
  }
})

router.put('/finance/records/:id', protect, async (req, res) => {
  try {
    if (!canManageFinance(req.user)) {
      return res.status(403).json({ success: false, message: 'Only Finance Head or Super Admin can update finance records.' })
    }

    const record = await FinanceRecord.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true })
    if (!record) {
      return res.status(404).json({ success: false, message: 'Finance record not found.' })
    }

    res.json({ success: true, record })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update finance record.' })
  }
})

router.delete('/finance/records/:id', protect, async (req, res) => {
  try {
    if (!canManageFinance(req.user)) {
      return res.status(403).json({ success: false, message: 'Only Finance Head or Super Admin can delete finance records.' })
    }

    const record = await softDeleteById(FinanceRecord, req.params.id, req)
    if (!record) {
      return res.status(404).json({ success: false, message: 'Finance record not found.' })
    }

    res.json({ success: true, message: 'Finance record deleted.' })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to delete finance record.' })
  }
})

// Procurement Document Upload & Expiry Routes
router.get('/procurement/documents', protect, async (req, res) => {
  try {
    const poId = req.query.poId
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(50, Number(req.query.limit) || 20)
    const skip = (page - 1) * limit

    const query = { isDeleted: { $ne: true } }
    if (poId) query.poId = poId

    const total = await ProcurementDoc.countDocuments(query)
    const docs = await ProcurementDoc.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    res.json({
      success: true,
      count: docs.length,
      total,
      page,
      limit,
      documents: docs,
    })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load procurement documents.' })
  }
})

router.post('/procurement/documents', protect, async (req, res) => {
  try {
    if (!canUploadProcDocs(req.user)) {
      return res.status(403).json({ success: false, message: 'Only Operations or Finance can upload procurement documents.' })
    }

    if (!req.body.poId || !req.body.fileName) {
      return res.status(400).json({ success: false, message: 'PO ID and file name are required.' })
    }

    const doc = await ProcurementDoc.create({
      poId: req.body.poId,
      docType: req.body.docType || 'receipt',
      fileName: req.body.fileName,
      fileUrl: req.body.fileUrl || `/uploads/proc-docs/${Date.now()}-${req.body.fileName}`,
      fileSize: req.body.fileSize || 0,
      uploadedBy: req.user.name,
      uploadedById: req.user._id,
      expiryDate: req.body.expiryDate || null,
    })

    // Create expiry alert if expiryDate is set
    if (req.body.expiryDate) {
      const expiryMs = new Date(req.body.expiryDate).getTime() - Date.now()
      const daysDiff = Math.ceil(expiryMs / (1000 * 60 * 60 * 24))

      if (daysDiff <= 30) {
        const severity = daysDiff <= 7 ? 'critical' : 'warning'
        await ExpiryAlert.create({
          moduleId: 'procurement_doc',
          relatedId: doc._id,
          title: `Procurement Document ${doc.fileName} expiring`,
          description: `Document ${doc.docType} for PO ${req.body.poId} expires in ${daysDiff} days.`,
          expiryDate: req.body.expiryDate,
          daysUntilExpiry: daysDiff,
          severity,
        })
      }
    }

    res.status(201).json({ success: true, document: doc })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to upload procurement document.' })
  }
})

router.delete('/procurement/documents/:id', protect, async (req, res) => {
  try {
    if (!canUploadProcDocs(req.user)) {
      return res.status(403).json({ success: false, message: 'Only authorized users can delete procurement documents.' })
    }

    const doc = await softDeleteById(ProcurementDoc, req.params.id, req)
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Procurement document not found.' })
    }

    res.json({ success: true, message: 'Procurement document deleted.' })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to delete procurement document.' })
  }
})

// Expiry Alerts Routes
router.get('/alerts/expiry', protect, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(50, Number(req.query.limit) || 20)
    const skip = (page - 1) * limit
    const severityFilter = req.query.severity
    const resolved = req.query.resolved === 'true'

    const query = { resolvedAt: resolved ? { $ne: null } : null }
    if (severityFilter) query.severity = severityFilter
    if (!resolved) delete query.resolvedAt

    const total = await ExpiryAlert.countDocuments(query)
    const alerts = await ExpiryAlert.find(query)
      .sort({ expiryDate: 1 })
      .skip(skip)
      .limit(limit)

    res.json({
      success: true,
      count: alerts.length,
      total,
      page,
      limit,
      alerts,
    })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load expiry alerts.' })
  }
})

router.put('/alerts/expiry/:id/resolve', protect, async (req, res) => {
  try {
    const alert = await ExpiryAlert.findByIdAndUpdate(
      req.params.id,
      {
        resolvedAt: new Date(),
        resolvedBy: req.user.name,
        notes: req.body.notes,
      },
      { returnDocument: 'after' }
    )

    if (!alert) {
      return res.status(404).json({ success: false, message: 'Expiry alert not found.' })
    }

    res.json({ success: true, alert })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to resolve expiry alert.' })
  }
})

module.exports = router
