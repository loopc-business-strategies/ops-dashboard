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

module.exports = {
  isCatalogInventoryProduct,
  catalogQuantityFromMovements,
  catalogOnHandFromMovements,
  applyCatalogOnHandQuantities,
}
