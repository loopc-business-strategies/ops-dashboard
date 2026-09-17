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
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 40))
  const skip = Math.max(0, Number(query.skip) || ((Math.max(1, Number(query.page) || 1) - 1) * limit))
  const search = String(query.search || query.q || '').trim()
  const includeCount = query.includeCount === '1' || query.includeCount === 1 || query.includeCount === true
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
    const re = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    filter.$or = [
      { stockCode: re },
      { product: re },
      { productCode: re },
      { category: re },
      { designNumber: re },
      { supplier: re },
      { batchNumber: re },
      { purchaseRef: re },
    ]
  }

  const rows = await ProductionStockLot.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit + 1).lean()
  const hasMore = rows.length > limit
  const lots = hasMore ? rows.slice(0, limit) : rows
  const total = includeCount
    ? await ProductionStockLot.countDocuments(filter)
    : skip + lots.length + (hasMore ? 1 : 0)
  return { lots, total, hasMore, limit, skip }
}

async function getStockOverview() {
  const InventoryItem = require('../../models/InventoryItem')
  const [rows, erpAgg, vaultLots, erpItems] = await Promise.all([
    ProductionStockLot.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, weight: { $sum: '$netWeight' }, qty: { $sum: '$quantity' } } },
    ]),
    InventoryItem.aggregate([
      { $match: { isDeleted: { $ne: true }, quantity: { $gt: 0 } } },
      { $group: { _id: null, weight: { $sum: '$quantity' }, count: { $sum: 1 } } },
    ]).catch(() => []),
    ProductionStockLot.find({ status: { $in: ['NEW_STOCK', 'AVAILABLE'] } })
      .select('product productCode metalType purity netWeight status inventoryItemId category')
      .lean()
      .catch(() => []),
    InventoryItem.find({ isDeleted: { $ne: true }, quantity: { $gt: 0 } })
      .select('name sku category quantity')
      .lean()
      .catch(() => []),
  ])
  const byStatus = Object.fromEntries(
    STOCK_STATUSES.map((s) => [s, { count: 0, weight: 0, qty: 0 }]),
  )
  for (const row of rows) {
    if (byStatus[row._id]) {
      byStatus[row._id] = { count: row.count, weight: row.weight, qty: row.qty }
    }
  }
  const newStock = byStatus.NEW_STOCK
  const available = byStatus.AVAILABLE
  const pccVaultWeight = (Number(newStock.weight) || 0) + (Number(available.weight) || 0)
  const erpVault = {
    count: erpAgg[0]?.count || 0,
    weight: erpAgg[0]?.weight || 0,
  }

  const itemById = new Map((erpItems || []).map((it) => [String(it._id), it]))
  // Also load items referenced by lots but qty 0 (for metadata only)
  const missingItemIds = [...new Set(
    (vaultLots || [])
      .map((lot) => (lot.inventoryItemId ? String(lot.inventoryItemId) : ''))
      .filter((id) => id && !itemById.has(id)),
  )]
  if (missingItemIds.length) {
    const extra = await InventoryItem.find({ _id: { $in: missingItemIds } })
      .select('name sku category quantity')
      .lean()
      .catch(() => [])
    for (const it of extra || []) itemById.set(String(it._id), it)
  }

  const productMap = new Map()
  const bumpProduct = (key, patch) => {
    const prev = productMap.get(key) || {
      key,
      product: patch.product || 'Stock',
      metalType: patch.metalType || 'Gold',
      purity: patch.purity || '',
      inventoryItemId: patch.inventoryItemId || null,
      newStockWeight: 0,
      availableWeight: 0,
      totalWeight: 0,
    }
    prev.product = prev.product || patch.product || 'Stock'
    prev.metalType = prev.metalType || patch.metalType || 'Gold'
    if (!prev.purity && patch.purity) prev.purity = patch.purity
    if (!prev.inventoryItemId && patch.inventoryItemId) prev.inventoryItemId = patch.inventoryItemId
    prev.newStockWeight += Number(patch.newStockWeight || 0)
    prev.availableWeight += Number(patch.availableWeight || 0)
    prev.totalWeight = prev.newStockWeight + prev.availableWeight
    productMap.set(key, prev)
  }

  for (const lot of vaultLots || []) {
    const item = lot.inventoryItemId ? itemById.get(String(lot.inventoryItemId)) : null
    const meta = parseInventoryCategoryMeta(item?.category || lot.category || '')
    const metalType = titleCaseMetal(lot.metalType || meta.metalType || meta.mainStock || inferMetalTypeFromItem(item || lot))
    const purity = String(lot.purity || meta.productPurity || meta.purity || '').trim()
    const product = String(lot.product || item?.name || metalType).trim() || 'Stock'
    const itemId = lot.inventoryItemId ? String(lot.inventoryItemId) : ''
    const key = itemId || `${product}|${metalType}|${purity}`.toLowerCase()
    const weight = Number(lot.netWeight) || 0
    bumpProduct(key, {
      product,
      metalType,
      purity,
      inventoryItemId: itemId || null,
      newStockWeight: lot.status === 'NEW_STOCK' ? weight : 0,
      availableWeight: lot.status === 'AVAILABLE' ? weight : 0,
    })
  }

  // ERP-only products with on-hand qty but no active vault lot row
  for (const item of erpItems || []) {
    const itemId = String(item._id)
    const already = [...productMap.values()].some((p) => p.inventoryItemId === itemId)
    if (already) continue
    const meta = parseInventoryCategoryMeta(item.category || '')
    // Skip pure stock-type masters without product recordType when qty is only mapping noise
    const metalType = titleCaseMetal(meta.metalType || meta.mainStock || inferMetalTypeFromItem(item))
    const purity = String(meta.productPurity || meta.purity || '').trim()
    const product = String(item.name || metalType).trim() || 'Stock'
    const weight = Number(item.quantity) || 0
    if (weight <= 0) continue
    bumpProduct(itemId, {
      product,
      metalType,
      purity,
      inventoryItemId: itemId,
      availableWeight: weight,
    })
  }

  const vaultProducts = [...productMap.values()]
    .filter((p) => (Number(p.totalWeight) || 0) > 0)
    .sort((a, b) => (Number(b.totalWeight) || 0) - (Number(a.totalWeight) || 0))
    .map((p) => ({
      product: p.product,
      metalType: p.metalType,
      purity: p.purity,
      inventoryItemId: p.inventoryItemId,
      newStockWeight: Number(p.newStockWeight) || 0,
      availableWeight: Number(p.availableWeight) || 0,
      totalWeight: Number(p.totalWeight) || 0,
    }))

  return {
    byStatus,
    newStock,
    available,
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
    erpVault,
    /** PCC NEW_STOCK + AVAILABLE; PD may fall back to erpVault when this is 0 */
    vaultWeight: pccVaultWeight,
    vaultProducts,
  }
}

