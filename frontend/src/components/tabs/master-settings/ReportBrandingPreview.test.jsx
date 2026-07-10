import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import ReportBrandingPreview from './ReportBrandingPreview'

describe('ReportBrandingPreview', () => {
  it('renders entity, subtitle, signatories, and footer from branding', () => {
    render(
      <ReportBrandingPreview
        branding={{
          companyName: 'MODERN GOLD JEWELRY MANUFACTURING FE LLC',
          entityName: 'Main Entity',
          branchName: 'HQ',
          legalName: 'MODERN GOLD FE LLC',
          address: 'Dubai, UAE',
          reportSubtitle: 'Finance & Accounts Division',
          reportFooter: 'Confidential Internal Statement',
          preparedByTitle: 'Prepared By',
          preparedByName: 'Finance Officer',
          reviewedByTitle: 'Reviewed By',
          reviewedByName: 'Accounts Manager',
          approvedByTitle: 'Authorized Signatory',
          approvedByName: 'Finance Controller',
        }}
      />,
    )

    expect(screen.getByTestId('report-branding-preview')).toBeTruthy()
    expect(screen.getByText('MODERN GOLD JEWELRY MANUFACTURING FE LLC')).toBeTruthy()
    expect(screen.getByText('Main Entity / HQ')).toBeTruthy()
    expect(screen.getByText('MODERN GOLD FE LLC')).toBeTruthy()
    expect(screen.getByText(/Finance & Accounts Division/)).toBeTruthy()
    expect(screen.getByText('Confidential Internal Statement')).toBeTruthy()
    expect(screen.getByText(/Finance Officer/)).toBeTruthy()
    expect(screen.getByText(/Accounts Manager/)).toBeTruthy()
    expect(screen.getByText(/Finance Controller/)).toBeTruthy()
  })
})
