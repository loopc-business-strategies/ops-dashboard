/**
 * Reverse on-hand qty for metal sale/purchase vouchers (StockMovement.reason embeds vocNo)
 * and soft-delete those movements. Ledger lines are handled separately (referenceId on Transaction).
 */

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const {
  isMetalStockType,
  stockMovementReasonPattern,
} = require('./metalStockVoucherTypes')
const { withSession, writeOpts } = require('./mongoTransaction')

async function reverseMetalVoucherStockForVoid({ tx, user, StockMovement, InventoryItem, toQty, deleteReason, session = null }) {
  if (!StockMovement || !InventoryItem || !toQty) return
  const vocNo = String(tx?.voucherMeta?.vocNo || '').trim()
  const type = String(tx?.type || '').toLowerCase()
  if (!vocNo || !isMetalStockType(type)) return

  const reasonPattern = stockMovementReasonPattern(type, vocNo)

  const movements = await withSession(StockMovement.find({
    isDeleted: { $ne: true },
    reason: reasonPattern,
  }), session)

  const now = new Date()
  const reasonText = String(deleteReason || 'void transaction').slice(0, 200)

  for (const mov of movements) {
    const item = await withSession(InventoryItem.findById(mov.itemId), session)
    if (item && !item.isDeleted) {
      const nextQty = Number(item.quantity || 0) - Number(mov.change || 0)
      item.quantity = Math.max(0, toQty(nextQty))
      item.updatedBy = user._id
      await item.save(writeOpts(session))
    }

    mov.isDeleted = true
    mov.deletedAt = now
    mov.deletedBy = user._id
    mov.deleteReason = reasonText
    await mov.save(writeOpts(session))
  }
}

module.exports = {
  escapeRegExp,
  reverseMetalVoucherStockForVoid,
}
