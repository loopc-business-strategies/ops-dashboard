import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
})
