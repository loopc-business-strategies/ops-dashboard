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
    expect(model.mgLogoImage).toBe('/logos/mg-logo.png')
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

  it('exposes Master Voucher Settings table headers and signatories for LOOPC', () => {
    const model = buildVoucherPrintModel({
      ...baseArgs,
      voucherType: 'payment',
      user: { company: 'loopc', name: 'LoopC User' },
      reportBranding: {
        companyName: 'LoopC Trading LLC',
        logoUrl: 'data:image/png;base64,abc',
        voucherPrint: {
          tableHeaders: {
            no: 'S.No',
            description: 'Particulars',
            type: 'Kind',
            amountFc: 'FC Amt',
            amountLc: 'LC Amt',
          },
          signatories: [
            { title: 'Prepared By', name: 'Ops Desk', visible: true },
            { title: 'Hidden', name: 'X', visible: false },
          ],
          confirmedForLabel: 'For and on behalf of',
          footerNote: 'Internal copy only',
        },
      },
    })

    expect(model.voucherPrintSettings.enabled).toBe(true)
    expect(model.documentBranding.companyName).toBe('LoopC Trading LLC')
    expect(model.voucherPrint.tableHeaders.no).toBe('S.No')
    expect(model.voucherPrint.tableHeaders.description).toBe('Particulars')
    expect(model.voucherPrint.signatories[0].name).toBe('Ops Desk')
    expect(model.voucherPrint.confirmedForLabel).toBe('For and on behalf of')
    expect(model.voucherPrint.footerNote).toBe('Internal copy only')
    expect(model.isMgCurrencyVoucher).toBe(false)
  })

  it('routes LoopC payment vouchers to professional currency layout', () => {
    const model = buildVoucherPrintModel({
      ...baseArgs,
      voucherType: 'payment',
      user: { company: 'loopc', name: 'LoopC User' },
    })

    expect(model.useProfessionalCurrencyLayout).toBe(true)
    expect(model.useProfessionalMetalLayout).toBe(false)
    expect(model.proCurrencyTitle).toBe('PAYMENT VOUCHER')
  })

  it('routes LoopC metal sale vouchers to professional metal layout', () => {
    const model = buildVoucherPrintModel({
      ...baseArgs,
      voucherType: 'sale',
      voucherLabel: 'Metal Sale Voucher',
      isMetalVoucher: true,
      header: { vocNo: '47', docDate: '2026-07-08', currCode: 'USD', fixingType: 'fixing' },
      user: { company: 'loopc', name: 'LoopC User' },
      reportBranding: { companyName: 'LoopC Trading LLC' },
    })

    expect(model.useProfessionalMetalLayout).toBe(true)
    expect(model.proMetalInvoiceTitle).toBe('TAX INVOICE (FIXED)')
    expect(model.proCompanyName).toBe('LoopC Trading LLC')
  })

  it('routes LoopC purchase vouchers to professional metal layout with purchase title', () => {
    const model = buildVoucherPrintModel({
      ...baseArgs,
      voucherType: 'purchase',
      voucherLabel: 'Metal Purchase Voucher',
      isMetalVoucher: true,
      user: { company: 'loopc', name: 'LoopC User' },
    })

    expect(model.useProfessionalMetalLayout).toBe(true)
    expect(model.proMetalInvoiceTitle).toBe('PURCHASE INVOICE (FIXED)')
    expect(model.proMetalCopyLabel).toBe('ACCOUNTS COPY')
  })

  it('does not route to professional layout when tenant flag is disabled', () => {
    vi.spyOn(tenantBranding, 'isProfessionalVoucherPrintEnabled').mockReturnValue(false)

    const model = buildVoucherPrintModel({
      ...baseArgs,
      voucherType: 'payment',
      user: { company: 'loopc', name: 'LoopC User' },
    })

    expect(model.useProfessionalCurrencyLayout).toBe(false)
    expect(model.useProfessionalMetalLayout).toBe(false)
  })

  it('routes MG and CG payment to professional layout when flag is enabled', () => {
    const mgModel = buildVoucherPrintModel({
      ...baseArgs,
      voucherType: 'payment',
      user: { company: 'mg', name: 'MG User' },
    })
    const cgModel = buildVoucherPrintModel({
      ...baseArgs,
      voucherType: 'receipt',
      user: { company: 'cg', name: 'CG User' },
    })

    expect(mgModel.useProfessionalCurrencyLayout).toBe(true)
    expect(cgModel.useProfessionalCurrencyLayout).toBe(true)
    expect(cgModel.proCurrencyTitle).toBe('RECEIPT VOUCHER')
  })

  it('uses legacy MG currency layout when master document settings are disabled even with professional flag', () => {
    vi.spyOn(tenantBranding, 'isMasterDocumentSettingsEnabled').mockReturnValue(false)

    const model = buildVoucherPrintModel({
      ...baseArgs,
      voucherType: 'payment',
      user: { company: 'mg', name: 'MG User' },
    })

    expect(model.voucherPrintSettings.enabled).toBe(false)
    expect(model.isMgCurrencyVoucher).toBe(true)
    expect(model.useProfessionalCurrencyLayout).toBe(false)
  })
})
