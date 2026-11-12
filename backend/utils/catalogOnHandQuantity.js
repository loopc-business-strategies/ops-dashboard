const {
  METAL_STOCK_TYPES,
  isMetalStockInType,
  isMetalStockOutType,
  isMetalProductTransferType,
} = require('./metalStockVoucherTypes')

function isCatalogInventoryProduct(category) {
  return /(?:^|;)recordType=product(?:;|$)/i.test(String(category || ''))
}

function catalogQuantityFromMovements(movementSum) {
  const qty = Number(movementSum || 0)
  if (!Number.isFinite(qty)) return 0
  return Math.max(0, Number(qty.toFixed(4)))
}

function catalogPcsFromSignedSum(pcsSum) {
  const pcs = Number(pcsSum || 0)
  if (!Number.isFinite(pcs)) return 0
  return Math.max(0, Math.round(pcs))
}

/** Signed PCS delta for one voucher line against inventory (+ in, − out). */
function resolveVoucherLinePcsSign(transactionType, line = {}) {
  const type = String(transactionType || '').toLowerCase()
  if (isMetalStockInType(type)) return 1
  if (isMetalStockOutType(type)) return -1
  if (isMetalProductTransferType(type)) {
    const side = String(line?.transferSide || '').toLowerCase()
    if (side === 'from') return -1
    if (side === 'to') return 1
  }
  return 0
}

function resolveVoucherLinePcsDelta(transactionType, line = {}) {
  const pcs = Number(line?.pcs || 0)
  if (!(pcs > 0)) return 0
  const sign = resolveVoucherLinePcsSign(transactionType, line)
  if (!sign) return 0
  return sign * pcs
}

async function catalogOnHandFromMovements(StockMovement, itemId) {
  if (!StockMovement || !itemId) return 0
  const rows = await StockMovement.aggregate([
    { $match: { isDeleted: { $ne: true }, itemId } },
    { $group: { _id: null, qty: { $sum: '$change' } } },
  ])
  return catalogQuantityFromMovements(rows[0]?.qty)
}

/**
 * Catalog product on-hand is the posted stock-movement total.
 * A piece weight saved on the product is not stock.
 */
async function applyCatalogOnHandQuantities({ InventoryItem, StockMovement, products }) {
  const list = Array.isArray(products) ? products : []
  const catalog = list.filter((product) => isCatalogInventoryProduct(product?.category))
  if (!catalog.length || !StockMovement || !InventoryItem) return list

  const ids = catalog.map((product) => product._id).filter(Boolean)
  const sums = ids.length
    ? await StockMovement.aggregate([
      { $match: { isDeleted: { $ne: true }, itemId: { $in: ids } } },
      { $group: { _id: '$itemId', qty: { $sum: '$change' } } },
    ])
    : []
  const byId = new Map(sums.map((row) => [String(row._id), row.qty]))
  const updates = []

  for (const product of catalog) {
    const nextQty = catalogQuantityFromMovements(byId.get(String(product._id)) || 0)
    const stored = Number(product.quantity || 0)
    if (Math.abs(stored - nextQty) <= 0.0001) continue
    product.quantity = nextQty
    updates.push(InventoryItem.updateOne({ _id: product._id }, { $set: { quantity: nextQty } }))
  }

  if (updates.length) await Promise.all(updates)
  return list
}

/**
 * Catalog product PCS is the signed sum of posted metal voucher line PCS
 * (purchase/receipt +, sale/payment −, product transfer by transferSide).
 */
async function applyCatalogOnHandPcs({ InventoryItem, Transaction, products }) {
  const list = Array.isArray(products) ? products : []
  const catalog = list.filter((product) => isCatalogInventoryProduct(product?.category))
  if (!catalog.length || !Transaction || !InventoryItem) return list

  const byId = new Map()
  const bySku = new Map()
  for (const product of catalog) {
    byId.set(String(product._id), product)
    const sku = String(product.sku || '').trim().toLowerCase()
    if (sku && !bySku.has(sku)) bySku.set(sku, product)
  }

  const txs = await Transaction.find({
    isDeleted: { $ne: true },
    status: 'posted',
    type: { $in: METAL_STOCK_TYPES },
  })
    .select('type voucherMeta.lineItems')
    .lean()

  const pcsById = new Map()
  for (const tx of txs) {
    const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
    for (const line of lines) {
      const delta = resolveVoucherLinePcsDelta(tx.type, line)
      if (!delta) continue
      const directId = line?.inventoryItemId || line?.itemId
      let product = directId ? byId.get(String(directId)) : null
      if (!product) {
        const stock = String(line?.stockCode || '').trim().toLowerCase()
        if (stock) product = bySku.get(stock) || null
      }
      if (!product) {
        const productType = String(line?.productType || '').trim().toLowerCase()
        if (productType) {
          product = bySku.get(productType)
            || catalog.find((row) => String(row.name || '').trim().toLowerCase() === productType)
            || null
        }
      }
      if (!product?._id) continue
      const key = String(product._id)
      pcsById.set(key, (pcsById.get(key) || 0) + delta)
    }
  }

  const updates = []
  for (const product of catalog) {
    const nextPcs = catalogPcsFromSignedSum(pcsById.get(String(product._id)) || 0)
    const stored = Number(product.pcs || 0)
    if (stored === nextPcs) {
      product.pcs = nextPcs
      continue
    }
    product.pcs = nextPcs
    updates.push(InventoryItem.updateOne({ _id: product._id }, { $set: { pcs: nextPcs } }))
  }

  if (updates.length) await Promise.all(updates)
  return list
}

function roundMovementQty(n) {
  return Math.round(Number(n || 0) * 10000) / 10000
}

/**
 * After soft-deleting movements, stored before/after on later rows go stale.
 * Rebuild the active chain oldest→newest so the latest after matches on-hand.
 */
async function rebuildStockMovementQuantityChain(StockMovement, itemId, { session, saveOpts } = {}) {
  if (!StockMovement || !itemId) return { updated: 0, quantity: 0 }
  let query = StockMovement.find({
    itemId,
    isDeleted: { $ne: true },
  }).sort({ createdAt: 1, _id: 1 })
  if (session) query = query.session(session)
  const moves = await query
  let run = 0
  let updated = 0
  const write = saveOpts || (session ? { session } : undefined)
  for (const move of moves) {
    const before = roundMovementQty(run)
    run = roundMovementQty(run + Number(move.change || 0))
    const after = roundMovementQty(run)
    if (
      Math.abs(Number(move.quantityBefore) - before) > 0.00005
      || Math.abs(Number(move.quantityAfter) - after) > 0.00005
    ) {
      move.quantityBefore = before
      move.quantityAfter = after
      await move.save(write)
      updated += 1
    }
  }
  return { updated, quantity: catalogQuantityFromMovements(run) }
}

module.exports = {
  isCatalogInventoryProduct,
  catalogQuantityFromMovements,
  catalogPcsFromSignedSum,
  resolveVoucherLinePcsSign,
  resolveVoucherLinePcsDelta,
  catalogOnHandFromMovements,
  applyCatalogOnHandQuantities,
  applyCatalogOnHandPcs,
  rebuildStockMovementQuantityChain,
  roundMovementQty,
}
