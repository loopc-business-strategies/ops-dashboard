import { toMoney, toQty, withinQtyTol, resolvePurityRatio } from '../lib/money.mjs'

export function phase07Inventory(ctx, findings) {
  const phase = '07-inventory'
  const { inventoryItems, movesByItem } = ctx
  let differences = 0

  for (const item of inventoryItems) {
    const id = String(item._id)
    const moves = movesByItem.get(id) || []
    const calculated = toQty(moves.reduce((s, m) => s + Number(m.change || 0), 0))
    const stored = toQty(item.quantity || 0)
    const entity = { itemId: id, name: item.name, sku: item.sku }
    const diff = toQty(stored - calculated)

    if (withinQtyTol(stored, calculated)) {
      findings.add({
        domain: 'inventory', phase, severity: 'PASS', code: 'INV_QTY_MATCH',
        message: 'Inventory quantity matches sum of stock movements', entity,
        expected: calculated, actual: stored, difference: 0,
      })
    } else {
      differences += 1
      findings.add({
        domain: 'inventory', phase, severity: Math.abs(diff) > 1 ? 'CRITICAL' : 'ERROR',
        code: 'INV_QTY_MISMATCH',
        message: 'Inventory quantity differs from sum of stock movements', entity,
        expected: calculated, actual: stored, difference: diff,
      })
    }

    const unitCost = Number(item.unitCost || 0)
    const qty = Math.max(0, stored)
    // Book value using gross × unitCost (stored book); pure display is UI-layer
    const bookValue = toMoney(qty * unitCost)
    findings.add({
      domain: 'inventory', phase, severity: 'INFORMATIONAL', code: 'INV_BOOK_VALUE',
      message: 'Book inventory value = qty × unitCost (not live MTM)', entity,
      actual: bookValue,
    })
  }

  return { itemCount: inventoryItems.length, differences }
}
