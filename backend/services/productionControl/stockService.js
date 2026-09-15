const ProductionStockLot = require('../../models/ProductionStockLot')
const ProductionStockStatusEvent = require('../../models/ProductionStockStatusEvent')
const ProductionBatch = require('../../models/ProductionBatch')
const { runInTransaction, withSession, writeOpts } = require('../../utils/mongoTransaction')
const { writeProductionAudit } = require('./audit')
const { nextStockCode } = require('./numbering')
const { AUDIT_ACTIONS, STOCK_STATUSES, STOCK_STATUS_TRANSITIONS, METAL_TYPES } = require('./constants')
const { ProductionError, createBatch } = require('./batchService')

function actor(req) {
  return { id: req.user?._id || null, name: req.user?.name || 'system' }
}

function assertTransition(from, to) {
  const allowed = STOCK_STATUS_TRANSITIONS[from] || []
  if (!allowed.includes(to)) {
    throw new ProductionError(`Invalid stock status transition: ${from} → ${to}`)
  }
}

async function recordStatusEvent(req, lot, toStatus, { reason = '', batchId = null, batchNumber = '', processRunId = null, session = null } = {}) {
  const a = actor(req)
  const fromStatus = lot.status || ''
  await ProductionStockStatusEvent.create(
    [
      {
        stockLotId: lot._id,
        stockCode: lot.stockCode,
        fromStatus,
        toStatus,
        reason,
        batchId,
        batchNumber: batchNumber || lot.batchNumber || '',
        processRunId,
        actorId: a.id,
        actorName: a.name,
      },
    ],
    writeOpts(session),
  )
}

async function transitionStock(req, lot, toStatus, opts = {}) {
  const { reason = '', batchId = null, batchNumber = '', processRunId = null, session = null, skipTransitionCheck = false } = opts
  if (!STOCK_STATUSES.includes(toStatus)) {
    throw new ProductionError(`Invalid stock status: ${toStatus}`)
  }
  if (lot.status === toStatus) return lot
  if (!skipTransitionCheck) assertTransition(lot.status, toStatus)
  const from = lot.status
  await recordStatusEvent(req, lot, toStatus, { reason, batchId, batchNumber, processRunId, session })
  lot.status = toStatus
  lot.version = (lot.version || 0) + 1
  await lot.save(writeOpts(session))
  await writeProductionAudit(req, {
    resource: 'ProductionStockLot',
    resourceId: lot._id,
    action: AUDIT_ACTIONS.STOCK_STATUS_CHANGED,
    detail: `Stock ${lot.stockCode}: ${from} → ${toStatus}`,
    changes: { fromStatus: from, toStatus, reason, stockCode: lot.stockCode },
    session,
  })
  return lot
}

async function createStock(req, input = {}) {
  const {
    purchaseRef = '',
    supplier = '',
    purchaseDate = null,
    product = '',
    productCode = '',
    category = '',
    designNumber = '',
    quantity = 0,
    grossWeight = 0,
    netWeight = 0,
    metalType = 'Gold',
    purity = '',
    size = '',
    remarks = '',
    inventoryItemId = null,
    attachmentRefs = [],
    idempotencyKey = null,
  } = input

  if (!METAL_TYPES.includes(metalType)) throw new ProductionError('Invalid metal type')
  const gw = Number(grossWeight) || 0
  const nw = Number(netWeight) || gw
  const qty = Number(quantity) || 0
  if (gw <= 0 && nw <= 0 && qty <= 0) {
    throw new ProductionError('Quantity or weight is required')
  }

  if (idempotencyKey) {
    const existing = await ProductionStockLot.findOne({ idempotencyKey }).lean()
    if (existing) return { lot: existing, reused: true }
  }

  const a = actor(req)

  const lot = await runInTransaction(async (session) => {
    const stockCode = await nextStockCode(ProductionStockLot, session)
    const [created] = await ProductionStockLot.create(
      [
        {
          stockCode,
          purchaseRef,
          supplier,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
          product,
          productCode,
          category,
          designNumber,
          quantity: qty,
          grossWeight: gw,
          netWeight: nw || gw,
          metalType,
          purity,
          size,
          remarks,
          receivedById: a.id,
          receivedByName: a.name,
          status: 'NEW_STOCK',
          inventoryItemId: inventoryItemId || null,
          attachmentRefs: Array.isArray(attachmentRefs) ? attachmentRefs : [],
          createdById: a.id,
          createdByName: a.name,
          version: 0,
        },
      ],
      writeOpts(session),
    )

    if (idempotencyKey) {
      created.idempotencyKey = idempotencyKey
      await created.save(writeOpts(session))
    }

    await ProductionStockStatusEvent.create(
      [
        {
          stockLotId: created._id,
          stockCode,
          fromStatus: '',
          toStatus: 'NEW_STOCK',
          reason: 'Stock in created',
          actorId: a.id,
          actorName: a.name,
        },
      ],
      writeOpts(session),
    )

    await writeProductionAudit(req, {
      resource: 'ProductionStockLot',
      resourceId: created._id,
      action: AUDIT_ACTIONS.STOCK_CREATED,
      detail: `Stock ${stockCode} created (${product || metalType} ${nw || gw}g)`,
      changes: { stockCode, status: 'NEW_STOCK', product, netWeight: nw || gw, quantity: qty },
      session,
    })

    return created
  })

  return { lot, reused: false }
}

