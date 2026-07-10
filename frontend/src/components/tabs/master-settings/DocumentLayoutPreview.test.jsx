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
