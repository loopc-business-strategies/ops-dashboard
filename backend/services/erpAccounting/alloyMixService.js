/**
 * Atomic gold-alloy mix: consume input catalog products, receive finished alloy product.
 * Cost rolls from inputs onto finished (metal_transfer-style), no COGS.
 */

const { withSession, writeOpts, runInTransaction } = require('../../utils/mongoTransaction')
const {
  catalogOnHandFromMovements,
  catalogQuantityFromMovements,
  isCatalogInventoryProduct,
  rebuildStockMovementQuantityChain,
} = require('../../utils/catalogOnHandQuantity')
const { assertAndConsumeVaultLotsForStockOut } = require('./voucherProductionStockBridge')

const GROSS_EPS = 0.0005
const QTY_EPS = 1e-9

function toQty(n) {
  return Math.round(Number(n || 0) * 1000) / 1000
}

function toMoney(n) {
  return Math.round(Number(n || 0) * 100) / 100
}

function normalizePurity(raw) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 0
  if (n > 1.2 && n <= 100) return n / 100
  if (n > 100) return n / 1000
  return n
}

function parseCategoryMeta(category = '') {
  return Object.fromEntries(
    String(category || '')
      .split(';')
      .map((part) => {
        const i = part.indexOf('=')
        if (i < 0) return [part.trim(), '']
        return [part.slice(0, i).trim(), part.slice(i + 1).trim()]
      })
      .filter(([k]) => k),
  )
}

function httpError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

