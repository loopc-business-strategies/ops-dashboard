/**
 * Voucher-driven inventory quantity/amount resolution, preparation, and ledger/stock impact.
 */

const {
  isMetalStockInType,
  isMetalStockOutType,
  isMetalStockType,
  isMetalTransferType,
  isMetalProductTransferType,
  buildStockMovementReason,
  sumVoucherLinePureWeight,
} = require('../../utils/metalStockVoucherTypes')
const {
  collectVoucherLineInventoryCandidates,
  scoreInventoryLineMatch,
} = require('../../utils/voucherInventoryLookup')
const { withSession, writeOpts } = require('../../utils/mongoTransaction')
const {
  createLotsFromPurchasePlans,
  assertAndConsumeVaultLotsForStockOut,
} = require('./voucherProductionStockBridge')

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
    if (!plans.length || !(isMetalTransferType(transactionType) || isMetalProductTransferType(transactionType))) return 0

    if (isMetalProductTransferType(transactionType) || isMetalStockOutType(transactionType)) {
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

    if (isMetalProductTransferType(transactionType)) {
      const fromLines = resolvedLines.filter(({ line }) => String(line?.transferSide || '').toLowerCase() === 'from')
      const toLines = resolvedLines.filter(({ line }) => String(line?.transferSide || '').toLowerCase() === 'to')
      if (fromLines.length !== 1 || toLines.length !== 1) {
        throw new Error('Metal transfer requires exactly one From product and one To product')
      }
      if (String(fromLines[0].item._id) === String(toLines[0].item._id)) {
        throw new Error('Metal transfer From and To products must be different')
      }
      const fromPure = sumVoucherLinePureWeight([fromLines[0].line])
      const toPure = sumVoucherLinePureWeight([toLines[0].line])
      if (fromPure <= 0 || toPure <= 0) {
        throw new Error('Metal transfer requires positive pure weight on From and To')
      }
      if (Math.abs(fromPure - toPure) > 0.001) {
        throw new Error(`Metal transfer pure weight mismatch. From pure: ${fromPure.toFixed(3)} g, To pure: ${toPure.toFixed(3)} g`)
      }
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
      const transferSide = String(line?.transferSide || '').toLowerCase()
      const isOutPlan = isMetalStockOutType(transactionType)
        || (isMetalProductTransferType(transactionType) && transferSide === 'from')

      return {
        line,
        item,
        quantity,
        lineAmount,
        inventoryAccountId,
        transferSide: transferSide || null,
        costAmount: isOutPlan ? toMoney(quantity * Number(item.unitCost || 0)) : 0,
      }
    })

    return {
      inventoryPlans,
      purchaseDebitAccountId: inventoryPlans[0]?.inventoryAccountId || null,
      inventoryCreditAccountId: (
        (isMetalTransferType(transactionType) && isMetalStockOutType(transactionType))
        || isMetalProductTransferType(transactionType)
      )
        ? (inventoryPlans.find((p) => p.transferSide === 'from')?.inventoryAccountId
          || inventoryPlans[0]?.inventoryAccountId
          || null)
        : null,
      cogsAccountId: cogsAccount?._id || null,
    }
  }

  const applyStockInPlan = async ({ user, tx, plan, transactionType, session }) => {
    const item = await withSession(InventoryItem.findById(plan.item._id), session)
    if (!item || item.isDeleted) return null

    const beforeQty = Number(item.quantity || 0)
    const movementQty = Number(plan.quantity || 0)
    const nextQty = toQty(beforeQty + movementQty)
    const currentValue = beforeQty * Number(item.unitCost || 0)
    const treatAsTransfer = isMetalTransferType(transactionType) || isMetalProductTransferType(transactionType)
    const incomingValue = treatAsTransfer ? 0 : Number(plan.lineAmount || 0)
    item.quantity = nextQty
    item.lastRestockedAt = tx.date || new Date()
    item.updatedBy = user._id
    if (treatAsTransfer) {
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

    return { item, plan }
  }

  const applyStockOutPlan = async ({ user, tx, plan, transactionType, preparedImpact, session }) => {
    const item = await withSession(InventoryItem.findById(plan.item._id), session)
    if (!item || item.isDeleted) return

    const beforeQty = Number(item.quantity || 0)
    const movementQty = Number(plan.quantity || 0)

    await assertAndConsumeVaultLotsForStockOut({
      user,
      item,
      quantity: movementQty,
      session,
      reason: isMetalProductTransferType(transactionType)
        ? `Metal transfer OUT ${tx.voucherMeta?.vocNo || tx._id}`
        : `Customer metal OUT ${tx.voucherMeta?.vocNo || tx._id}`,
    })

    if (beforeQty + 1e-9 < movementQty) {
      const shown = Math.round(beforeQty * 1000) / 1000
      const need = Math.round(movementQty * 1000) / 1000
      throw new Error(`Insufficient vault stock. Available: ${shown} g, requested: ${need} g.`)
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
    if (
      !isMetalTransferType(transactionType)
      && !isMetalProductTransferType(transactionType)
      && cogsAmount > 0
      && cogsAccountId
      && inventoryAccountId
    ) {
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
        currency: tx.currency || BASE_CURRENCY_CODE,
        exchangeRate: Number(tx.exchangeRate || 1),
      }], writeOpts(session))
    }
  }

  const applyVoucherInventoryImpact = async ({ user, tx, preparedImpact, session = null }) => {
    const transactionType = String(tx?.type || '').toLowerCase()
    const plans = Array.isArray(preparedImpact?.inventoryPlans) ? preparedImpact.inventoryPlans : []
    if (!plans.length || !isMetalStockType(transactionType)) return

    if (isMetalProductTransferType(transactionType)) {
      const fromPlans = plans.filter((plan) => String(plan.transferSide || plan.line?.transferSide || '').toLowerCase() === 'from')
      const toPlans = plans.filter((plan) => String(plan.transferSide || plan.line?.transferSide || '').toLowerCase() === 'to')
      if (fromPlans.length !== 1 || toPlans.length !== 1) {
        throw new Error('Metal transfer requires exactly one From product and one To product')
      }

      for (const plan of fromPlans) {
        await applyStockOutPlan({ user, tx, plan, transactionType, preparedImpact, session })
      }
      for (const plan of toPlans) {
        await applyStockInPlan({ user, tx, plan, transactionType, session })
      }

      try {
        const bridgeResult = await createLotsFromPurchasePlans({ user, tx, plans: toPlans, session })
        if (bridgeResult?.warnings?.length) {
          console.warn(
            '[voucherInventoryImpact] production stock bridge warnings:',
            bridgeResult.warnings.join('; '),
          )
        }
      } catch (err) {
        console.warn(
          '[voucherInventoryImpact] production stock bridge failed:',
          err?.message || err,
        )
        if (session) throw err
      }
      return
    }

    for (const plan of plans) {
      if (isMetalStockInType(transactionType)) {
        await applyStockInPlan({ user, tx, plan, transactionType, session })
        continue
      }

      await applyStockOutPlan({ user, tx, plan, transactionType, preparedImpact, session })
    }

    // Additive: mirror metal stock-in into production vault (NEW_STOCK).
    // Fail soft when no session; with a session rethrow so inventory + lots stay atomic.
    if (isMetalStockInType(transactionType)) {
      try {
        const bridgeResult = await createLotsFromPurchasePlans({ user, tx, plans, session })
        if (bridgeResult?.warnings?.length) {
          console.warn(
            '[voucherInventoryImpact] production stock bridge warnings:',
            bridgeResult.warnings.join('; '),
          )
        }
      } catch (err) {
        console.warn(
          '[voucherInventoryImpact] production stock bridge failed:',
          err?.message || err,
        )
        if (session) throw err
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
