import React, { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import VoucherSettingsPanel from './VoucherSettingsPanel'

vi.mock('./DocumentLayoutPreview', () => ({
  default: () => <div>Layout preview</div>,
}))

vi.mock('./DocumentLogoEditor', () => ({
  default: ({ onChange }) => (
    <button
      type="button"
      onClick={() => onChange({ logoUrl: 'data:image/png;base64,uploaded' })}
    >
      Mock upload logo
    </button>
  ),
}))

vi.mock('./VoucherTableHeaderEditor', () => ({
  default: () => <div>Table headers</div>,
}))

vi.mock('./SignatoryEditor', () => ({
  default: () => <div>Signatories</div>,
}))

vi.mock('../voucher/VoucherPrintPanel', () => ({
  default: () => <div>Voucher print panel</div>,
}))

vi.mock('../voucher/VoucherPreviewModal', () => ({
  default: () => null,
}))

describe('VoucherSettingsPanel logo upload', () => {
  it('stores uploaded logoUrl in branding state', () => {
    function Harness() {
      const [branding, setBranding] = useState({
        companyName: 'LoopC',
        logoUrl: '',
        voucherPrint: {},
      })
      return (
        <div>
          <span data-testid="logo-url">{branding.logoUrl}</span>
          <VoucherSettingsPanel
            branding={branding}
            onChange={setBranding}
            onSave={vi.fn()}
            saving={false}
            error=""
            status=""
            user={{ company: 'loopc' }}
          />
        </div>
      )
    }

    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Mock upload logo' }))
    expect(screen.getByTestId('logo-url').textContent).toBe('data:image/png;base64,uploaded')
  })
})
