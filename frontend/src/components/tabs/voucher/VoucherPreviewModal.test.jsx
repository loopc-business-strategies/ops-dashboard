import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import VoucherPreviewModal from './VoucherPreviewModal'

const basePrintModel = {
  printTitle: 'Payment Voucher',
  documentBranding: { companyName: 'LoopC' },
  voucherPrintSettings: { enabled: true },
  voucherPrint: { signatories: [] },
  voucher: {},
  header: {},
  currencyLabel: 'USD',
  payNoValue: 'PAY-0001',
  payDateValue: '2026-07-08',
  preparedByValue: 'Tester',
  trnValue: '',
  phoneValue: '',
  printMeta: [],
  printAmountLabel: 'Amount (USD)',
  printPostingDirection: 'DEBITED',
  accountNameByCode: () => '',
  isMgCurrencyVoucher: false,
  isMgMetalVoucher: false,
  mgPrintTitle: '',
  mgBranch: 'HO',
  mgLogoImage: '',
  mgCompanyName: '',
  mgCompanyAddress: '',
  mgLineItems: [],
  mgPrimaryLine: {},
  mgPartyPrintPhone: '',
  mgPartyPrintAddress: '',
  mgPartyAccountCode: '',
  mgPartyAccountName: '',
  mgAccountDescription: () => '',
  mgAmountWords: '',
  mgFixingDisplay: 'FIXED',
  mgMetalInvoiceTitle: '',
  mgMetalCopyLabel: '',
  mgMetalPostingDirection: 'DEBITED',
  mgMetalRateLabel: '',
  numberToWords: () => '',
  fmt: (v) => String(v),
  normalizeLineType: (v) => v,
  lineItems: [],
  effectiveLineItems: [],
  totals: { grandTotal: 0 },
  isMetalVoucher: false,
  voucherType: 'payment',
}

describe('VoucherPreviewModal', () => {
  it('renders settings controls and preview content', () => {
    const onVoucherTypeChange = vi.fn()
    const onPreviewModeChange = vi.fn()
    render(
      <VoucherPreviewModal
        open
        onClose={() => {}}
        mode="settings"
        voucherType="payment"
        previewMode="empty"
        printModel={basePrintModel}
        onVoucherTypeChange={onVoucherTypeChange}
        onPreviewModeChange={onPreviewModeChange}
      />,
    )

    expect(screen.getByText(/Payment Voucher — Empty Preview/i)).toBeTruthy()
    expect(screen.getByText('No line items')).toBeTruthy()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'receipt' } })
    expect(onVoucherTypeChange).toHaveBeenCalledWith('receipt')
    fireEvent.click(screen.getByRole('button', { name: 'Sample' }))
    expect(onPreviewModeChange).toHaveBeenCalledWith('sample')
  })

  it('calls onPrint when print is clicked in live mode', () => {
    const onPrint = vi.fn()
    render(
      <VoucherPreviewModal
        open
        onClose={() => {}}
        mode="live"
        title="Payment Voucher"
        printModel={basePrintModel}
        onPrint={onPrint}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Print' }))
    expect(onPrint).toHaveBeenCalled()
  })

  it('allows scrolling in the preview body for tall vouchers', () => {
    const { container } = render(
      <VoucherPreviewModal
        open
        onClose={() => {}}
        mode="live"
        title="Payment Voucher"
        printModel={basePrintModel}
      />,
    )
    const scrollArea = container.querySelector('div[style*="overflow: auto"]')
    expect(scrollArea).toBeTruthy()
  })
})
