/**
 * Bridge metal purchase/receipt inventory plans → ProductionStockLot (NEW_STOCK).
 * Additive + idempotent; never hard-deletes lots on void.
 */

const ProductionStockLot = require('../../models/ProductionStockLot')
const ProductionStockStatusEvent = require('../../models/ProductionStockStatusEvent')
const { nextStockCode } = require('../productionControl/numbering')
const { METAL_TYPES } = require('../productionControl/constants')
const { isMetalStockInType } = require('../../utils/metalStockVoucherTypes')
const { withSession, writeOpts } = require('../../utils/mongoTransaction')

function sanitizeStockToken(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function deriveMetalType(line = {}, item = {}) {
  const candidates = [
    line.metalType,
    line.metal,
    line.category,
    item.category,
    item.name,
  ]
  for (const raw of candidates) {
    const s = String(raw || '').toLowerCase()
    if (!s) continue
    if (s.includes('platinum') || s.includes('plt')) return 'Platinum'
    if (s.includes('silver') || s.includes('silv') || /\bag\b/.test(s)) return 'Silver'
    if (s.includes('gold') || /\bau\b/.test(s) || s.includes('24k') || s.includes('22k') || s.includes('18k')) {
      return 'Gold'
    }
  }
  return 'Gold'
}

function derivePurity(line = {}, item = {}) {
  const raw = line.purity ?? line.karat ?? item.purity ?? ''
  if (raw == null || raw === '') return ''
  return String(raw).trim()
}

function lineWeights(line = {}, quantity = 0) {
  const gross = Number(line.grossWeight || 0)
  const pure = Number(line.pureWeight || 0)
  const qty = Number(quantity || 0)
  const grossWeight = gross > 0 ? gross : (qty > 0 ? qty : pure)
  const netWeight = pure > 0 ? pure : (gross > 0 ? gross : qty)
  return {
    grossWeight: Math.max(0, grossWeight || 0),
    netWeight: Math.max(0, netWeight || grossWeight || 0),
    quantity: Math.max(0, qty || grossWeight || netWeight || 0),
  }
}

function purchaseRefForTx(tx) {
  const vocNo = String(tx?.voucherMeta?.vocNo || '').trim()
  if (vocNo) return vocNo
  return String(tx?._id || '').trim()
}

function idempotencyKeyForLine(txId, lineIndex) {
  return `voucher-stock:${String(txId)}:${lineIndex}`
}

function isDuplicateKeyError(err) {
  return err && (err.code === 11000 || err.code === '11000')
}

function isLotUnused(lot) {
  if (!lot) return false
  if (lot.batchId) return false
  if (Number(lot.allocatedWeight || 0) > 0) return false
  if (Number(lot.allocatedQuantity || 0) > 0) return false
  return true
}

/**
 * Create NEW_STOCK lots for each inventory plan on metal stock-in vouchers.
 * Idempotent via unique sparse idempotencyKey.
 */
async function createLotsFromPurchasePlans({ user, tx, plans, session = null } = {}) {
  const transactionType = String(tx?.type || '').toLowerCase()
  if (!isMetalStockInType(transactionType)) {
    return { created: [], reused: [], warnings: [] }
  }

  const list = Array.isArray(plans) ? plans : []
  if (!list.length || !tx?._id) {
    return { created: [], reused: [], warnings: [] }
  }

  const created = []
  const reused = []
  const warnings = []
  const actorId = user?._id || null
  const actorName = user?.name || 'system'
  const purchaseRef = purchaseRefForTx(tx)
  const supplier = String(
    tx?.voucherMeta?.partyName
    || tx?.voucherMeta?.vendorName
    || tx?.partyName
    || '',
  ).trim()
  const purchaseDate = tx?.date || tx?.voucherMeta?.valueDate || new Date()

  for (let lineIndex = 0; lineIndex < list.length; lineIndex += 1) {
    const plan = list[lineIndex]
    const item = plan?.item
    if (!item?._id) continue

    const key = idempotencyKeyForLine(tx._id, lineIndex)
    try {
      const existing = await withSession(
        ProductionStockLot.findOne({ idempotencyKey: key }),
        session,
      )
      if (existing) {
        reused.push(existing)
        continue
      }

      const line = plan.line || {}
      const weights = lineWeights(line, plan.quantity)
      if (weights.grossWeight <= 0 && weights.netWeight <= 0 && weights.quantity <= 0) {
        warnings.push(`Line ${lineIndex}: skipped (no weight/qty)`)
        continue
      }

      const metalType = deriveMetalType(line, item)
      const purity = derivePurity(line, item)
      const product = String(item.name || line.itemName || line.description || metalType).trim()
      const productCode = String(item.sku || line.sku || line.productCode || '').trim()
      const category = String(item.category || line.category || '').trim()
      const vocToken = sanitizeStockToken(purchaseRef) || 'TX'
      let stockCode = `PUR-${vocToken}-${String(lineIndex).padStart(2, '0')}`
      const clash = await withSession(
        ProductionStockLot.findOne({ stockCode }).select('_id').lean(),
        session,
      )
      if (clash) {
        stockCode = await nextStockCode(ProductionStockLot, session)
      }

      const [lot] = await ProductionStockLot.create(
        [
          {
            stockCode,
            purchaseRef,
            supplier: supplier || String(item.supplierName || '').trim(),
            purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
            product,
            productCode,
            category,
            quantity: weights.quantity,
            grossWeight: weights.grossWeight,
            netWeight: weights.netWeight,
            metalType: METAL_TYPES.includes(metalType) ? metalType : 'Gold',
            purity,
            remarks: `From voucher ${purchaseRef || tx._id} (${transactionType})`,
            receivedById: actorId,
            receivedByName: actorName,
            status: 'NEW_STOCK',
            inventoryItemId: item._id,
            createdById: actorId,
            createdByName: actorName,
            version: 0,
            idempotencyKey: key,
          },
        ],
        writeOpts(session),
      )

      await ProductionStockStatusEvent.create(
        [
          {
            stockLotId: lot._id,
            stockCode: lot.stockCode,
            fromStatus: '',
            toStatus: 'NEW_STOCK',
            reason: `Purchase voucher stock-in ${purchaseRef || tx._id}`,
            actorId,
            actorName,
          },
        ],
        writeOpts(session),
      )

      created.push(lot)
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        const existing = await withSession(
          ProductionStockLot.findOne({ idempotencyKey: key }),
          session,
        )
        if (existing) {
          reused.push(existing)
          continue
        }
      }
      const msg = err?.message || String(err)
      console.warn('[voucherProductionStockBridge] create lot failed:', msg)
      warnings.push(`Line ${lineIndex}: ${msg}`)
    }
  }

  return { created, reused, warnings }
}

