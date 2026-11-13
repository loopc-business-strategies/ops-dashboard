/**
 * Atomic gold-alloy mix: consume input catalog products, receive finished alloy product.
 * Cost rolls from inputs onto finished (metal_transfer-style), no COGS.
 * Oxidation (input gross > finished): AML metal_payment rows update Metal Loss grams only
 * ($0 amount). Currency on Metal Loss is entered manually — never auto-posted.
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
/** AccountMapping.mappingType for oxidation / melting metal loss on alloy Update. */
const ALLOY_METAL_LOSS_MAPPING_TYPE = 'alloy_metal_loss'

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

function resolveLossMetalStockCode({ role = '', label = '', name = '', category = '' } = {}) {
  const blob = `${role} ${label} ${name} ${category}`.toLowerCase()
  if (/\b(silv|xag|ag)\b/.test(blob) || blob.includes('silver')) return 'XAG'
  if (/\b(plat|xpt)\b/.test(blob) || blob.includes('platinum')) return 'XPT'
  if (/\b(pall|xpd)\b/.test(blob) || blob.includes('palladium')) return 'XPD'
  // Copper / base alloy — still tracked as gold bucket unless clearly silver.
  return 'XAU'
}

function alloyMetalLossPositionRef(reasonBase = '') {
  return `alloy-metal-loss:${String(reasonBase || '').trim()}`
}

