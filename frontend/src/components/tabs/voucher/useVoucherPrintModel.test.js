import { describe, expect, it, vi, afterEach } from 'vitest'
import { buildVoucherPrintModel } from './useVoucherPrintModel'
import * as tenantBranding from '../../../config/tenantBranding'

const baseArgs = {
  header: { vocNo: 'PAY-001', docDate: '2026-07-08', currCode: 'USD' },
  effectiveLineItems: [],
  totals: { grandTotal: 0 },
  accounts: [],
  reportBranding: {},
  voucherLabel: 'Payment Voucher',
  isMetalVoucher: false,
  isSimpleMetalVoucher: false,
  lineItems: [],
}

describe('buildVoucherPrintModel tenant layout routing', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses configurable layout for MG payment when master document settings are enabled', () => {
    const model = buildVoucherPrintModel({
      ...baseArgs,
      voucherType: 'payment',
      user: { company: 'mg', name: 'MG User' },
    })

    expect(model.voucherPrintSettings.enabled).toBe(true)
    expect(model.isMgCurrencyVoucher).toBe(false)
  })

  it('uses legacy MG currency layout when master document settings are disabled', () => {
    vi.spyOn(tenantBranding, 'isMasterDocumentSettingsEnabled').mockReturnValue(false)

    const model = buildVoucherPrintModel({
      ...baseArgs,
      voucherType: 'payment',
      user: { company: 'mg', name: 'MG User' },
    })

    expect(model.voucherPrintSettings.enabled).toBe(false)
    expect(model.isMgCurrencyVoucher).toBe(true)
  })

  it('does not route LoopC payment vouchers to legacy MG layout', () => {
    const model = buildVoucherPrintModel({
      ...baseArgs,
      voucherType: 'payment',
      user: { company: 'loopc', name: 'LoopC User' },
    })

    expect(model.voucherPrintSettings.enabled).toBe(true)
    expect(model.isMgCurrencyVoucher).toBe(false)
  })

  it('uses configurable layout for CG payment when master document settings are enabled', () => {
    const model = buildVoucherPrintModel({
      ...baseArgs,
      voucherType: 'payment',
      user: { company: 'cg', name: 'CG User' },
    })

    expect(model.voucherPrintSettings.enabled).toBe(true)
    expect(model.isMgCurrencyVoucher).toBe(false)
    expect(model.isMgMetalVoucher).toBe(false)
  })

  it('uses configurable layout for MG metal purchase when master document settings are enabled', () => {
    const model = buildVoucherPrintModel({
      ...baseArgs,
      voucherType: 'purchase',
      voucherLabel: 'Metal Purchase Voucher',
      isMetalVoucher: true,
      isSimpleMetalVoucher: false,
      user: { company: 'mg', name: 'MG User' },
    })

    expect(model.voucherPrintSettings.enabled).toBe(true)
    expect(model.isMgMetalVoucher).toBe(false)
  })

  it('uses legacy MG metal layout when master document settings are disabled', () => {
    vi.spyOn(tenantBranding, 'isMasterDocumentSettingsEnabled').mockReturnValue(false)

    const model = buildVoucherPrintModel({
      ...baseArgs,
      voucherType: 'purchase',
      voucherLabel: 'Metal Purchase Voucher',
      isMetalVoucher: true,
      isSimpleMetalVoucher: false,
      user: { company: 'mg', name: 'MG User' },
    })

    expect(model.voucherPrintSettings.enabled).toBe(false)
    expect(model.isMgMetalVoucher).toBe(true)
  })
})
