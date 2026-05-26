/**
 * Reverse on-hand qty for metal sale/purchase vouchers (StockMovement.reason embeds vocNo)
 * and soft-delete those movements. Ledger lines are handled separately (referenceId on Transaction).
 */

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const {
  isMetalStockType,
  stockMovementReasonPattern,
} = require('./metalStockVoucherTypes')

async function reverseMetalVoucherStockForVoid({ tx, user, StockMovement, InventoryItem, toQty, deleteReason }) {
  if (!StockMovement || !InventoryItem || !toQty) return
  const vocNo = String(tx?.voucherMeta?.vocNo || '').trim()
  const type = String(tx?.type || '').toLowerCase()
  if (!vocNo || !isMetalStockType(type)) return

  const reasonPattern = stockMovementReasonPattern(type, vocNo)

  const movements = await StockMovement.find({
    isDeleted: { $ne: true },
    reason: reasonPattern,
  })

  const now = new Date()
  const reasonText = String(deleteReason || 'void transaction').slice(0, 200)

  for (const mov of movements) {
    const item = await InventoryItem.findById(mov.itemId)
    if (item && !item.isDeleted) {
      const nextQty = Number(item.quantity || 0) - Number(mov.change || 0)
      item.quantity = Math.max(0, toQty(nextQty))
      item.updatedBy = user._id
      await item.save()
    }

    mov.isDeleted = true
    mov.deletedAt = now
    mov.deletedBy = user._id
    mov.deleteReason = reasonText
    await mov.save()
  }
}

module.exports = {
  escapeRegExp,
  reverseMetalVoucherStockForVoid,
}
