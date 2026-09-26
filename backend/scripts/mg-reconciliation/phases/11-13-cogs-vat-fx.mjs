import { toMoney, baseAmount, isMetalTransferType } from '../lib/money.mjs'

export function phase11Cogs(ctx, findings) {
  const phase = '11-cogs'
  const { postedTx, ledgersByRef, stockMovements, itemById } = ctx
  let differences = 0

  for (const tx of postedTx) {
    const type = String(tx.type || '').toLowerCase()

    if (type === 'metal_payment') {
      const cogsRows = (ledgersByRef.get(String(tx._id)) || [])
        .filter((l) => String(l.referenceType || '').toLowerCase() === 'cogs')
      if (cogsRows.length) {
        differences += 1
        findings.add({
          domain: 'cogs', phase, severity: 'ERROR', code: 'TRANSFER_HAS_COGS',
          message: 'Metal payment transfer unexpectedly has COGS ledger', entity: {
            vocNo: tx?.voucherMeta?.vocNo, txId: String(tx._id),
          },
        })
      } else {
        findings.add({
          domain: 'cogs', phase, severity: 'PASS', code: 'TRANSFER_NO_COGS',
          message: 'Metal payment correctly has no COGS', entity: { vocNo: tx?.voucherMeta?.vocNo },
        })
      }
      continue
    }

    if (type !== 'sale') continue

    const cogsRows = (ledgersByRef.get(String(tx._id)) || [])
      .filter((l) => String(l.referenceType || '').toLowerCase() === 'cogs')
    const vocNo = String(tx?.voucherMeta?.vocNo || '')
    const moves = stockMovements.filter((m) => String(m.reason || '').includes(vocNo) && Number(m.change || 0) < 0)

    let expectedCogs = 0
    for (const m of moves) {
      const item = itemById.get(String(m.itemId))
      const unitCost = Number(item?.unitCost || 0)
      expectedCogs = toMoney(expectedCogs + Math.abs(Number(m.change || 0)) * unitCost)
    }

    const actualCogs = toMoney(cogsRows.reduce((s, r) => s + baseAmount(r.amount, r.exchangeRate), 0))
    const entity = { txId: String(tx._id), vocNo }

    if (!moves.length && !cogsRows.length) {
      findings.add({
        domain: 'cogs', phase, severity: 'WARNING', code: 'SALE_NO_COGS_NO_MOVES',
        message: 'Sale has neither stock-out moves nor COGS ledgers', entity,
      })
      continue
    }

    if (Math.abs(expectedCogs - actualCogs) > 0.05) {
      differences += 1
      findings.add({
        domain: 'cogs', phase, severity: 'WARNING', code: 'COGS_VS_CURRENT_UNIT_COST',
        message: 'COGS ledger vs current unitCost×qty (may differ if WAVG changed after posting)', entity,
        expected: expectedCogs, actual: actualCogs, difference: toMoney(actualCogs - expectedCogs),
      })
    } else {
      findings.add({
        domain: 'cogs', phase, severity: 'PASS', code: 'COGS_OK',
        message: 'COGS aligns with stock-out × unitCost', entity,
        expected: expectedCogs, actual: actualCogs,
      })
    }
  }

  return { differences }
}