async function listStock(query = {}) {
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50))
  const skip = Math.max(0, Number(query.skip) || ((Math.max(1, Number(query.page) || 1) - 1) * limit))
  const search = String(query.search || query.q || '').trim()
  const filter = {}

  if (query.status) {
    const statuses = String(query.status).split(',').map((s) => s.trim()).filter(Boolean)
    filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses }
  }
  if (query.metalType) filter.metalType = query.metalType
  if (query.product) filter.product = new RegExp(String(query.product).trim(), 'i')
  if (query.productCode) filter.productCode = new RegExp(String(query.productCode).trim(), 'i')
  if (query.category) filter.category = new RegExp(String(query.category).trim(), 'i')
  if (query.designNumber || query.design) {
    filter.designNumber = new RegExp(String(query.designNumber || query.design).trim(), 'i')
  }
  if (query.supplier) filter.supplier = new RegExp(String(query.supplier).trim(), 'i')
  if (query.stockCode) filter.stockCode = new RegExp(String(query.stockCode).trim(), 'i')
  if (query.fromDate || query.toDate) {
    filter.createdAt = {}
    if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate)
    if (query.toDate) filter.createdAt.$lte = new Date(query.toDate)
  }
  if (search) {
    filter.$or = [
      { stockCode: new RegExp(search, 'i') },
      { product: new RegExp(search, 'i') },
      { productCode: new RegExp(search, 'i') },
      { category: new RegExp(search, 'i') },
      { designNumber: new RegExp(search, 'i') },
      { supplier: new RegExp(search, 'i') },
      { batchNumber: new RegExp(search, 'i') },
      { purchaseRef: new RegExp(search, 'i') },
    ]
  }

  const [lots, total] = await Promise.all([
    ProductionStockLot.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    ProductionStockLot.countDocuments(filter),
  ])
  return { lots, total, limit, skip }
}

async function getStockOverview() {
  const rows = await ProductionStockLot.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 }, weight: { $sum: '$netWeight' }, qty: { $sum: '$quantity' } } },
  ])
  const byStatus = Object.fromEntries(
    STOCK_STATUSES.map((s) => [s, { count: 0, weight: 0, qty: 0 }]),
  )
  for (const row of rows) {
    if (byStatus[row._id]) {
      byStatus[row._id] = { count: row.count, weight: row.weight, qty: row.qty }
    }
  }
  return {
    byStatus,
    newStock: byStatus.NEW_STOCK,
    available: byStatus.AVAILABLE,
    selected: byStatus.SELECTED,
    underProcessing: {
      count: (byStatus.UNDER_PROCESSING.count || 0)
        + (byStatus.DEPARTMENT_PROCESSING.count || 0)
        + (byStatus.ALLOCATED.count || 0)
        + (byStatus.QC_PENDING.count || 0)
        + (byStatus.PACKAGING.count || 0)
        + (byStatus.REWORK.count || 0)
        + (byStatus.HOLD.count || 0),
      weight: (byStatus.UNDER_PROCESSING.weight || 0)
        + (byStatus.DEPARTMENT_PROCESSING.weight || 0)
        + (byStatus.ALLOCATED.weight || 0)
        + (byStatus.QC_PENDING.weight || 0)
        + (byStatus.PACKAGING.weight || 0)
        + (byStatus.REWORK.weight || 0)
        + (byStatus.HOLD.weight || 0),
    },
    finished: byStatus.FINISHED,
    dispatched: byStatus.DISPATCHED,
  }
}

