import {
  toMoney, withinMoneyTol, resolveLinePureWeight, resolveLineInventoryQty, isMetalTransferType, isUnfixed,
} from '../lib/money.mjs'

export function phase02Vouchers(ctx, findings) {
  const phase = '02-vouchers'
  const { transactions, ledgersByRef, movesByItem, stockMovements } = ctx
  const vocKeys = new Map()

  for (const tx of transactions) {
    const type = String(tx.type || '').toLowerCase()
    const vocNo = String(tx?.voucherMeta?.vocNo || '').trim()
    const status = String(tx.status || '').toLowerCase()
    const entity = { txId: String(tx._id), type, vocNo, status }

    if (vocNo) {
      const key = `${type}::${vocNo}`
      if (!vocKeys.has(key)) vocKeys.set(key, [])
      vocKeys.get(key).push(String(tx._id))
    } else {
      findings.add({
        domain: 'vouchers', phase, severity: 'WARNING', code: 'VOC_NO_MISSING',
        message: 'Transaction missing voucherMeta.vocNo', entity,
      })
    }

    const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
    let lineMetal = 0
    let lineVat = 0
    for (const line of lines) {
      lineMetal += Number(line.metalAmount || line.totalAmount || line.amountLC || 0)
      lineVat += Number(line.vatAmountLC || line.vatAmountFC || 0)
    }

    const hasFx = Number(tx.exchangeRate || 0) > 0
    if (!hasFx) {
      findings.add({
        domain: 'vouchers', phase, severity: status === 'posted' ? 'ERROR' : 'WARNING',
        code: 'FX_RATE_MISSING', message: 'Missing/zero exchangeRate on transaction', entity,
      })
    }

    if (status === 'posted') {
      const ledgers = ledgersByRef.get(String(tx._id)) || []
      if (!isMetalTransferType(type) && ledgers.length === 0) {
        findings.add({
          domain: 'vouchers', phase, severity: 'CRITICAL', code: 'POSTED_NO_LEDGER',
          message: 'Posted non-transfer voucher has no ledger rows', entity,
        })
      } else if (isMetalTransferType(type)) {
        const mainLike = ledgers.filter((l) => {
          const rt = String(l.referenceType || '').toLowerCase()
          return rt === type || rt === 'purchase' || rt === 'sale'
        })
        // transfers should skip main cash ledger; inventory/cogs/vat may still appear incorrectly
        if (mainLike.length > 0) {
          findings.add({
            domain: 'vouchers', phase, severity: 'WARNING', code: 'TRANSFER_HAS_MAIN_LEDGER',
            message: 'Metal transfer has unexpected main-type ledger rows', entity,
            actual: mainLike.length,
          })
        }
        findings.add({
          domain: 'vouchers', phase, severity: 'PASS', code: 'TRANSFER_POSTED',
          message: 'Posted metal transfer checked', entity,
        })
      } else {
        findings.add({
          domain: 'vouchers', phase, severity: 'PASS', code: 'VOUCHER_POSTED_OK',
          message: 'Posted voucher has ledger linkage', entity,
        })
      }

      // stock movement presence for metal stock types
      if (['purchase', 'sale', 'metal_receipt', 'metal_payment'].includes(type)) {
        const relatedMoves = stockMovements.filter((m) => {
          const reason = String(m.reason || '')
          return reason.includes(vocNo) || reason.includes(String(tx._id))
        })
        if (lines.some((l) => resolveLineInventoryQty(l) > 0) && relatedMoves.length === 0) {
          findings.add({
            domain: 'vouchers', phase, severity: 'ERROR', code: 'POSTED_NO_STOCK_MOVE',
            message: 'Posted stock voucher with weights but no matching stock movement reason', entity,
          })
        }
      }
    } else {
      findings.add({
        domain: 'vouchers', phase, severity: 'INFORMATIONAL', code: 'VOUCHER_NOT_POSTED',
        message: `Voucher status=${status}`, entity,
      })
    }

    // line purity sanity
    for (const [idx, line] of lines.entries()) {
      const gross = Number(line.grossWeight || 0)
      const pure = resolveLinePureWeight(line)
      const ratio = Number(line.purity || 0)
      if (gross > 0 && ratio > 0) {
        const expectedPure = gross * (ratio > 1.2 ? ratio / 1000 : ratio)
        if (!withinMoneyTol(pure, expectedPure) && Math.abs(pure - expectedPure) > 0.01) {
          // use qty tolerance-ish
          if (Math.abs(pure - expectedPure) > 0.05) {
            findings.add({
              domain: 'vouchers', phase, severity: 'WARNING', code: 'PURE_WEIGHT_MISMATCH',
              message: `Line ${idx} pure weight inconsistent with gross×purity`, entity: { ...entity, line: idx },
              expected: expectedPure, actual: pure, difference: pure - expectedPure,
            })
          }
        }
      }
    }
  }

  for (const [key, ids] of vocKeys.entries()) {
    if (ids.length > 1) {
      findings.add({
        domain: 'vouchers', phase, severity: 'CRITICAL', code: 'DUP_VOC_NO',
        message: `Duplicate voucher number ${key}`, entity: { key, txIds: ids },
        actual: ids.length,
      })
    }
  }

  return { voucherCount: transactions.length, postedCount: transactions.filter((t) => String(t.status).toLowerCase() === 'posted').length }
}