export function phase12Vat(ctx, findings) {
  const phase = '12-vat'
  const { postedTx, ledgersByRef } = ctx
  let differences = 0

  for (const tx of postedTx) {
    const type = String(tx.type || '').toLowerCase()
    if (isMetalTransferType(type)) continue

    const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
    let lineVat = 0
    let lineNet = 0
    let lineGross = 0
    for (const line of lines) {
      const vat = Number(line.vatAmountLC || line.vatAmountFC || 0)
      const net = Number(line.totalAmount || line.metalAmount || line.amountLC || 0)
      const gross = Number(line.amountWithVAT || 0)
      lineVat += vat
      lineNet += net
      if (gross > 0) lineGross += gross
      else lineGross += net + vat
    }
    lineVat = toMoney(lineVat)
    lineNet = toMoney(lineNet)
    lineGross = toMoney(lineGross)

    if (lineVat === 0 && lineNet === 0) continue

    if (lineVat > 0 && Math.abs(lineGross - (lineNet + lineVat)) > 0.05) {
      differences += 1
      findings.add({
        domain: 'vat', phase, severity: 'ERROR', code: 'VAT_NET_GROSS',
        message: 'Line Net + VAT != Gross', entity: { vocNo: tx?.voucherMeta?.vocNo, type },
        expected: toMoney(lineNet + lineVat), actual: lineGross,
        difference: toMoney(lineGross - (lineNet + lineVat)),
      })
    } else if (lineVat > 0) {
      findings.add({
        domain: 'vat', phase, severity: 'PASS', code: 'VAT_NET_GROSS_OK',
        message: 'Net + VAT = Gross on lines', entity: { vocNo: tx?.voucherMeta?.vocNo },
      })
    }

    const vatLedgers = (ledgersByRef.get(String(tx._id)) || [])
      .filter((l) => ['vat_input', 'vat_output'].includes(String(l.referenceType || '').toLowerCase()))
    const vatLedgerAmt = toMoney(vatLedgers.reduce((s, r) => s + baseAmount(r.amount, r.exchangeRate), 0))

    if (lineVat > 0 && vatLedgerAmt === 0 && ['sale', 'purchase'].includes(type)) {
      differences += 1
      findings.add({
        domain: 'vat', phase, severity: 'WARNING', code: 'VAT_LINE_NO_LEDGER',
        message: 'Voucher lines have VAT but no vat_input/vat_output ledger', entity: {
          vocNo: tx?.voucherMeta?.vocNo, type,
        },
        expected: lineVat, actual: 0,
      })
    } else if (lineVat > 0 && Math.abs(vatLedgerAmt - lineVat) > 0.05) {
      differences += 1
      findings.add({
        domain: 'vat', phase, severity: 'ERROR', code: 'VAT_LEDGER_MISMATCH',
        message: 'VAT ledger total differs from line VAT', entity: { vocNo: tx?.voucherMeta?.vocNo },
        expected: lineVat, actual: vatLedgerAmt, difference: toMoney(vatLedgerAmt - lineVat),
      })
    } else if (vatLedgers.length) {
      findings.add({
        domain: 'vat', phase, severity: 'PASS', code: 'VAT_LEDGER_OK',
        message: 'VAT ledger present', entity: { vocNo: tx?.voucherMeta?.vocNo },
        actual: vatLedgerAmt,
      })
    }
  }

  return { differences }
}

export function phase13Fx(ctx, findings) {
  const phase = '13-fx'
  const { transactions, currencies } = ctx
  let differences = 0

  const baseCodes = currencies.filter((c) => c.baseCurrency || c.isBase).map((c) => String(c.code || '').toUpperCase())

  for (const tx of transactions) {
    const rate = Number(tx.exchangeRate || 0)
    const currency = String(tx.currency || '').toUpperCase()
    const entity = { txId: String(tx._id), vocNo: tx?.voucherMeta?.vocNo, currency, rate }

    if (!(rate > 0)) {
      differences += 1
      findings.add({
        domain: 'fx', phase, severity: String(tx.status).toLowerCase() === 'posted' ? 'ERROR' : 'WARNING',
        code: 'FX_ZERO_RATE', message: 'Transaction exchangeRate missing or zero', entity,
      })
      continue
    }

    const amount = Number(tx.amount || 0)
    const base = toMoney(amount * rate)
    findings.add({
      domain: 'fx', phase, severity: 'PASS', code: 'FX_BASE_COMPUTED',
      message: 'Base amount = amount × exchangeRate', entity, actual: base,
    })

    for (const line of (tx?.voucherMeta?.lineItems || [])) {
      const lineRate = Number(line.currRate || 0)
      if (line.currCode && lineRate <= 0 && Number(line.amountFC || 0) > 0) {
        differences += 1
        findings.add({
          domain: 'fx', phase, severity: 'WARNING', code: 'FX_LINE_RATE_MISSING',
          message: 'Line has FC amount but missing currRate', entity: { ...entity, currCode: line.currCode },
        })
      }
    }
  }

  return { differences, baseCodes }
}
