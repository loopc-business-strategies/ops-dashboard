/**
 * Reverse on-hand qty for metal sale/purchase vouchers (StockMovement.reason embeds vocNo)
 * and soft-delete those movements. Ledger lines are handled separately (referenceId on Transaction).
 */

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const {
  isMetalStockType,
  isMetalProductTransferType,
  stockMovementReasonPattern,
} = require('./metalStockVoucherTypes')
const { withSession, writeOpts } = require('./mongoTransaction')
const {
  cancelLotsForVoidedPurchase,
  restoreLotsForVoidedProductTransferOut,
} = require('../services/erpAccounting/voucherProductionStockBridge')

const toMoney = (n) => Math.round(Number(n || 0) * 100) / 100

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
  const outMovements = []

  for (const mov of movements) {
    const item = await withSession(InventoryItem.findById(mov.itemId), session)
    if (item && !item.isDeleted) {
      const change = Number(mov.change || 0)
      const valueDelta = Number(mov.valueDelta || 0)
      const beforeQty = Number(item.quantity || 0)
      const nextQty = Math.max(0, toQty(beforeQty - change))

      if (valueDelta !== 0) {
        // Undo book-value carried with Metal Transfer To IN (or any valued stock-in movement).
        const beforeValue = beforeQty * Number(item.unitCost || 0)
        const nextValue = Math.max(0, beforeValue - valueDelta)
        item.quantity = nextQty
        item.unitCost = nextQty > 0 ? toMoney(nextValue / nextQty) : 0
      } else {
        item.quantity = nextQty
      }
      item.updatedBy = user._id
      await item.save(writeOpts(session))

      if (change < 0) outMovements.push(mov)
    }

    mov.isDeleted = true
    mov.deletedAt = now
    mov.deletedBy = user._id
    mov.deleteReason = reasonText
    await mov.save(writeOpts(session))
  }

  // Soft-cancel unused To/purchase-linked production lots (no hard delete).
  try {
    const bridgeResult = await cancelLotsForVoidedPurchase({
      user,
      tx,
      session,
      deleteReason: reasonText,
    })
    if (bridgeResult?.warnings?.length) {
      console.warn(
        '[metalVoucherStockReversal] production lot void warnings:',
        bridgeResult.warnings.join('; '),
      )
    }
  } catch (err) {
    console.warn(
      '[metalVoucherStockReversal] production lot void bridge failed:',
      err?.message || err,
    )
  }

  // Metal Transfer: recreate From vault lot for OUT qty restored to inventory.
  if (isMetalProductTransferType(type) && outMovements.length) {
    try {
      const restoreResult = await restoreLotsForVoidedProductTransferOut({
        user,
        tx,
        outMovements,
        session,
        deleteReason: reasonText,
      })
      if (restoreResult?.warnings?.length) {
        console.warn(
          '[metalVoucherStockReversal] From lot restore warnings:',
          restoreResult.warnings.join('; '),
        )
      }
    } catch (err) {
      console.warn(
        '[metalVoucherStockReversal] From lot restore failed:',
        err?.message || err,
      )
    }
  }
}

module.exports = {
  escapeRegExp,
  reverseMetalVoucherStockForVoid,
}
