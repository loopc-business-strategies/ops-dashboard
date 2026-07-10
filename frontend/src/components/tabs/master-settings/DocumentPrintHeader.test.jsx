import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import DocumentPrintHeader from '../erp/DocumentPrintHeader'
import { DEFAULT_VOUCHER_PRINT } from '../erp/ERPBrandingUtils'

describe('DocumentPrintHeader logo sizing', () => {
  it('uses branding logo dimensions without a 96px height cap', () => {
    render(
      <DocumentPrintHeader
        branding={{
          companyName: 'LoopC',
          logoUrl: 'data:image/png;base64,abc',
          logoWidth: 220,
          logoHeight: 110,
        }}
        title="Payment Voucher"
      />,
    )

    const logo = screen.getByAltText('Company Logo')
    expect(logo.style.maxHeight).toBe('110px')
    expect(logo.style.maxWidth).toBe('220px')
    expect(logo.style.height).toBe('110px')
    expect(logo.style.width).toBe('220px')
  })

  it('uses layoutSettings titleAccentColor for title lines', () => {
    const { rerender } = render(
      <DocumentPrintHeader
        branding={{ companyName: 'LoopC' }}
        title="Payment Voucher"
        layoutSettings={{ titleAccentColor: '#005B96' }}
      />,
    )

    const lines = screen.getAllByTestId('title-accent-line')
    expect(lines).toHaveLength(2)
    expect(lines[0].style.borderTopColor).toBe('rgb(0, 91, 150)')
    expect(lines[0].style.borderTopWidth).toBe('3px')

    rerender(
      <DocumentPrintHeader
        branding={{ companyName: 'LoopC' }}
        title="Payment Voucher"
      />,
    )
    expect(screen.getAllByTestId('title-accent-line')[0].style.borderTopColor).toBe('rgb(127, 29, 29)')
  })

  it('uses layoutSettings headerDividerColor for the header divider', () => {
    render(
      <DocumentPrintHeader
        branding={{ companyName: 'LoopC' }}
        title="Payment Voucher"
        layoutSettings={{ headerDividerColor: '#005B96' }}
      />,
    )

    expect(screen.getByTestId('header-divider').style.borderBottomColor).toBe('rgb(0, 91, 150)')
    expect(screen.getByTestId('header-divider').style.borderBottomWidth).toBe('2px')
  })

  it('falls back to default black when headerDividerColor is missing', () => {
    render(
      <DocumentPrintHeader
        branding={{ companyName: 'LoopC' }}
        title="Payment Voucher"
      />,
    )

    expect(screen.getByTestId('header-divider').style.borderBottomColor).toBe('rgb(17, 24, 39)')
  })

  it('uses layoutSettings company and address font sizes', () => {
    render(
      <DocumentPrintHeader
        branding={{
          companyName: 'LoopC Trading',
          address: 'Dubai, UAE',
        }}
        title="Payment Voucher"
        layoutSettings={{ companyNameFontSize: 13, addressFontSize: 8 }}
      />,
    )

    expect(screen.getByText('LoopC Trading').style.fontSize).toBe('13px')
    expect(screen.getByText('Dubai, UAE').style.fontSize).toBe('8px')
  })

  it('falls back to default voucher typography when layoutSettings font sizes are missing', () => {
    render(
      <DocumentPrintHeader
        branding={{
          companyName: 'LoopC Trading',
          address: 'Dubai, UAE',
        }}
        title="Payment Voucher"
        layoutSettings={{}}
      />,
    )

    expect(screen.getByText('LoopC Trading').style.fontSize).toBe(`${DEFAULT_VOUCHER_PRINT.companyNameFontSize}px`)
    expect(screen.getByText('Dubai, UAE').style.fontSize).toBe(`${DEFAULT_VOUCHER_PRINT.addressFontSize}px`)
  })
})