async function getStockDetail(idOrCode) {
  const filter = /^[a-f0-9]{24}$/i.test(String(idOrCode))
    ? { _id: idOrCode }
    : { stockCode: String(idOrCode).toUpperCase() }
  const lot = await ProductionStockLot.findOne(filter).lean()
  if (!lot) return null
  const events = await ProductionStockStatusEvent.find({ stockLotId: lot._id })
    .sort({ createdAt: 1 })
    .lean()
  let batch = null
  if (lot.batchId) {
    batch = await ProductionBatch.findById(lot.batchId).lean()
  }
  return { lot, events, batch }
}

async function markAvailable(req, lotId, { reason = 'Released to available', expectedVersion } = {}) {
  return runInTransaction(async (session) => {
    const lot = await withSession(ProductionStockLot.findById(lotId), session)
    if (!lot) throw new ProductionError('Stock lot not found', 404)
    if (expectedVersion != null && lot.version !== Number(expectedVersion)) {
      throw new ProductionError('Stock was updated by another user. Refresh and retry.', 409)
    }
    await transitionStock(req, lot, 'AVAILABLE', { reason, session })
    return lot
  })
}

async function updateStock(req, lotId, updates = {}) {
  const a = actor(req)
  return runInTransaction(async (session) => {
    const lot = await withSession(ProductionStockLot.findById(lotId), session)
    if (!lot) throw new ProductionError('Stock lot not found', 404)
    if (!['NEW_STOCK', 'AVAILABLE'].includes(lot.status)) {
      throw new ProductionError(`Cannot edit stock in status ${lot.status}`)
    }
    const allowed = [
      'purchaseRef', 'supplier', 'purchaseDate', 'product', 'productCode', 'category',
      'designNumber', 'quantity', 'grossWeight', 'netWeight', 'metalType', 'purity',
      'size', 'remarks', 'inventoryItemId', 'attachmentRefs',
    ]
    const before = {}
    const after = {}
    for (const key of allowed) {
      if (updates[key] === undefined) continue
      before[key] = lot[key]
      if (key === 'purchaseDate') lot[key] = updates[key] ? new Date(updates[key]) : null
      else if (['quantity', 'grossWeight', 'netWeight'].includes(key)) lot[key] = Number(updates[key]) || 0
      else if (key === 'metalType') {
        if (!METAL_TYPES.includes(updates[key])) throw new ProductionError('Invalid metal type')
        lot[key] = updates[key]
      } else lot[key] = updates[key]
      after[key] = lot[key]
    }
    lot.version = (lot.version || 0) + 1
    await lot.save(writeOpts(session))
    await writeProductionAudit(req, {
      resource: 'ProductionStockLot',
      resourceId: lot._id,
      action: AUDIT_ACTIONS.STOCK_UPDATED,
      detail: `Stock ${lot.stockCode} updated by ${a.name}`,
      changes: { before, after },
      session,
    })
    return lot
  })
}

/**
 * Select available stock and create a production batch linked to the lot.
 */
