import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import DocumentLayoutPreview from './DocumentLayoutPreview'

describe('DocumentLayoutPreview title accent color', () => {
  it('uses layoutSettings titleAccentColor for title lines', () => {
    render(
      <DocumentLayoutPreview
        branding={{ companyName: 'LoopC' }}
        layoutSettings={{ titleAccentColor: '#0A5B96' }}
        title="Payment Voucher"
      />,
    )

    const lines = screen.getAllByTestId('title-accent-line')
    expect(lines).toHaveLength(2)
    expect(lines[0].style.borderTopColor).toBe('rgb(10, 91, 150)')
    expect(lines[1].style.borderTopColor).toBe('rgb(10, 91, 150)')
    expect(lines[0].style.borderTopWidth).toBe('3px')
  })

  it('falls back to default maroon when titleAccentColor is missing', () => {
    render(
      <DocumentLayoutPreview
        branding={{ companyName: 'LoopC' }}
        layoutSettings={{}}
        title="Payment Voucher"
      />,
    )

    expect(screen.getAllByTestId('title-accent-line')[0].style.borderTopColor).toBe('rgb(127, 29, 29)')
  })

  it('uses layoutSettings headerDividerColor for the header divider', () => {
    render(
      <DocumentLayoutPreview
        branding={{ companyName: 'LoopC' }}
        layoutSettings={{ headerDividerColor: '#0A5B96' }}
        title="Payment Voucher"
      />,
    )

    expect(screen.getByTestId('header-divider').style.borderBottomColor).toBe('rgb(10, 91, 150)')
    expect(screen.getByTestId('header-divider').style.borderBottomWidth).toBe('2px')
  })

  it('falls back to default black when headerDividerColor is missing', () => {
    render(
      <DocumentLayoutPreview
        branding={{ companyName: 'LoopC' }}
        layoutSettings={{}}
        title="Payment Voucher"
      />,
    )

    expect(screen.getByTestId('header-divider').style.borderBottomColor).toBe('rgb(17, 24, 39)')
  })
})

describe('DocumentLayoutPreview statement variant', () => {
  it('renders centered title and dates without accent lines or header divider', () => {
    render(
      <DocumentLayoutPreview
        layoutVariant="statement"
        branding={{ companyName: 'MODERN GOLD JEWELRY MANUFACTURING FE LLC', address: 'Dubai, UAE' }}
        layoutSettings={{}}
        title="Statement of Account"
        subtitle="Internal copy"
        dateRange="01-Jan-26 to 08-Jul-26"
      />,
    )

    expect(screen.queryAllByTestId('title-accent-line')).toHaveLength(0)
    expect(screen.getByTestId('header-divider').style.borderBottom).toBe('')
    expect(screen.getByTestId('statement-head')).toBeTruthy()
    expect(screen.getByText('Statement of Account')).toBeTruthy()
    expect(screen.getByText('Internal copy')).toBeTruthy()
    expect(screen.getByTestId('statement-dates').textContent).toBe('Doc Date From 01-Jan-26 To 08-Jul-26')
  })

  it('does not render meta boxes in statement variant', () => {
    render(
      <DocumentLayoutPreview
        layoutVariant="statement"
        branding={{ companyName: 'LoopC' }}
        layoutSettings={{}}
        title="Statement of Account"
        dateRange="01-Jan-26 to 08-Jul-26"
        meta={[
          { label: 'Account', value: 'CUST-001' },
          { label: 'Period', value: '01-Jan-26 to 08-Jul-26' },
        ]}
      />,
    )

    expect(screen.queryByText(/Account:/)).toBeNull()
    expect(screen.queryByText(/Period:/)).toBeNull()
  })

  it('uses configurable company and address font sizes in statement variant', () => {
    render(
      <DocumentLayoutPreview
        layoutVariant="statement"
        branding={{ companyName: 'MODERN GOLD JEWELRY MANUFACTURING FE LLC', address: 'Dubai, UAE' }}
        layoutSettings={{ companyNameFontSize: 13, addressFontSize: 9 }}
        title="Statement of Account"
        dateRange="01-Jan-26 to 08-Jul-26"
      />,
    )

    expect(screen.getByText('MODERN GOLD JEWELRY MANUFACTURING FE LLC').style.fontSize).toBe('13px')
    expect(screen.getByText('Dubai, UAE').style.fontSize).toBe('9px')
  })

  it('uses default voucher typography in voucher variant', () => {
    render(
      <DocumentLayoutPreview
        branding={{ companyName: 'LoopC Trading', address: 'Dubai, UAE' }}
        layoutSettings={{}}
        title="Payment Voucher"
      />,
    )

    expect(screen.getByText('LoopC Trading').style.fontSize).toBe('15px')
    expect(screen.getByText('Dubai, UAE').style.fontSize).toBe('9px')
  })

  it('uses configurable company and address font sizes in voucher variant', () => {
    render(
      <DocumentLayoutPreview
        branding={{ companyName: 'LoopC Trading', address: 'Dubai, UAE' }}
        layoutSettings={{ companyNameFontSize: 12, addressFontSize: 8 }}
        title="Payment Voucher"
      />,
    )

    expect(screen.getByText('LoopC Trading').style.fontSize).toBe('12px')
    expect(screen.getByText('Dubai, UAE').style.fontSize).toBe('8px')
  })
})
