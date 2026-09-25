export function phase08StockMovements(ctx, findings) {
  const phase = '08-stock-movements'
  const { stockMovements, itemById, transactions } = ctx
  let orphanMoves = 0

  const vocNos = new Set(
    transactions.map((t) => String(t?.voucherMeta?.vocNo || '').trim()).filter(Boolean),
  )

  for (const m of stockMovements) {
    const itemId = String(m.itemId || '')
    const entity = { movementId: String(m._id), itemId, change: m.change, reason: m.reason }

    if (!itemById.has(itemId)) {
      orphanMoves += 1
      findings.add({
        domain: 'inventory', phase, severity: 'ERROR', code: 'ORPHAN_STOCK_MOVE',
        message: 'Stock movement references missing inventory item', entity,
      })
      continue
    }

    const change = Number(m.change || 0)
    if (!Number.isFinite(change) || change === 0) {
      findings.add({
        domain: 'inventory', phase, severity: 'WARNING', code: 'ZERO_STOCK_MOVE',
        message: 'Stock movement has zero/invalid change', entity,
      })
    }

    const reason = String(m.reason || '')
    const mentionsVoc = [...vocNos].some((v) => v && reason.includes(v))
    if (reason && !mentionsVoc && !/manual|adjust|opening/i.test(reason)) {
      findings.add({
        domain: 'inventory', phase, severity: 'WARNING', code: 'STOCK_MOVE_UNLINKED_REASON',
        message: 'Stock movement reason does not reference a known voucher number', entity,
      })
    } else {
      findings.add({
        domain: 'inventory', phase, severity: 'PASS', code: 'STOCK_MOVE_OK',
        message: 'Stock movement item exists', entity,
      })
    }
  }

  return { movementCount: stockMovements.length, orphanMoves }
}