async function selectAndAllocate(req, input = {}) {
  const {
    stockLotId,
    quantity = null,
    weight = null,
    product = '',
    purpose = 'Stock selection for production',
    workOrderId = null,
    workOrderNumber = '',
    markIssued = false,
    idempotencyKey = null,
    expectedVersion,
  } = input

  if (!stockLotId) throw new ProductionError('stockLotId is required')

  const a = actor(req)

  return runInTransaction(async (session) => {
    const lot = await withSession(ProductionStockLot.findById(stockLotId), session)
    if (!lot) throw new ProductionError('Stock lot not found', 404)
    if (lot.status !== 'AVAILABLE' && lot.status !== 'SELECTED') {
      throw new ProductionError(`Stock must be AVAILABLE to select (current: ${lot.status})`)
    }
    if (lot.batchId) throw new ProductionError('Stock already allocated to a batch')
    if (expectedVersion != null && lot.version !== Number(expectedVersion)) {
      throw new ProductionError('Stock was updated by another user. Refresh and retry.', 409)
    }

    const selectQty = quantity != null ? Number(quantity) : Number(lot.quantity || 0)
    const selectWeight = weight != null ? Number(weight) : Number(lot.netWeight || lot.grossWeight || 0)
    if (!Number.isFinite(selectWeight) || selectWeight <= 0) {
      throw new ProductionError('Select weight must be positive')
    }
    if (Number(lot.netWeight || 0) > 0 && selectWeight > Number(lot.netWeight) + 0.0001) {
      throw new ProductionError('Selected weight exceeds available net weight')
    }
    if (Number(lot.quantity || 0) > 0 && selectQty > Number(lot.quantity) + 0.0001) {
      throw new ProductionError('Selected quantity exceeds available quantity')
    }

    await transitionStock(req, lot, 'SELECTED', {
      reason: 'Selected for production',
      session,
      skipTransitionCheck: lot.status === 'SELECTED',
    })

    // createBatch opens its own transaction — create batch inline here for single txn
    const { nextBatchNumber } = require('./numbering')
    const batchNumber = await nextBatchNumber(ProductionBatch, lot.metalType, session)
    const [batch] = await ProductionBatch.create(
      [
        {
          batchNumber,
          workOrderId: workOrderId || null,
          workOrderNumber: workOrderNumber || '',
          metalType: lot.metalType,
          purity: lot.purity || '',
          product: product || lot.product || '',
          purpose,
          targetQuantity: selectQty,
          initialWeight: selectWeight,
          currentWeight: selectWeight,
          lastVerifiedWeight: selectWeight,
          currentDepartment: 'vault',
          currentLocation: 'Vault',
          inventoryItemId: lot.inventoryItemId || null,
          stockLotId: lot._id,
          stockCode: lot.stockCode,
          status: markIssued ? 'ISSUED' : 'AWAITING_ISSUE',
          issuedWeight: markIssued ? selectWeight : 0,
          startedAt: markIssued ? new Date() : null,
          createdById: a.id,
          createdByName: a.name,
          version: 0,
        },
      ],
      writeOpts(session),
    )

    if (idempotencyKey) {
      batch.idempotencyKey = idempotencyKey
      await batch.save(writeOpts(session))
    }

    await writeProductionAudit(req, {
      resource: 'ProductionBatch',
      resourceId: batch._id,
      action: AUDIT_ACTIONS.BATCH_CREATED,
      detail: `Batch ${batchNumber} created from stock ${lot.stockCode}`,
      changes: {
        after: {
          batchNumber,
          stockCode: lot.stockCode,
          metalType: lot.metalType,
          initialWeight: selectWeight,
          status: batch.status,
        },
      },
      session,
    })

    lot.allocatedQuantity = selectQty
    lot.allocatedWeight = selectWeight
    lot.batchId = batch._id
    lot.batchNumber = batch.batchNumber
    await transitionStock(req, lot, 'ALLOCATED', {
      reason: 'Allocated to production batch',
      batchId: batch._id,
      batchNumber: batch.batchNumber,
      session,
    })
    await transitionStock(req, lot, 'UNDER_PROCESSING', {
      reason: 'Production started from stock selection',
      batchId: batch._id,
      batchNumber: batch.batchNumber,
      session,
    })

    await writeProductionAudit(req, {
      resource: 'ProductionStockLot',
      resourceId: lot._id,
      action: AUDIT_ACTIONS.STOCK_ALLOCATED,
      detail: `Stock ${lot.stockCode} allocated to ${batch.batchNumber}`,
      changes: {
        stockCode: lot.stockCode,
        batchNumber: batch.batchNumber,
        quantity: selectQty,
        weight: selectWeight,
      },
      session,
    })

    return { lot, batch }
  })
}

