/**
 * Voucher-driven inventory quantity/amount resolution, preparation, and ledger/stock impact.
 */

const {
  isMetalStockInType,
  isMetalStockOutType,
  isMetalStockType,
  isMetalTransferType,
  buildStockMovementReason,
} = require('../../utils/metalStockVoucherTypes')
const {
  collectVoucherLineInventoryCandidates,
  scoreInventoryLineMatch,
} = require('../../utils/voucherInventoryLookup')
const { withSession, writeOpts } = require('../../utils/mongoTransaction')

function createVoucherInventoryImpactService({
  ensureAccountByCode,
  InventoryItem,
  StockMovement,
  Ledger,
  toQty,
  toMoney,
  BASE_CURRENCY_CODE,
}) {
  const resolveVoucherInventoryLineQuantity = (line = {}) => {
    const grossWeight = Number(line.grossWeight || 0)
    if (grossWeight > 0) return toQty(grossWeight)

    const pureWeight = Number(line.pureWeight || 0)
    if (pureWeight > 0) return toQty(pureWeight)

    const weightInOz = Number(line.weightInOz || 0)
    if (weightInOz > 0) return toQty(weightInOz * 31.1034768)

    const pcs = Number(line.pcs || 0)
    if (pcs > 0) return toQty(pcs)

    return 0
  }

  const resolveVoucherInventoryLineAmount = (line = {}) => {
    const candidates = [line.amountLC, line.totalAmount, line.metalAmount, line.amountFC, line.amountWithVAT]
    for (const candidate of candidates) {
      const amount = Number(candidate || 0)
      if (Number.isFinite(amount) && amount > 0) return toMoney(amount)
    }
    return 0
  }

  const resolveTransferPostingAmount = (preparedImpact, transactionType) => {
    const plans = Array.isArray(preparedImpact?.inventoryPlans) ? preparedImpact.inventoryPlans : []
    if (!plans.length || !isMetalTransferType(transactionType)) return 0

    if (isMetalStockOutType(transactionType)) {
      return toMoney(plans.reduce((sum, plan) => sum + Number(plan.costAmount || 0), 0))
    }

    return toMoney(plans.reduce((sum, plan) => {
      const lineAmount = Number(plan.lineAmount || 0)
      if (lineAmount > 0) return sum + lineAmount
      const qty = Number(plan.quantity || 0)
      const unitCost = Number(plan.item?.unitCost || 0)
      return sum + (qty * unitCost)
    }, 0))
  }

  const resolveVoucherInventoryItems = async (tx, session = null) => {
    const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
    const resolved = []

    for (const line of lines) {
      const candidates = await collectVoucherLineInventoryCandidates(line, session)
      if (!candidates.length) continue

      const best = [...candidates].sort((a, b) => scoreInventoryLineMatch(b, line) - scoreInventoryLineMatch(a, line))[0]
      const item = await withSession(InventoryItem.findById(best._id), session)
      if (!item) continue

      const quantity = resolveVoucherInventoryLineQuantity(line)
      if (quantity <= 0) continue

      resolved.push({
        line,
        item,
        quantity,
        lineAmount: resolveVoucherInventoryLineAmount(line),
      })
    }

    return resolved
  }

  const prepareVoucherInventoryImpact = async ({ user, tx, session = null }) => {
    const transactionType = String(tx?.type || '').toLowerCase()
    if (!isMetalStockType(transactionType)) {
      return { inventoryPlans: [], purchaseDebitAccountId: null, cogsAccountId: null }
    }

    const resolvedLines = await resolveVoucherInventoryItems(tx, session)
    if (!resolvedLines.length) {
      return { inventoryPlans: [], purchaseDebitAccountId: null, cogsAccountId: null }
    }

    const defaultInventoryAccount = await ensureAccountByCode({
      user,
      code: '1300',
      name: 'Metal Inventory',
      accountType: 'Asset',
      currency: tx.currency || BASE_CURRENCY_CODE,
      session,
    })
    const cogsAccount = isMetalStockOutType(transactionType) && !isMetalTransferType(transactionType)
      ? await ensureAccountByCode({
        user,
        code: '5101',
        name: 'Cost Of Goods Sold',
        accountType: 'Expense',
        currency: tx.currency || BASE_CURRENCY_CODE,
        session,
      })
      : null

    const inventoryPlans = resolvedLines.map(({ line, item, quantity, lineAmount }) => {
      const inventoryAccountId = item.ledgerAccountId || defaultInventoryAccount._id

      return {
        line,
        item,
        quantity,
        lineAmount,
        inventoryAccountId,
        costAmount: isMetalStockOutType(transactionType) ? toMoney(quantity * Number(item.unitCost || 0)) : 0,
      }
    })

    return {
      inventoryPlans,
      purchaseDebitAccountId: inventoryPlans[0]?.inventoryAccountId || null,
      inventoryCreditAccountId: isMetalTransferType(transactionType) && isMetalStockOutType(transactionType)
        ? (inventoryPlans[0]?.inventoryAccountId || null)
        : null,
      cogsAccountId: cogsAccount?._id || null,
    }
  }

  const applyVoucherInventoryImpact = async ({ user, tx, preparedImpact, session = null }) => {
    const transactionType = String(tx?.type || '').toLowerCase()
    const plans = Array.isArray(preparedImpact?.inventoryPlans) ? preparedImpact.inventoryPlans : []
    if (!plans.length || !isMetalStockType(transactionType)) return

    for (const plan of plans) {
      const item = await withSession(InventoryItem.findById(plan.item._id), session)
      if (!item || item.isDeleted) continue

      const beforeQty = Number(item.quantity || 0)
      const movementQty = Number(plan.quantity || 0)

      if (isMetalStockInType(transactionType)) {
        const nextQty = toQty(beforeQty + movementQty)
        const currentValue = beforeQty * Number(item.unitCost || 0)
        const incomingValue = isMetalTransferType(transactionType) ? 0 : Number(plan.lineAmount || 0)
        item.quantity = nextQty
        item.lastRestockedAt = tx.date || new Date()
        item.updatedBy = user._id
        if (isMetalTransferType(transactionType)) {
          item.unitCost = nextQty > 0 ? toMoney(currentValue / nextQty) : 0
        } else if (incomingValue > 0 && nextQty > 0) {
          item.unitCost = toMoney((currentValue + incomingValue) / nextQty)
        }
        await item.save(writeOpts(session))

        await StockMovement.create([{
          itemId: item._id,
          itemName: item.name,
          change: movementQty,
          quantityBefore: beforeQty,
          quantityAfter: nextQty,
          reason: buildStockMovementReason(tx, transactionType),
          actorId: user._id,
          actorName: user.name,
        }], writeOpts(session))
        continue
      }

      const nextQty = toQty(beforeQty - movementQty)
      item.quantity = nextQty
      item.updatedBy = user._id
      await item.save(writeOpts(session))

      await StockMovement.create([{
        itemId: item._id,
        itemName: item.name,
        change: -movementQty,
        quantityBefore: beforeQty,
        quantityAfter: nextQty,
        reason: buildStockMovementReason(tx, transactionType),
        actorId: user._id,
        actorName: user.name,
      }], writeOpts(session))

      const cogsAmount = Number(plan.costAmount || 0)
      const cogsAccountId = preparedImpact?.cogsAccountId || null
      const inventoryAccountId = plan.inventoryAccountId || item.ledgerAccountId || null
      if (!isMetalTransferType(transactionType) && cogsAmount > 0 && cogsAccountId && inventoryAccountId) {
        await Ledger.create([{
          date: tx.voucherMeta?.valueDate || tx.date || new Date(),
          debitAccountId: cogsAccountId,
          creditAccountId: inventoryAccountId,
          amount: cogsAmount,
          description: `COGS for ${item.name}${tx.voucherMeta?.vocNo ? ` #${tx.voucherMeta.vocNo}` : ''}`,
          referenceType: 'cogs',
          referenceId: tx._id,
          createdBy: user._id,
          updatedBy: user._id,
          department: user.department || tx.department || '',
          currency: tx.currency || 'USD',
          exchangeRate: Number(tx.exchangeRate || 1),
        }], writeOpts(session))
      }
    }
  }

  return {
    resolveVoucherInventoryLineQuantity,
    resolveVoucherInventoryLineAmount,
    resolveTransferPostingAmount,
    resolveVoucherInventoryItems,
    prepareVoucherInventoryImpact,
    applyVoucherInventoryImpact,
  }
}

module.exports = {
  createVoucherInventoryImpactService,
}
