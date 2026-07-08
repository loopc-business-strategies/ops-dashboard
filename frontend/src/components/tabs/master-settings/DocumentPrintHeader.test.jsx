import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import DocumentPrintHeader from '../erp/DocumentPrintHeader'

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
})