/**
 * On void/reverse of metal stock-in: cancel unused purchase-linked lots (no hard delete).
 * Used lots are annotated with a reversal remark only.
 */
async function cancelLotsForVoidedPurchase({ user, tx, session = null, deleteReason = '' } = {}) {
  const transactionType = String(tx?.type || '').toLowerCase()
  if (!isMetalStockInType(transactionType) || !tx?._id) {
    return { cancelled: [], annotated: [], warnings: [] }
  }

  const vocNo = String(tx?.voucherMeta?.vocNo || '').trim()
  const keyPrefix = `voucher-stock:${String(tx._id)}:`
  const filter = {
    $or: [
      { idempotencyKey: new RegExp(`^${keyPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) },
      ...(vocNo ? [{ purchaseRef: vocNo, remarks: /From voucher/i }] : []),
    ],
  }

  const lots = await withSession(ProductionStockLot.find(filter), session)
  const cancelled = []
  const annotated = []
  const warnings = []
  const actorId = user?._id || null
  const actorName = user?.name || 'system'
  const voidLabel = vocNo || String(tx._id)
  const remark = `Reversed by voucher void ${voidLabel}${deleteReason ? `: ${String(deleteReason).slice(0, 120)}` : ''}`

  for (const lot of lots) {
    try {
      const status = String(lot.status || '')
      const canCancel = ['NEW_STOCK', 'AVAILABLE'].includes(status) && isLotUnused(lot)

      if (canCancel) {
        await ProductionStockStatusEvent.create(
          [
            {
              stockLotId: lot._id,
              stockCode: lot.stockCode,
              fromStatus: status,
              toStatus: 'CANCELLED',
              reason: remark,
              actorId,
              actorName,
            },
          ],
          writeOpts(session),
        )
        lot.status = 'CANCELLED'
        lot.version = (lot.version || 0) + 1
        const prev = String(lot.remarks || '').trim()
        lot.remarks = prev ? `${prev}\n${remark}` : remark
        await lot.save(writeOpts(session))
        cancelled.push(lot)
        continue
      }

      const prev = String(lot.remarks || '').trim()
      if (!prev.includes(remark)) {
        lot.remarks = prev ? `${prev}\n${remark}` : remark
        await lot.save(writeOpts(session))
      }
      annotated.push(lot)
    } catch (err) {
      const msg = err?.message || String(err)
      console.warn('[voucherProductionStockBridge] void annotate failed:', msg)
      warnings.push(`${lot.stockCode || lot._id}: ${msg}`)
    }
  }

  return { cancelled, annotated, warnings }
}

module.exports = {
  createLotsFromPurchasePlans,
  cancelLotsForVoidedPurchase,
  idempotencyKeyForLine,
  deriveMetalType,
  purchaseRefForTx,
}