async function adjustStock(req, lotId, input = {}) {
  const {
    quantityDelta = 0,
    weightDelta = 0,
    reason,
    expectedVersion,
  } = input
  if (!reason || String(reason).trim().length < 3) {
    throw new ProductionError('Adjustment reason is required (min 3 characters)')
  }
  const qd = Number(quantityDelta) || 0
  const wd = Number(weightDelta) || 0
  if (qd === 0 && wd === 0) throw new ProductionError('quantityDelta or weightDelta required')

  const a = actor(req)
  return runInTransaction(async (session) => {
    const lot = await withSession(ProductionStockLot.findById(lotId), session)
    if (!lot) throw new ProductionError('Stock lot not found', 404)
    if (expectedVersion != null && lot.version !== Number(expectedVersion)) {
      throw new ProductionError('Stock was updated by another user. Refresh and retry.', 409)
    }
    const before = {
      quantity: Number(lot.quantity || 0),
      netWeight: Number(lot.netWeight || 0),
      grossWeight: Number(lot.grossWeight || 0),
    }
    const nextQty = before.quantity + qd
    const nextNet = before.netWeight + wd
    let nextGross = before.grossWeight
    if (wd !== 0) {
      // Keep gross in sync when present; otherwise leave at 0 rather than going negative
      nextGross = before.grossWeight > 0 ? before.grossWeight + wd : Math.max(0, before.grossWeight + wd)
      if (before.grossWeight <= 0 && before.netWeight > 0) {
        nextGross = nextNet
      }
    }
    if (nextQty < 0 || nextNet < 0 || nextGross < 0) {
      throw new ProductionError('Adjusted stock cannot be negative')
    }
    lot.quantity = nextQty
    lot.netWeight = nextNet
    lot.grossWeight = nextGross
    lot.version = (lot.version || 0) + 1
    await lot.save(writeOpts(session))

    await writeProductionAudit(req, {
      resource: 'ProductionStockLot',
      resourceId: lot._id,
      action: AUDIT_ACTIONS.STOCK_ADJUSTED,
      detail: `Stock ${lot.stockCode} adjusted: qty ${before.quantity}→${nextQty}, weight ${before.netWeight}→${nextNet}`,
      changes: { before, after: { quantity: nextQty, netWeight: nextNet, grossWeight: nextGross }, reason: String(reason).trim(), by: a.name },
      session,
    })
    return lot
  })
}

async function syncStockStatusForBatch(req, batch, toStatus, { reason = '', processRunId = null, session = null } = {}) {
  if (!batch?.stockLotId) return null
  const lot = await withSession(ProductionStockLot.findById(batch.stockLotId), session)
  if (!lot) return null
  try {
    await transitionStock(req, lot, toStatus, {
      reason,
      batchId: batch._id,
      batchNumber: batch.batchNumber,
      processRunId,
      session,
      skipTransitionCheck: true,
    })
  } catch (err) {
    // Soft-fail sync so batch workflow is not blocked by stock edge cases
    console.warn('[production-control] stock status sync failed:', err.message)
  }
  return lot
}

async function getStockHistory(query = {}) {
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50))
  const skip = Math.max(0, Number(query.skip) || 0)
  const filter = {}
  if (query.stockLotId) filter.stockLotId = query.stockLotId
  if (query.stockCode) filter.stockCode = new RegExp(String(query.stockCode).trim(), 'i')
  if (query.batchId) filter.batchId = query.batchId
  const [events, total] = await Promise.all([
    ProductionStockStatusEvent.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ProductionStockStatusEvent.countDocuments(filter),
  ])
  return { events, total, limit, skip }
}

module.exports = {
  createStock,
  listStock,
  getStockOverview,
  getStockDetail,
  markAvailable,
  updateStock,
  selectAndAllocate,
  adjustStock,
  transitionStock,
  syncStockStatusForBatch,
  getStockHistory,
  recordStatusEvent,
  ProductionError,
  // re-export createBatch for callers that need it without circular issues
  createBatch,
}
