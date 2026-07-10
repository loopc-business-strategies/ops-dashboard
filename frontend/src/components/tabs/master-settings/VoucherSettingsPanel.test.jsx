import React, { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import VoucherSettingsPanel from './VoucherSettingsPanel'

vi.mock('./DocumentLayoutPreview', () => ({
  default: ({ layoutSettings }) => (
    <div>
      Layout preview
      <span data-testid="preview-accent-color">{layoutSettings?.titleAccentColor || ''}</span>
      <span data-testid="preview-header-divider-color">{layoutSettings?.headerDividerColor || ''}</span>
    </div>
  ),
}))

vi.mock('./DocumentLogoEditor', () => ({
  default: ({ onChange, enableAutoLogoCleanup }) => (
    <div>
      <button
        type="button"
        onClick={() => onChange({ logoUrl: 'data:image/png;base64,uploaded' })}
      >
        Mock upload logo
      </button>
      <span data-testid="auto-cleanup-flag">{String(Boolean(enableAutoLogoCleanup))}</span>
    </div>
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

  test('enables automatic logo cleanup for all tenants', () => {
    const sharedProps = {
      branding: { companyName: 'Test', logoUrl: '', voucherPrint: {} },
      onChange: vi.fn(),
      onSave: vi.fn(),
      saving: false,
      error: '',
      status: '',
    }

    const { rerender } = render(
      <VoucherSettingsPanel
        {...sharedProps}
        user={{ company: 'loopc' }}
      />,
    )
    expect(screen.getByTestId('auto-cleanup-flag').textContent).toBe('true')

    rerender(
      <VoucherSettingsPanel
        {...sharedProps}
        user={{ company: 'mg' }}
      />,
    )
    expect(screen.getByTestId('auto-cleanup-flag').textContent).toBe('true')

    rerender(
      <VoucherSettingsPanel
        {...sharedProps}
        user={{ company: 'cg' }}
      />,
    )
    expect(screen.getByTestId('auto-cleanup-flag').textContent).toBe('true')
  })

  it('updates titleAccentColor from the color picker and resets to default', () => {
    function Harness() {
      const [branding, setBranding] = useState({
        companyName: 'LoopC',
        logoUrl: '',
        voucherPrint: { titleAccentColor: '#7F1D1D' },
      })
      return (
        <div>
          <span data-testid="accent-color">{branding.voucherPrint.titleAccentColor}</span>
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
    const colorInput = screen.getByLabelText('Title line color')
    fireEvent.change(colorInput, { target: { value: '#005b96' } })
    expect(screen.getByTestId('accent-color').textContent).toBe('#005B96')
    expect(screen.getByTestId('preview-accent-color').textContent).toBe('#005B96')

    fireEvent.click(screen.getByRole('button', { name: 'Reset title line to default' }))
    expect(screen.getByTestId('accent-color').textContent).toBe('#7F1D1D')
  })

  it('updates headerDividerColor from the color picker and resets to default', () => {
    function Harness() {
      const [branding, setBranding] = useState({
        companyName: 'LoopC',
        logoUrl: '',
        voucherPrint: { headerDividerColor: '#111827' },
      })
      return (
        <div>
          <span data-testid="divider-color">{branding.voucherPrint.headerDividerColor}</span>
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
    const colorInput = screen.getByLabelText('Header line color')
    fireEvent.change(colorInput, { target: { value: '#005b96' } })
    expect(screen.getByTestId('divider-color').textContent).toBe('#005B96')
    expect(screen.getByTestId('preview-header-divider-color').textContent).toBe('#005B96')

    fireEvent.click(screen.getByRole('button', { name: 'Reset header line to default' }))
    expect(screen.getByTestId('divider-color').textContent).toBe('#111827')
  })
})