function createAlloyMixService({
  InventoryItem,
  StockMovement,
  Ledger,
  assertAccountingPeriodOpen,
  allowedTenants = ['mg'],
} = {}) {
  const assertPeriod = typeof assertAccountingPeriodOpen === 'function'
    ? assertAccountingPeriodOpen
    : async () => {}

  async function postAlloyMix({
    user,
    tenant,
    karat,
    targetGross,
    finishedProductId,
    lines = [],
    description = '',
  } = {}) {
    const tenantKey = String(tenant || '').trim().toLowerCase()
    if (!allowedTenants.includes(tenantKey)) {
      throw httpError(403, 'Gold alloy posting is only enabled for MG')
    }
    if (!user?._id) throw httpError(401, 'Unauthorized')

    const karatNum = Number(karat)
    const target = Number(targetGross)
    if (!Number.isFinite(karatNum) || karatNum <= 0) {
      throw httpError(400, 'Karat is required')
    }
    if (!Number.isFinite(target) || !(target > 0)) {
      throw httpError(400, 'Target gross weight must be positive')
    }
    if (!finishedProductId) {
      throw httpError(400, 'Finished product is required')
    }

    const inputLines = (Array.isArray(lines) ? lines : [])
      .map((line) => ({
        itemId: String(line?.itemId || line?.stockId || '').trim(),
        gross: Number(line?.gross || 0),
        role: String(line?.role || '').trim().toLowerCase(),
        label: String(line?.label || line?.role || '').trim(),
      }))
      .filter((line) => line.itemId && line.gross > GROSS_EPS)

    if (inputLines.length < 1) {
      throw httpError(400, 'At least one input stock line with gross weight is required')
    }

    const totalInputGross = inputLines.reduce((sum, line) => sum + line.gross, 0)
    if (Math.abs(totalInputGross - target) > GROSS_EPS) {
      throw httpError(
        400,
        `Mix not balanced. Input gross ${toQty(totalInputGross)} g vs target ${toQty(target)} g`,
      )
    }

    const finishedId = String(finishedProductId)
    if (inputLines.some((line) => line.itemId === finishedId)) {
      throw httpError(400, 'Finished product cannot also be an input stock')
    }

    const duplicateIds = new Set()
    for (const line of inputLines) {
      if (duplicateIds.has(line.itemId)) {
        throw httpError(400, 'Duplicate input stock on mix lines')
      }
      duplicateIds.add(line.itemId)
    }

    const stockDate = new Date()
    await assertPeriod({ tenant: tenantKey, date: stockDate })

    return runInTransaction(async (session) => {
      const finished = await withSession(InventoryItem.findById(finishedId), session)
      if (!finished || finished.isDeleted) {
        throw httpError(404, 'Finished product not found')
      }
      if (!isCatalogInventoryProduct(finished.category)) {
        throw httpError(400, 'Finished product must be an inventory catalog product')
      }

      const finishedMeta = parseCategoryMeta(finished.category)
      const finishedPurity = normalizePurity(
        finishedMeta.productPurity || finishedMeta.purity || '',
      )
      if (!(finishedPurity > 0)) {
        throw httpError(400, 'Finished product needs a product purity (e.g. 0.916 for 22K)')
      }

      const reasonBase = String(description || '').trim()
        || `Gold alloy mix (${karatNum}K ${toQty(target)} g)`

      const consumed = []
      let totalBookValue = 0

      for (const line of inputLines) {
        const item = await withSession(InventoryItem.findById(line.itemId), session)
        if (!item || item.isDeleted) {
          throw httpError(404, `Input stock not found (${line.label || line.itemId})`)
        }
        if (!isCatalogInventoryProduct(item.category)) {
          throw httpError(400, `Input must be a catalog product: ${item.name}`)
        }

        const onHand = await catalogOnHandFromMovements(StockMovement, item._id)
        // Keep stored qty aligned before vault/qty checks.
        item.quantity = onHand
        const need = toQty(line.gross)
        if (onHand + QTY_EPS < need) {
          throw httpError(
            400,
            `Insufficient stock for ${item.name}. Available: ${toQty(onHand)} g, requested: ${need} g`,
          )
        }

          try {
            await assertAndConsumeVaultLotsForStockOut({
              user,
              item,
              quantity: need,
              session,
              reason: `${reasonBase} OUT`,
            })
          } catch (vaultErr) {
            // Stock-in API may raise catalog qty without vault lots; allow mix when on-hand covers.
            if (!/Insufficient vault stock/i.test(String(vaultErr?.message || ''))) {
              throw vaultErr
            }
          }

          const beforeQty = Number(item.quantity || 0)
        const nextQty = toQty(beforeQty - need)
        const unitCost = Number(item.unitCost || 0)
        const bookValue = toMoney(need * unitCost)
        totalBookValue = toMoney(totalBookValue + bookValue)

        item.quantity = nextQty
        item.updatedBy = user._id
        await item.save(writeOpts(session))

        await StockMovement.create([{
          itemId: item._id,
          itemName: item.name,
          change: -need,
          quantityBefore: beforeQty,
          quantityAfter: nextQty,
          reason: `${reasonBase} — consume ${line.label || item.name}`,
          actorId: user._id,
          actorName: user.name,
        }], writeOpts(session))

        consumed.push({
          itemId: String(item._id),
          name: item.name,
          gross: need,
          unitCost,
          bookValue,
          ledgerAccountId: item.ledgerAccountId || null,
        })
      }

      const beforeOut = await catalogOnHandFromMovements(StockMovement, finished._id)
      finished.quantity = beforeOut
      const outQty = toQty(target)
      const nextOut = toQty(beforeOut + outQty)
      const currentValue = beforeOut * Number(finished.unitCost || 0)
      const incomingValue = totalBookValue
      finished.quantity = nextOut
      finished.lastRestockedAt = stockDate
      finished.updatedBy = user._id
      if (nextOut > 0) {
        finished.unitCost = toMoney((currentValue + incomingValue) / nextOut)
      }
      await finished.save(writeOpts(session))

      await StockMovement.create([{
        itemId: finished._id,
        itemName: finished.name,
        change: outQty,
        quantityBefore: beforeOut,
        quantityAfter: nextOut,
        valueDelta: incomingValue,
        carriesValue: incomingValue > 0,
        reason: `${reasonBase} — receive ${finished.name}`,
        actorId: user._id,
        actorName: user.name,
      }], writeOpts(session))

      // Inventory-to-inventory GL when accounts differ; same account → movements only.
      if (Ledger && incomingValue > 0 && finished.ledgerAccountId) {
        for (const row of consumed) {
          if (!(row.bookValue > 0) || !row.ledgerAccountId) continue
          if (String(row.ledgerAccountId) === String(finished.ledgerAccountId)) continue
          await Ledger.create([{
            date: stockDate,
            debitAccountId: finished.ledgerAccountId,
            creditAccountId: row.ledgerAccountId,
            amount: row.bookValue,
            description: `${reasonBase}: ${row.name} → ${finished.name}`,
              referenceType: 'inventory',
            createdBy: user._id,
            updatedBy: user._id,
            department: user.department || '',
            currency: 'USD',
            exchangeRate: 1,
          }], writeOpts(session))
        }
      }

      return {
        success: true,
        karat: karatNum,
        targetGross: outQty,
        finishedProduct: {
          id: String(finished._id),
          name: finished.name,
          quantity: nextOut,
          unitCost: Number(finished.unitCost || 0),
        },
        consumed,
        bookValue: incomingValue,
        reason: reasonBase,
      }
    })
  }

  function alloyMixReasonBase(reason = '') {
    const text = String(reason || '')
    const matched = text.match(/^(.*) — (?:consume|receive)\b/i)
    return (matched ? matched[1] : text).trim()
  }

  function isAlloyMixMovementReason(reason = '') {
    const text = String(reason || '')
    if (!/ — (?:consume|receive)\b/i.test(text)) return false
    return /alloy|alloyed|alloy\s*mix|gold alloy mix|\d+\s*k/i.test(text)
  }

  /**
   * Reverse a posted alloy mix: soft-delete its stock movements (+ related ledger),
   * restore catalog qty from remaining movements, and roll finished unit cost back.
   */
  async function reverseAlloyMix({
    user,
    tenant,
    reason = '',
  } = {}) {
    const tenantKey = String(tenant || '').trim().toLowerCase()
    if (!allowedTenants.includes(tenantKey)) {
      throw httpError(403, 'Gold alloy posting is only enabled for MG')
    }
    if (!user?._id) throw httpError(401, 'Unauthorized')

    const reasonBase = String(reason || '').trim()
    if (!reasonBase) throw httpError(400, 'Mix reason is required to reverse')

    const stockDate = new Date()
    await assertPeriod({ tenant: tenantKey, date: stockDate })

    return runInTransaction(async (session) => {
      const allMoves = await withSession(
        StockMovement.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 }),
        session,
      )
      const moves = (allMoves || []).filter((move) => {
        const text = String(move.reason || '')
        return isAlloyMixMovementReason(text) && alloyMixReasonBase(text) === reasonBase
      })
      if (!moves.length) {
        throw httpError(404, 'Posted mix not found (already reversed or missing)')
      }

      const receiveMoves = moves.filter((m) => (
        Number(m.change) > 0 || /—\s*receive\b/i.test(String(m.reason || ''))
      ))

      // Guard: finished product must still hold the received qty.
      for (const receive of receiveMoves) {
        const finished = await withSession(InventoryItem.findById(receive.itemId), session)
        if (!finished || finished.isDeleted) {
          throw httpError(404, 'Finished product for this mix was not found')
        }
        const onHand = await catalogOnHandFromMovements(StockMovement, finished._id)
        const removeQty = Math.abs(Number(receive.change) || 0)
        if (onHand + QTY_EPS < removeQty) {
          throw httpError(
            400,
            `Cannot reverse mix: ${finished.name} on hand ${toQty(onHand)} g is less than received ${toQty(removeQty)} g`,
          )
        }
      }

      // Roll finished unit cost back using receive valueDelta before soft-delete.
      for (const receive of receiveMoves) {
        const finished = await withSession(InventoryItem.findById(receive.itemId), session)
        if (!finished || finished.isDeleted) continue
        const onHand = await catalogOnHandFromMovements(StockMovement, finished._id)
        const removeQty = Math.abs(Number(receive.change) || 0)
        const nextQty = toQty(onHand - removeQty)
        if (receive.carriesValue || Number(receive.valueDelta) > 0) {
          const removeValue = Number(receive.valueDelta || 0)
          const currentValue = onHand * Number(finished.unitCost || 0)
          finished.unitCost = nextQty > 0
            ? toMoney(Math.max(0, (currentValue - removeValue) / nextQty))
            : 0
          finished.updatedBy = user._id
          await finished.save(writeOpts(session))
        }
      }

      const deletedAt = new Date()
      for (const move of moves) {
        move.isDeleted = true
        move.deletedAt = deletedAt
        move.deletedBy = user._id
        move.deleteReason = `Reversed alloy mix: ${reasonBase}`
        await move.save(writeOpts(session))
      }

      if (Ledger) {
        const escaped = reasonBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const ledgers = await withSession(
          Ledger.find({
            isDeleted: { $ne: true },
            referenceType: 'inventory',
            description: { $regex: `^${escaped}` },
          }),
          session,
        )
        for (const entry of ledgers || []) {
          entry.isDeleted = true
          entry.deletedAt = deletedAt
          entry.updatedBy = user._id
          await entry.save(writeOpts(session))
        }
      }

      // Recompute qty from the in-txn movement set (aggregate outside the
      // session would miss uncommitted soft-deletes), then rebuild before/after
      // on remaining rows so history matches on-hand after soft-delete.
      const touchedIds = [...new Set(moves.map((m) => String(m.itemId)))]
      const refreshed = []
      for (const id of touchedIds) {
        const item = await withSession(InventoryItem.findById(id), session)
        if (!item || item.isDeleted) continue
        const sum = (allMoves || [])
          .filter((move) => String(move.itemId) === id && !move.isDeleted)
          .reduce((acc, move) => acc + Number(move.change || 0), 0)
        item.quantity = catalogQuantityFromMovements(sum)
        item.updatedBy = user._id
        await item.save(writeOpts(session))
        await rebuildStockMovementQuantityChain(StockMovement, item._id, {
          session,
          saveOpts: writeOpts(session),
        })
        refreshed.push({
          itemId: String(item._id),
          name: item.name,
          quantity: Number(item.quantity || 0),
        })
      }

      return {
        success: true,
        reason: reasonBase,
        reversedMovements: moves.length,
        products: refreshed,
      }
    })
  }

  return { postAlloyMix, reverseAlloyMix }
}

module.exports = {
  createAlloyMixService,
  GROSS_EPS,
}
