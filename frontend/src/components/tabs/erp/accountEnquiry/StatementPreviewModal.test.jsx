import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StatementPreviewModal from './StatementPreviewModal'

describe('StatementPreviewModal', () => {
  it('renders without Print button by default', () => {
    render(
      <StatementPreviewModal
        open
        onClose={vi.fn()}
        title="Statement of Account"
        html="<html><body>Preview</body></html>"
        loading={false}
      />,
    )
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Print' })).toBeNull()
  })

  it('shows Print button when showPrintButton is enabled', () => {
    render(
      <StatementPreviewModal
        open
        onClose={vi.fn()}
        title="Statement of Account"
        html="<html><body>Preview</body></html>"
        loading={false}
        showPrintButton
      />,
    )
    expect(screen.getByRole('button', { name: 'Print' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
  })

  it('allows scrolling in the iframe wrapper for tall statements', () => {
    render(
      <StatementPreviewModal
        open
        onClose={vi.fn()}
        title="Statement of Account"
        html="<html><body>Preview</body></html>"
        loading={false}
      />,
    )
    const iframe = screen.getByTitle('Statement preview')
    expect(iframe.parentElement?.style.overflow).toBe('auto')
  })

  it('does not close when backdrop is clicked immediately after drag ends', () => {
    const onClose = vi.fn()
    const { container } = render(
      <StatementPreviewModal
        open
        onClose={onClose}
        title="Statement of Account"
        html="<html><body>Preview</body></html>"
        loading={false}
      />,
    )
    const backdrop = container.firstChild
    const header = container.querySelector('div[style*="grab"]')
    fireEvent.mouseDown(header, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(window, { clientX: 160, clientY: 140 })
    fireEvent.mouseUp(window)
    fireEvent.click(backdrop)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('Statement of Account')).toBeTruthy()
  })

  it('calls onClose when backdrop is clicked without dragging', () => {
    const onClose = vi.fn()
    const { container } = render(
      <StatementPreviewModal
        open
        onClose={onClose}
        title="Statement of Account"
        html="<html><body>Preview</body></html>"
        loading={false}
      />,
    )
    fireEvent.click(container.firstChild)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
