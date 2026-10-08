import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProfessionalMetalInvoicePrintLayout from '../erp/ProfessionalMetalInvoicePrintLayout'
import ProfessionalCurrencyVoucherPrintLayout from '../erp/ProfessionalCurrencyVoucherPrintLayout'

const fmt = (value) => Number(value || 0).toFixed(2)

describe('Professional voucher print layouts', () => {
  it('renders metal invoice title and 12-column headers', () => {
    render(
      <ProfessionalMetalInvoicePrintLayout
        companyName="LoopC Trading LLC"
        companyAddress="Dubai, UAE"
        invoiceTitle="TAX INVOICE (FIXED)"
        copyLabel="PARTY COPY"
        partyName="Sample Customer LLC"
        partyCode="CUST-001"
        trnValue="123456789"
        docNoValue="47"
        branch="HO"
        dateValue="2026-07-08"
        fixingLabel="FIXED"
        metalRateLabel="2,380.00 / SOZ (USD)"
        currencyLabel="USD"
        lineItems={[{
          stockCode: 'XAU-24K',
          productType: 'Gold 24K',
          grossWeight: 12.5,
          purity: 0.999,
          pureWeight: 12.4875,
          makingRate: 15,
          makingCharges: 187.31,
          metalAmount: 29721.25,
          totalAmount: 29721.25,
          vatPer: 5,
          vatAmountLC: 1486.06,
          amountWithVAT: 31207.31,
        }]}
        totals={{ grandTotal: 31207.31 }}
        amountWords="Thirty One Thousand Two Hundred Seven United States Dollar Only"
        postingDirection="CREDITED"
        fmt={fmt}
      />,
    )

    const metalTitleBox = screen.getByText('TAX INVOICE (FIXED)').closest('.voucher-pro-title-box')
    expect(metalTitleBox).toBeTruthy()
    expect(metalTitleBox.getAttribute('style') || '').toContain('translateX(-50%)')
    expect(screen.getByText('Gross Wt.')).toBeTruthy()
    expect(screen.getByText(/VAT Amt/i)).toBeTruthy()
    expect(screen.getByText(/Gross Amt/i)).toBeTruthy()
    expect(screen.getByText('PARTY COPY')).toBeTruthy()
  })

  it('renders currency voucher gold title and party grid', () => {
    render(
      <ProfessionalCurrencyVoucherPrintLayout
        companyName="LoopC Trading LLC"
        companyAddress="Dubai, UAE"
        printTitle="PAYMENT VOUCHER"
        copyLabel="ACCOUNTS COPY"
        voucherType="payment"
        accountDescription={() => 'Sample Vendor LLC VEND-001'}
        trnValue="123456789"
        docNoValue="PAY-0001"
        branch="HO"
        dateValue="2026-07-08"
        preparedByValue="Admin"
        amountLabel="Amount (USD)"
        currencyLabel="USD"
        lineItems={[{
          branch: 'HO',
          type: 'expense',
          amountFC: 1000,
          amountLC: 1000,
          narration: 'Office expenses',
        }]}
        primaryLine={{}}
        totals={{ grandTotal: 1000 }}
        amountWords="One Thousand United States Dollar Only"
        partyName="Sample Vendor LLC"
        partyAddress="Vendor Street"
        partyPhone="+971 4 000 0000"
        postingDirection="DEBITED"
        normalizeLineType={(type) => type}
        fmt={fmt}
      />,
    )

    const currencyTitleBox = screen.getByText('PAYMENT VOUCHER').closest('.voucher-pro-title-box')
    expect(currencyTitleBox).toBeTruthy()
    expect(currencyTitleBox.getAttribute('style') || '').toContain('translateX(-50%)')
    expect(screen.getByText('ACCOUNTS COPY')).toBeTruthy()
    expect(screen.getAllByText('Sample Vendor LLC VEND-001').length).toBeGreaterThan(0)
    expect(screen.getByText('Vendor Street')).toBeTruthy()
    expect(screen.getByText('PAY NO')).toBeTruthy()
  })

  it('prints Net Amt in USD and UZS when net amount rows are provided', () => {
    render(
      <ProfessionalCurrencyVoucherPrintLayout
        companyName="LoopC Trading LLC"
        printTitle="PAYMENT VOUCHER"
        copyLabel="ACCOUNTS COPY"
        voucherType="payment"
        accountDescription={() => 'Cash on Hand'}
        docNoValue="PAY-0141"
        dateValue="2026-10-08"
        amountLabel="Amount (UZS)"
        currencyLabel="UZS"
        lineItems={[{ type: 'expense', amountFC: 145990130, amountLC: 13271.83, narration: 'Expenses' }]}
        primaryLine={{}}
        totals={{ grandTotal: 145990130 }}
        amountWords="One Hundred Forty Five Million"
        postingDirection="DEBITED"
        normalizeLineType={(type) => type}
        fmt={fmt}
        netAmountRows={[
          { code: 'USD', amount: 13271.83 },
          { code: 'UZS', amount: 145990130 },
        ]}
      />,
    )

    expect(screen.getByText(/Net Amt \(USD\)/)).toBeTruthy()
    expect(screen.getByText(/Net Amt \(UZS\)/)).toBeTruthy()
    expect(screen.getByText(/Net Amt \(USD\)/).textContent).toContain('13271.83')
  })

  it('omits the Net Amt strip when only one currency row exists', () => {
    render(
      <ProfessionalCurrencyVoucherPrintLayout
        printTitle="PAYMENT VOUCHER"
        voucherType="payment"
        accountDescription={() => 'Cash on Hand'}
        currencyLabel="USD"
        lineItems={[]}
        primaryLine={{}}
        totals={{ grandTotal: 100 }}
        normalizeLineType={(type) => type}
        fmt={fmt}
        netAmountRows={[{ code: 'USD', amount: 100 }]}
      />,
    )

    expect(screen.queryByText(/Net Amt \(USD\)/)).toBeNull()
  })
})
