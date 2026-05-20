/**
 * Reverse on-hand qty for metal sale/purchase vouchers (StockMovement.reason embeds vocNo)
 * and soft-delete those movements. Ledger lines are handled separately (referenceId on Transaction).
 */

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

async function reverseMetalVoucherStockForVoid({ tx, user, StockMovement, InventoryItem, toQty, deleteReason }) {
  if (!StockMovement || !InventoryItem || !toQty) return
  const vocNo = String(tx?.voucherMeta?.vocNo || '').trim()
  const type = String(tx?.type || '').toLowerCase()
  if (!vocNo || (type !== 'purchase' && type !== 'sale')) return

  const kind = type === 'purchase' ? 'purchase' : 'sale'
  const reasonPattern = new RegExp(
    `Voucher\\s+${kind}\\s*\\([^)]*\\)\\s*#\\s*${escapeRegExp(vocNo)}(?:\\s|$)`,
    'i',
  )

  const movements = await StockMovement.find({
    isDeleted: { $ne: true },
    reason: reasonPattern,
  })

  const now = new Date()
  const reasonText = String(deleteReason || 'void transaction').slice(0, 200)

  for (const mov of movements) {
    const item = await InventoryItem.findById(mov.itemId)
    if (!item || item.isDeleted) continue

    const nextQty = toQty(Number(item.quantity || 0) - Number(mov.change || 0))
    item.quantity = nextQty < 0 ? 0 : nextQty
    item.updatedBy = user._id
    await item.save()

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
