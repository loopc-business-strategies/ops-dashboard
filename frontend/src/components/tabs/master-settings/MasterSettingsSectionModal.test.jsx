import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MasterSettingsSectionModal from './MasterSettingsSectionModal'

describe('MasterSettingsSectionModal', () => {
  it('renders nothing when closed', () => {
    render(
      <MasterSettingsSectionModal open={false} onClose={vi.fn()} title="Voucher Settings">
        <div>Settings body</div>
      </MasterSettingsSectionModal>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('Settings body')).toBeNull()
  })

  it('renders title and children when open', () => {
    render(
      <MasterSettingsSectionModal open onClose={vi.fn()} title="Voucher Settings">
        <div>Settings body</div>
      </MasterSettingsSectionModal>,
    )
    expect(screen.getByRole('dialog', { name: 'Voucher Settings' })).toBeTruthy()
    expect(screen.getByText('Settings body')).toBeTruthy()
  })

  it('shows resize handle and draggable header when open', () => {
    render(
      <MasterSettingsSectionModal open onClose={vi.fn()} title="Voucher Settings">
        <div>Settings body</div>
      </MasterSettingsSectionModal>,
    )
    expect(screen.getByLabelText('Resize')).toBeTruthy()
    const dialog = screen.getByRole('dialog', { name: 'Voucher Settings' })
    const header = dialog.querySelector('div[style*="grab"]')
    expect(header).toBeTruthy()
  })

  it('calls onClose when Close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <MasterSettingsSectionModal open onClose={onClose} title="Voucher Settings">
        <div>Settings body</div>
      </MasterSettingsSectionModal>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      <MasterSettingsSectionModal open onClose={onClose} title="Voucher Settings">
        <div>Settings body</div>
      </MasterSettingsSectionModal>,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('resets panel transform after close and reopen', () => {
    const { rerender } = render(
      <MasterSettingsSectionModal open onClose={vi.fn()} title="Voucher Settings">
        <div>Settings body</div>
      </MasterSettingsSectionModal>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Voucher Settings' })
    const header = dialog.firstElementChild
    fireEvent.mouseDown(header, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(window, { clientX: 160, clientY: 140 })
    fireEvent.mouseUp(window)
    expect(dialog.style.transform).toContain('translate3d')

    rerender(
      <MasterSettingsSectionModal open={false} onClose={vi.fn()} title="Voucher Settings">
        <div>Settings body</div>
      </MasterSettingsSectionModal>,
    )
    rerender(
      <MasterSettingsSectionModal open onClose={vi.fn()} title="Voucher Settings">
        <div>Settings body</div>
      </MasterSettingsSectionModal>,
    )
    const reopened = screen.getByRole('dialog', { name: 'Voucher Settings' })
    expect(reopened.style.transform).toBe('translate3d(0px, 0px, 0)')
  })
})
