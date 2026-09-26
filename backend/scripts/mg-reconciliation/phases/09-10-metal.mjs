import {
  toQty, resolveLinePureWeight, resolveLineInventoryQty, resolvePurityRatio, isUnfixed, isMetalTransferType,
} from '../lib/money.mjs'

/**
 * Metal position signs (party enquiry):
 * unfixed purchase +, unfixed sale −, metal_receipt −, metal_payment +
 */
function signedPureForTx(tx) {
  const type = String(tx.type || '').toLowerCase()
  const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
  let pure = 0
  let gross = 0
  for (const line of lines) {
    pure += resolveLinePureWeight(line)
    gross += Number(line.grossWeight || 0)
  }
  pure = toQty(pure)
  gross = toQty(gross)
  if (type === 'purchase' && isUnfixed(tx)) return { gold: pure, gross, sign: 1 }
  if (type === 'sale' && isUnfixed(tx)) return { gold: pure, gross, sign: -1 }
  if (type === 'metal_receipt') return { gold: pure, gross, sign: -1 }
  if (type === 'metal_payment') return { gold: pure, gross, sign: 1 }
  return { gold: 0, gross: 0, sign: 0 }
}

export function phase09Metal(ctx, findings) {
  const phase = '09-metal'
  const { postedTx, directDeals } = ctx
  let position = 0
  let differences = 0

  for (const tx of postedTx) {
    const { gold, gross, sign } = signedPureForTx(tx)
    if (sign === 0 || !(gold > 0 || gross > 0)) continue
    const delta = toQty(sign * gold)
    position = toQty(position + delta)

    const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
    for (const [idx, line] of lines.entries()) {
      const g = Number(line.grossWeight || 0)
      const p = resolveLinePureWeight(line)
      const ratio = resolvePurityRatio(line.purity)
      if (g > 0 && ratio > 0) {
        const expected = toQty(g * ratio)
        if (Math.abs(expected - p) > 0.05) {
          differences += 1
          findings.add({
            domain: 'metal', phase, severity: 'ERROR', code: 'METAL_PURE_FORMULA',
            message: 'Pure weight != gross × purity', entity: {
              vocNo: tx?.voucherMeta?.vocNo, line: idx, type: tx.type,
            },
            expected, actual: p, difference: toQty(p - expected),
          })
        } else {
          findings.add({
            domain: 'metal', phase, severity: 'PASS', code: 'METAL_PURE_OK',
            message: 'Pure weight matches gross × purity', entity: { vocNo: tx?.voucherMeta?.vocNo, line: idx },
          })
        }
      }
    }

    findings.add({
      domain: 'metal', phase, severity: 'INFORMATIONAL', code: 'METAL_POSITION_DELTA',
      message: `Position delta from ${tx.type}`, entity: { vocNo: tx?.voucherMeta?.vocNo, delta },
      actual: position,
    })
  }

  // Direct deals contribute to position when confirmed — best-effort read of qty fields
  for (const deal of directDeals || []) {
    const status = String(deal.status || '').toLowerCase()
    if (status && !['confirmed', 'posted', 'settled', 'done'].includes(status)) continue
    const grams = Number(deal.quantityGrams || deal.pureWeight || deal.weight || 0)
    if (!(grams > 0)) continue
    const side = String(deal.side || deal.direction || deal.dealType || '').toLowerCase()
    // buy from company perspective sold → − ; sell → +
    const sign = side.includes('buy') ? -1 : (side.includes('sell') ? 1 : 0)
    if (sign !== 0) position = toQty(position + sign * grams)
  }

  findings.add({
    domain: 'metal', phase, severity: 'INFORMATIONAL', code: 'METAL_POSITION_CLOSING',
    message: 'Computed gold pure position (party convention roll-forward)', actual: position,
  })

  return { closingPurePosition: position, differences }
}

export function phase10MetalTransfer(ctx, findings) {
  const phase = '10-metal-transfer'
  const { postedTx, stockMovements } = ctx
  let mismatches = 0

  for (const tx of postedTx.filter((t) => isMetalTransferType(t.type))) {
    const vocNo = String(tx?.voucherMeta?.vocNo || '')
    const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
    const expectedQty = toQty(lines.reduce((s, l) => s + resolveLineInventoryQty(l), 0))
    const expectedPure = toQty(lines.reduce((s, l) => s + resolveLinePureWeight(l), 0))
    const type = String(tx.type || '').toLowerCase()
    const sign = type === 'metal_receipt' ? 1 : -1

    const moves = stockMovements.filter((m) => String(m.reason || '').includes(vocNo))
    const moveQty = toQty(moves.reduce((s, m) => s + Number(m.change || 0), 0))

    const entity = { txId: String(tx._id), vocNo, type }

    if (moves.length === 0 && expectedQty > 0) {
      mismatches += 1
      findings.add({
        domain: 'metal', phase, severity: 'CRITICAL', code: 'TRANSFER_NO_STOCK',
        message: 'Metal transfer missing stock movements', entity,
        expected: expectedQty * sign, actual: 0,
      })
      continue
    }

    // receipt should net +expectedQty; payment −expectedQty
    const expectedMove = toQty(sign * expectedQty)
    if (Math.abs(moveQty - expectedMove) > 0.001) {
      mismatches += 1
      findings.add({
        domain: 'metal', phase, severity: 'ERROR', code: 'TRANSFER_QTY_MISMATCH',
        message: 'Metal transfer stock change does not match line gross weights', entity,
        expected: expectedMove, actual: moveQty, difference: toQty(moveQty - expectedMove),
      })
    } else {
      findings.add({
        domain: 'metal', phase, severity: 'PASS', code: 'TRANSFER_QTY_OK',
        message: 'Metal transfer stock qty matches lines', entity,
        expected: expectedMove, actual: moveQty,
      })
    }

    // Transfers must not create revenue/expense main ledger (checked elsewhere); flag money ledgers
    findings.add({
      domain: 'metal', phase, severity: 'INFORMATIONAL', code: 'TRANSFER_PURE',
      message: 'Transfer pure weight (party position)', entity, actual: expectedPure,
    })
  }

  return { mismatches }
}
