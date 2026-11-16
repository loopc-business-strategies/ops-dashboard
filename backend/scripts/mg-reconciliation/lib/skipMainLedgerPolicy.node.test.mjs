import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createFindings } from './findings.mjs'
import { skipsMainCashLedger } from './money.mjs'
import { phase02Vouchers } from '../phases/02-vouchers.mjs'
import { phase03DoubleEntry } from '../phases/03-double-entry.mjs'
import { phase04VoucherLedger } from '../phases/04-voucher-ledger.mjs'
import { phase10MetalTransfer } from '../phases/09-10-metal.mjs'

function metalTransferCtx({ stockMovements } = {}) {
  const tx = {
    _id: 'mtr-1',
    type: 'metal_transfer',
    status: 'posted',
    exchangeRate: 1,
    voucherMeta: {
      vocNo: 'MTr/2026/0001',
      lineItems: [
        { transferSide: 'from', stockCode: 'AU-14K', grossWeight: 10, purity: 0.585, pureWeight: 5.85 },
        { transferSide: 'to', stockCode: 'AU-PURE', grossWeight: 5.85, purity: 1, pureWeight: 5.85 },
      ],
    },
  }
  return {
    transactions: [tx],
    postedTx: [tx],
    ledgers: [],
    ledgersByRef: new Map([['mtr-1', []]]),
    txById: new Map([['mtr-1', tx]]),
    accountById: new Map(),
    stockMovements: stockMovements || [
      { reason: 'Voucher metal transfer #MTr/2026/0001', change: -10 },
      { reason: 'Voucher metal transfer #MTr/2026/0001', change: 5.85 },
    ],
    movesByItem: new Map(),
    directDeals: [],
  }
}

describe('mg-reconciliation skip-main-ledger policy', () => {
  it('skipsMainCashLedger includes product metal_transfer', () => {
    assert.equal(skipsMainCashLedger('metal_transfer'), true)
    assert.equal(skipsMainCashLedger('metal_receipt'), true)
    assert.equal(skipsMainCashLedger('purchase'), false)
  })

  it('phase 02/03/04 do not CRITICAL posted metal_transfer with zero ledger rows', () => {
    const ctx = metalTransferCtx()
    const findings = createFindings()
    phase02Vouchers(ctx, findings)
    phase03DoubleEntry(ctx, findings)
    phase04VoucherLedger(ctx, findings)

    const codes = findings.items.map((f) => f.code)
    assert.ok(codes.includes('TRANSFER_POSTED'))
    assert.ok(codes.includes('TRANSFER_LEDGER_POLICY'))
    assert.equal(codes.includes('POSTED_NO_LEDGER'), false)
    assert.equal(codes.includes('TX_NO_LEDGER_BALANCE'), false)
    assert.equal(codes.includes('MISSING_LEDGER'), false)
    assert.equal(findings.items.some((f) => f.severity === 'CRITICAL'), false)
  })

  it('phase 10 checks product metal_transfer from/to stock quantities', () => {
    const findings = createFindings()
    const result = phase10MetalTransfer(metalTransferCtx(), findings)
    assert.equal(result.mismatches, 0)
    assert.ok(findings.items.some((f) => f.code === 'TRANSFER_QTY_OK'))
  })

  it('phase 10 flags product metal_transfer with no stock movements', () => {
    const findings = createFindings()
    const result = phase10MetalTransfer(metalTransferCtx({ stockMovements: [] }), findings)
    assert.equal(result.mismatches, 1)
    assert.ok(findings.items.some((f) => f.code === 'TRANSFER_NO_STOCK' && f.severity === 'CRITICAL'))
  })
})