function createAlloyMixService({
  InventoryItem,
  StockMovement,
  Ledger,
  AccountMapping,
  Transaction,
  ChartOfAccount,
  assertAccountingPeriodOpen,
  allowedTenants = ['mg'],
} = {}) {
  const assertPeriod = typeof assertAccountingPeriodOpen === 'function'
    ? assertAccountingPeriodOpen
    : async () => {}

  async function resolveAlloyMetalLossMapping(session = null) {
    if (!AccountMapping) return null
    return withSession(
      AccountMapping.findOne({ mappingType: ALLOY_METAL_LOSS_MAPPING_TYPE, isActive: true })
        .select('debitAccountId creditAccountId mappingType description')
        .lean(),
      session,
    )
  }

  async function postMetalLossPositionVoucher({
    user,
    session,
    stockDate,
    reasonBase,
    metalLossMapping,
    lossLines = [],
  }) {
    if (!Transaction || !(metalLossMapping?.debitAccountId) || !lossLines.length) return null

    let party = null
    if (ChartOfAccount) {
      party = await withSession(
        ChartOfAccount.findById(metalLossMapping.debitAccountId)
          .select('accountCode accountName')
          .lean(),
        session,
      )
    }

    const weightedLines = lossLines
      .filter((row) => Number(row.lossGross) > GROSS_EPS)
      .map((row) => {
        const lossGross = toQty(row.lossGross)
        const stockCode = resolveLossMetalStockCode(row)
        return {
          inventoryItemId: row.itemId || null,
          stockCode,
          productType: row.name || row.label || '',
          grossWeight: lossGross,
          purity: 1,
          pureWeight: lossGross,
          narration: `Alloy metal loss ${lossGross} g ${row.name || row.label || stockCode}`,
          currCode: 'USD',
          currRate: 1,
        }
      })
    if (!weightedLines.length) return null

    // One metal_payment per metal so Gold/Silver statements never share a voucher row.
    const createdIds = []
    for (let i = 0; i < weightedLines.length; i += 1) {
      const line = weightedLines[i]
      const vocSuffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${i}`
      const [created] = await Transaction.create([{
        type: 'metal_payment',
        amount: 0,
        date: stockDate,
        description: `${reasonBase}: metal loss position (${line.stockCode})`,
        currency: 'USD',
        exchangeRate: 1,
        debitAccountId: metalLossMapping.debitAccountId,
        creditAccountId: metalLossMapping.creditAccountId || null,
        mappingId: metalLossMapping._id || null,
        status: 'posted',
        createdBy: user._id,
        updatedBy: user._id,
        postedBy: user._id,
        voucherMeta: {
          partyAccountId: metalLossMapping.debitAccountId,
          partyCode: String(party?.accountCode || '').trim(),
          partyName: String(party?.accountName || 'Metal Loss').trim(),
          vocNo: `AML-${vocSuffix}`,
          refNo: alloyMetalLossPositionRef(reasonBase),
          fixingType: 'non-fixing',
          hedge: false,
          docDate: stockDate,
          valueDate: stockDate,
          postedDate: stockDate,
          lineItems: [line],
        },
        auditTrail: [{
          action: 'posted',
          fromStatus: 'draft',
          toStatus: 'posted',
          comment: `Alloy oxidation metal-loss position ${line.stockCode} (unfixed grams, no cash)`,
          actorId: user._id,
        }],
      }], writeOpts(session))
      if (created?._id) createdIds.push(String(created._id))
    }

    return createdIds.length ? { _id: createdIds[0], ids: createdIds } : null
  }

  async function reverseMetalLossPositionVouchers({ user, session, reasonBase, deletedAt }) {
    if (!Transaction) return 0
    const refNo = alloyMetalLossPositionRef(reasonBase)
    const txs = await withSession(
      Transaction.find({
        isDeleted: { $ne: true },
        type: 'metal_payment',
        'voucherMeta.refNo': refNo,
      }),
      session,
    )
    for (const tx of txs || []) {
      tx.isDeleted = true
      tx.deletedAt = deletedAt
      tx.updatedBy = user._id
      await tx.save(writeOpts(session))
    }
    return (txs || []).length
  }

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
      .map((line) => {
        const gross = Number(line?.gross || 0)
        const remainRaw = line?.remainGross
        const remainGross = remainRaw === '' || remainRaw == null
          ? null
          : Number(remainRaw)
        return {
          itemId: String(line?.itemId || line?.stockId || '').trim(),
          gross,
          remainGross: Number.isFinite(remainGross) ? remainGross : null,
          role: String(line?.role || '').trim().toLowerCase(),
          label: String(line?.label || line?.role || '').trim(),
        }
      })
      .filter((line) => line.itemId && line.gross > GROSS_EPS)

    for (const line of inputLines) {
      if (line.remainGross == null) continue
      if (line.remainGross < -GROSS_EPS) {
        throw httpError(400, `Remaining gross cannot be negative (${line.label || line.itemId})`)
      }
      if (line.remainGross > line.gross + GROSS_EPS) {
        throw httpError(
          400,
          `Remaining ${toQty(line.remainGross)} g exceeds consume ${toQty(line.gross)} g`
          + ` (${line.label || line.itemId})`,
        )
      }
    }

    if (inputLines.length < 1) {
      throw httpError(400, 'At least one input stock line with gross weight is required')
    }

    const totalInputGross = inputLines.reduce((sum, line) => sum + line.gross, 0)
    const metalLossGross = toQty(totalInputGross - target)
    if (totalInputGross + GROSS_EPS < target) {
      throw httpError(
        400,
        `Mix not balanced. Input gross ${toQty(totalInputGross)} g is less than finished ${toQty(target)} g`,
      )
    }
    if (metalLossGross > GROSS_EPS && !AccountMapping) {
      throw httpError(
        400,
        `Metal loss ${metalLossGross} g needs AccountMapping type "${ALLOY_METAL_LOSS_MAPPING_TYPE}"`,
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
      let metalLossMapping = null
      if (metalLossGross > GROSS_EPS) {
        metalLossMapping = await resolveAlloyMetalLossMapping(session)
        // Debit = Metal Loss party for AML gram position only (no auto USD expense).
        if (!metalLossMapping?.debitAccountId) {
          throw httpError(
            400,
            `Metal loss ${metalLossGross} g: create active mapping "${ALLOY_METAL_LOSS_MAPPING_TYPE}" `
            + '(debit = Metal Loss account for metal balance)',
          )
        }
      }

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

        // Optional UI remain — validated below; Metal Loss grams use input-share split, not this delta.
        const remainGross = line.remainGross != null
          ? toQty(Math.max(0, line.remainGross))
          : null
        const consumeLabel = line.label || item.name

        consumed.push({
          itemId: String(item._id),
          name: item.name,
          category: item.category || '',
          role: line.role,
          label: line.label,
          consumeLabel,
          gross: need,
          remainGross,
          lossGross: null,
          unitCost,
          bookValue,
          ledgerAccountId: item.ledgerAccountId || null,
          quantityBefore: beforeQty,
          quantityAfter: nextQty,
        })
      }

      const hasPerLineRemain = consumed.some((row) => row.remainGross != null)
      if (hasPerLineRemain) {
        const remainSum = toQty(consumed.reduce((sum, row) => (
          sum + (row.remainGross != null ? Number(row.remainGross) : Number(row.gross))
        ), 0))
        if (Math.abs(remainSum - target) > GROSS_EPS) {
          throw httpError(
            400,
            `Remaining metals ${remainSum} g must equal finished target ${toQty(target)} g`,
          )
        }
      }

      // Metal Loss AML: always input-share × total loss (e.g. gold 50/85.715 × 4 = 2.333),
      // not UI per-metal remain deltas. Last line absorbs rounding.
      const lossRatio = totalInputGross > 0 && metalLossGross > GROSS_EPS
        ? (metalLossGross / totalInputGross)
        : 0
      let allocatedLoss = 0
      for (let i = 0; i < consumed.length; i += 1) {
        const row = consumed[i]
        const isLast = i === consumed.length - 1
        if (metalLossGross > GROSS_EPS) {
          const shareLoss = isLast
            ? toQty(metalLossGross - allocatedLoss)
            : toQty(Number(row.gross) * lossRatio)
          if (!isLast) allocatedLoss = toQty(allocatedLoss + shareLoss)
          row.lossGross = shareLoss
          row.remainGross = toQty(Number(row.gross) - shareLoss)
        } else {
          row.lossGross = 0
          if (row.remainGross == null) row.remainGross = row.gross
        }
        row.lineLossRatio = row.gross > GROSS_EPS ? (row.lossGross / row.gross) : 0
      }

      // Vault consume movements (remain encoded after proportional split for Inputs OUT).
      for (const row of consumed) {
        const consumeReason = row.remainGross != null && Number(row.lossGross) > GROSS_EPS
          ? `${reasonBase} — consume ${row.consumeLabel} (remain ${toQty(row.remainGross)} g)`
          : `${reasonBase} — consume ${row.consumeLabel}`
        await StockMovement.create([{
          itemId: row.itemId,
          itemName: row.name,
          change: -Number(row.gross),
          quantityBefore: row.quantityBefore,
          quantityAfter: row.quantityAfter,
          reason: consumeReason,
          actorId: user._id,
          actorName: user.name,
        }], writeOpts(session))
      }

      const beforeOut = await catalogOnHandFromMovements(StockMovement, finished._id)
      finished.quantity = beforeOut
      const outQty = toQty(target)
      const nextOut = toQty(beforeOut + outQty)
      const currentValue = beforeOut * Number(finished.unitCost || 0)
      const lossBookValue = toMoney(
        consumed.reduce((sum, row) => sum + (row.bookValue * (row.lineLossRatio || 0)), 0),
      )
      const incomingValue = toMoney(totalBookValue - lossBookValue)
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
        reason: metalLossGross > GROSS_EPS
          ? `${reasonBase} — receive ${finished.name} (metal loss ${metalLossGross} g)`
          : `${reasonBase} — receive ${finished.name}`,
        actorId: user._id,
        actorName: user.name,
      }], writeOpts(session))

      // Inventory-to-inventory GL for the finished share only.
      // Never auto-post USD to Metal Loss — grams go via AML metal_payment; cash is manual.
      if (Ledger && totalBookValue > 0) {
        for (const row of consumed) {
          if (!(row.bookValue > 0)) continue
          const rowLoss = toMoney(row.bookValue * (row.lineLossRatio || 0))
          const rowFinished = toMoney(row.bookValue - rowLoss)

          if (
            rowFinished > 0
            && finished.ledgerAccountId
            && row.ledgerAccountId
            && String(row.ledgerAccountId) !== String(finished.ledgerAccountId)
          ) {
            await Ledger.create([{
              date: stockDate,
              debitAccountId: finished.ledgerAccountId,
              creditAccountId: row.ledgerAccountId,
              amount: rowFinished,
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
      }

      let metalLossPositionId = null
      if (metalLossGross > GROSS_EPS && metalLossMapping?.debitAccountId) {
        const positionTx = await postMetalLossPositionVoucher({
          user,
          session,
          stockDate,
          reasonBase,
          metalLossMapping,
          lossLines: consumed.filter((row) => Number(row.lossGross) > GROSS_EPS),
        })
        metalLossPositionId = positionTx?._id ? String(positionTx._id) : null
      }

      return {
        success: true,
        karat: karatNum,
        targetGross: outQty,
        metalLossGross: metalLossGross > GROSS_EPS ? metalLossGross : 0,
        metalLossBookValue: lossBookValue,
        metalLossPositionId,
        metalLossByMetal: consumed
          .filter((row) => Number(row.lossGross) > GROSS_EPS)
          .map((row) => ({
            itemId: row.itemId,
            name: row.name,
            stockCode: resolveLossMetalStockCode(row),
            lossGross: toQty(row.lossGross),
            remainGross: toQty(row.remainGross),
          })),
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

      await reverseMetalLossPositionVouchers({
        user,
        session,
        reasonBase,
        deletedAt,
      })

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
  ALLOY_METAL_LOSS_MAPPING_TYPE,
}
