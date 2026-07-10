import React, { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ReportSettingsPanel from './ReportSettingsPanel'

vi.mock('./ReportBrandingPreview', () => ({
  default: ({ branding }) => (
    <div data-testid="report-preview">{branding.entityName}</div>
  ),
}))

describe('ReportSettingsPanel', () => {
  it('updates entity fields and calls save', () => {
    const onSave = vi.fn(async () => true)

    function Harness() {
      const [branding, setBranding] = useState({
        entityName: 'Main Entity',
        reportSubtitle: 'Finance & Accounts Division',
        reportFooter: 'Confidential Internal Statement',
        preparedByTitle: 'Prepared By',
        preparedByName: 'Finance Officer',
      })
      return (
        <ReportSettingsPanel
          branding={branding}
          onChange={setBranding}
          onSave={onSave}
          saving={false}
          error=""
          status=""
        />
      )
    }

    render(<Harness />)
    expect(screen.getByText(/shared from Voucher Settings/)).toBeTruthy()
    expect(screen.getByTestId('report-preview').textContent).toBe('Main Entity')

    fireEvent.change(screen.getByLabelText('Entity name'), { target: { value: 'Updated Entity' } })
    expect(screen.getByTestId('report-preview').textContent).toBe('Updated Entity')

    fireEvent.click(screen.getByRole('button', { name: 'Save report settings' }))
    expect(onSave).toHaveBeenCalled()
  })
})
