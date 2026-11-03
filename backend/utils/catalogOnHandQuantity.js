function isCatalogInventoryProduct(category) {
  return /(?:^|;)recordType=product(?:;|$)/i.test(String(category || ''))
}

function catalogQuantityFromMovements(movementSum) {
  const qty = Number(movementSum || 0)
  if (!Number.isFinite(qty)) return 0
  return Math.max(0, Number(qty.toFixed(4)))
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
  catalogOnHandFromMovements,
  applyCatalogOnHandQuantities,
  rebuildStockMovementQuantityChain,
  roundMovementQty,
}