function parseInventoryCategoryMeta(category) {
  const meta = {}
  String(category || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const eq = part.indexOf('=')
      if (eq <= 0) return
      const key = part.slice(0, eq).trim()
      const value = part.slice(eq + 1).trim()
      if (key) meta[key] = value
    })
  return meta
}

function titleCaseMetal(value) {
  const s = String(value || '').trim().toLowerCase()
  if (s.includes('silver') || s === 'ag') return 'Silver'
  if (s.includes('platinum') || s === 'pt' || s === 'plt') return 'Platinum'
  if (s.includes('gold') || s === 'au' || !s) return 'Gold'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function voucherStockIdempotencyKey(txId, inventoryItemId) {
  return `voucher-stock:${String(txId)}:${String(inventoryItemId)}`
}

function inferMetalTypeFromItem(item) {
  const raw = String(item?.metalType || item?.category || item?.name || '').toLowerCase()
  if (raw.includes('silver')) return 'Silver'
  if (raw.includes('platinum')) return 'Platinum'
  if (METAL_TYPES.includes(item?.metalType)) return item.metalType
  return 'Gold'
}

/**
 * Create (or reuse) an AVAILABLE ProductionStockLot linked to a metal purchase/receipt line.
 * Idempotent via voucher-stock:{txId}:{itemId}.
 */
async function upsertVoucherAvailableLot({
  user,
  tx,
  inventoryItem,
  netWeight,
  session = null,
} = {}) {
  if (!tx?._id || !inventoryItem?._id) return null
  const weight = Number(netWeight)
  if (!Number.isFinite(weight) || weight <= 0) return null

  const idempotencyKey = voucherStockIdempotencyKey(tx._id, inventoryItem._id)
  const existing = await withSession(ProductionStockLot.findOne({ idempotencyKey }), session)
  if (existing) {
    if (existing.status === 'CANCELLED') {
      existing.status = 'AVAILABLE'
      existing.netWeight = weight
      existing.grossWeight = weight
      existing.quantity = Number(existing.quantity) || 1
      existing.version = (existing.version || 0) + 1
      await existing.save(writeOpts(session))
    }
    return { lot: existing, reused: true }
  }

  const vocNo = String(tx?.voucherMeta?.vocNo || '').trim()
  const a = {
    id: user?._id || null,
    name: user?.name || 'system',
  }
  const stockCode = await nextStockCode(ProductionStockLot, session)
  const [created] = await ProductionStockLot.create(
    [
      {
        stockCode,
        purchaseRef: vocNo,
        supplier: String(tx?.voucherMeta?.partyName || '').trim(),
        purchaseDate: tx?.date || tx?.voucherMeta?.valueDate || new Date(),
        product: inventoryItem.name || '',
        productCode: inventoryItem.sku || '',
        category: inventoryItem.category || '',
        quantity: 1,
        grossWeight: weight,
        netWeight: weight,
        metalType: inferMetalTypeFromItem(inventoryItem),
        purity: '',
        remarks: `Auto from metal voucher ${vocNo || tx._id}`,
        receivedById: a.id,
        receivedByName: a.name,
        status: 'AVAILABLE',
        inventoryItemId: inventoryItem._id,
        idempotencyKey,
        createdById: a.id,
        createdByName: a.name,
        version: 0,
      },
    ],
    writeOpts(session),
  )

  await ProductionStockStatusEvent.create(
    [
      {
        stockLotId: created._id,
        stockCode,
        fromStatus: '',
        toStatus: 'AVAILABLE',
        reason: `Metal voucher ${vocNo || tx._id}`,
        actorId: a.id,
        actorName: a.name,
      },
    ],
    writeOpts(session),
  )

  return { lot: created, reused: false }
}

/** Soft-cancel PCC lots created for a metal voucher (void path). */
async function cancelVoucherAvailableLotsForTx(tx, { user, reason = 'Void metal voucher', session = null } = {}) {
  if (!tx?._id) return { cancelled: 0 }
  const prefix = `voucher-stock:${String(tx._id)}:`
  const lots = await withSession(
    ProductionStockLot.find({
      idempotencyKey: { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` },
      status: { $ne: 'CANCELLED' },
    }),
    session,
  )
  let cancelled = 0
  const fakeReq = { user: user || { _id: null, name: 'system' } }
  for (const lot of lots) {
    try {
      await transitionStock(fakeReq, lot, 'CANCELLED', {
        reason,
        session,
        skipTransitionCheck: !((STOCK_STATUS_TRANSITIONS[lot.status] || []).includes('CANCELLED')),
      })
      cancelled += 1
    } catch (err) {
      console.warn('[production-control] voucher lot cancel failed:', err.message)
    }
  }
  return { cancelled }
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

/** Soft-cancel a WIP stock lot so it leaves under-processing overview totals. */
async function cancelStockLot(req, lotId, { reason = 'Cancelled leftover WIP', expectedVersion } = {}) {
  return runInTransaction(async (session) => {
    const lot = await withSession(ProductionStockLot.findById(lotId), session)
    if (!lot) throw new ProductionError('Stock lot not found', 404)
    if (lot.status === 'CANCELLED') return lot
    if (['FINISHED', 'DISPATCHED', 'NEW_STOCK', 'AVAILABLE'].includes(lot.status)) {
      throw new ProductionError(`Cannot cancel stock in status ${lot.status}`)
    }
    if (expectedVersion != null && lot.version !== Number(expectedVersion)) {
      throw new ProductionError('Stock was updated by another user. Refresh and retry.', 409)
    }
    await transitionStock(req, lot, 'CANCELLED', {
      reason,
      batchId: lot.batchId || null,
      batchNumber: lot.batchNumber || '',
      session,
    })
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
    const lotNet = Number(lot.netWeight || 0)
    const lotGross = Number(lot.grossWeight || 0)
    const lotQty = Number(lot.quantity || 0)
    if (lotNet > 0 && selectWeight > lotNet + 0.0001) {
      throw new ProductionError('Selected weight exceeds available net weight')
    }
    if (lotQty > 0 && selectQty > lotQty + 0.0001) {
      throw new ProductionError('Selected quantity exceeds available quantity')
    }

    const isPartial = (lotNet > 0 && selectWeight < lotNet - 0.0001)
      || (lotQty > 0 && selectQty < lotQty - 0.0001)

    let remainderLot = null
    if (isPartial) {
      const remWeight = Math.max(0, (lotNet > 0 ? lotNet : selectWeight) - selectWeight)
      const remQty = Math.max(0, lotQty - selectQty)
      const remGross = lotGross > 0 && lotNet > 0
        ? Math.max(0, Number((lotGross * (remWeight / lotNet)).toFixed(6)))
        : Math.max(0, lotGross - selectWeight)
      const selectedGross = lotGross > 0 && lotNet > 0
        ? Math.max(0, Number((lotGross * (selectWeight / lotNet)).toFixed(6)))
        : selectWeight

      const remCode = await nextStockCode(ProductionStockLot, session)
      const [rem] = await ProductionStockLot.create(
        [
          {
            stockCode: remCode,
            purchaseRef: lot.purchaseRef || '',
            supplier: lot.supplier || '',
            purchaseDate: lot.purchaseDate || null,
            product: lot.product || '',
            productCode: lot.productCode || '',
            category: lot.category || '',
            designNumber: lot.designNumber || '',
            quantity: remQty,
            allocatedQuantity: 0,
            grossWeight: remGross,
            netWeight: remWeight,
            allocatedWeight: 0,
            metalType: lot.metalType,
            purity: lot.purity || '',
            size: lot.size || '',
            remarks: `Remainder from ${lot.stockCode} after partial select`,
            receivedById: lot.receivedById || null,
            receivedByName: lot.receivedByName || '',
            status: 'AVAILABLE',
            inventoryItemId: lot.inventoryItemId || null,
            batchId: null,
            batchNumber: '',
            parentLotId: lot._id,
            attachmentRefs: [],
            createdById: a.id,
            createdByName: a.name,
            version: 0,
          },
        ],
        writeOpts(session),
      )
      remainderLot = rem

      lot.quantity = selectQty
      lot.netWeight = selectWeight
      lot.grossWeight = selectedGross
      const prevChildren = Array.isArray(lot.childLotIds) ? lot.childLotIds : []
      lot.childLotIds = [...prevChildren, rem._id]

      await writeProductionAudit(req, {
        resource: 'ProductionStockLot',
        resourceId: rem._id,
        action: AUDIT_ACTIONS.STOCK_REMAINDER_CREATED,
        detail: `Remainder lot ${remCode} (${remWeight}g) from ${lot.stockCode}`,
        changes: {
          parentLotId: String(lot._id),
          parentStockCode: lot.stockCode,
          remainderStockCode: remCode,
          remainderWeight: remWeight,
          remainderQuantity: remQty,
          selectedWeight: selectWeight,
          selectedQuantity: selectQty,
        },
        session,
      })
      await writeProductionAudit(req, {
        resource: 'ProductionStockLot',
        resourceId: lot._id,
        action: AUDIT_ACTIONS.STOCK_UPDATED,
        detail: `Stock ${lot.stockCode} reduced for partial select; remainder ${remCode}`,
        changes: {
          netWeight: selectWeight,
          quantity: selectQty,
          childLotId: String(rem._id),
        },
        session,
      })
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
          remainderStockCode: remainderLot?.stockCode || null,
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
        remainderLotId: remainderLot ? String(remainderLot._id) : null,
      },
      session,
    })

    return { lot, batch, remainderLot }
  })
}

async function adjustStock(req, lotId, input = {}) {
  const {
    quantityDelta = 0,
    weightDelta = 0,
    reason,
    expectedVersion,
    approvedById = null,
  } = input
  if (!reason || String(reason).trim().length < 3) {
    throw new ProductionError('Adjustment reason is required (min 3 characters)')
  }
  const qd = Number(quantityDelta) || 0
  const wd = Number(weightDelta) || 0
  if (qd === 0 && wd === 0) throw new ProductionError('quantityDelta or weightDelta required')

  const a = actor(req)
  const { resolveApprovalPolicy, assertMakerChecker } = require('../permissions/approvalPolicy')
  const policy = resolveApprovalPolicy('stock_adjust', input.approvalSettings || {})
  const enforceDual = Boolean(input.requireDualControl) || policy.dualControl
  if (enforceDual) {
    if (!approvedById) {
      throw new ProductionError(
        'Stock adjustments require dual-control approval (approvedById of a different user)',
        403,
      )
    }
    const check = assertMakerChecker({
      policy: { ...policy, dualControl: true, requireApproval: true },
      creatorId: a.id,
      approverId: approvedById,
      amount: Math.abs(wd) || Math.abs(qd),
    })
    if (check) throw new ProductionError(check, 403)
  }

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
      changes: {
        before,
        after: { quantity: nextQty, netWeight: nextNet, grossWeight: nextGross },
        reason: String(reason).trim(),
        by: a.name,
        approvedById: approvedById ? String(approvedById) : null,
      },
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

async function dispatchStock(req, stockLotId, { reason = '', expectedVersion } = {}) {
  return runInTransaction(async (session) => {
    const lot = await withSession(ProductionStockLot.findById(stockLotId), session)
    if (!lot) throw new ProductionError('Stock lot not found', 404)
    if (expectedVersion != null && lot.version !== Number(expectedVersion)) {
      throw new ProductionError('Stock lot was updated by another user. Refresh and retry.', 409)
    }
    if (lot.status === 'DISPATCHED') return lot
    if (lot.status !== 'FINISHED') {
      throw new ProductionError(`Cannot dispatch stock in status ${lot.status}. Only FINISHED lots can be dispatched.`)
    }
    await transitionStock(req, lot, 'DISPATCHED', {
      reason: reason || 'Dispatched from finished stock',
      batchId: lot.batchId || null,
      batchNumber: lot.batchNumber || '',
      session,
    })
    await writeProductionAudit(req, {
      resource: 'ProductionStockLot',
      resourceId: lot._id,
      action: AUDIT_ACTIONS.STOCK_STATUS_CHANGED,
      detail: `Stock ${lot.stockCode} dispatched`,
      changes: { fromStatus: 'FINISHED', toStatus: 'DISPATCHED', reason: reason || 'Dispatched from finished stock' },
      session,
    })
    return lot
  })
}

module.exports = {
  createStock,
  listStock,
  getStockOverview,
  getStockDetail,
  markAvailable,
  cancelStockLot,
  updateStock,
  selectAndAllocate,
  adjustStock,
  dispatchStock,
  transitionStock,
  syncStockStatusForBatch,
  getStockHistory,
  recordStatusEvent,
  upsertVoucherAvailableLot,
  cancelVoucherAvailableLotsForTx,
  voucherStockIdempotencyKey,
  ProductionError,
  // re-export createBatch for callers that need it without circular issues
  createBatch,
}
