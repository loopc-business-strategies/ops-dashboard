import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'

const useAuthMock = vi.fn()
const useLanguageMock = vi.fn()

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => useLanguageMock(),
  LANGUAGES: [{ code: 'en', nativeLabel: 'English', flag: 'EN' }],
}))

vi.mock('../../hooks/useLiveMetalRates', () => ({
  default: () => ({ snapshot: {}, error: null }),
}))

vi.mock('../../context/LiveMetalRatesContext', () => ({
  useLiveMetalRatesContext: () => ({ snapshot: {} }),
}))

vi.mock('./erp/tabs/ERPDashboardTab', () => ({ default: () => <div>erp-dashboard</div> }))
vi.mock('./erp/ERPTabContainers', () => ({
  ERPAccountsTabContainer: () => <div>accounts-shell</div>,
  ERPVouchersTabContainer: () => <div>vouchers-shell</div>,
}))

import ERPTab from './ERPTab'

describe('ERPTab smoke', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      user: { _id: 'u1', role: 'super_admin', company: 'loopc', modulePermissions: { erp: { on: true } } },
      token: 'cookie-session',
    })
    useLanguageMock.mockReturnValue({ t: (key) => key })
  })

  it('renders ERP shell without throwing', () => {
    render(
      <MemoryRouter>
        <ERPTab focusTab="dashboard" />
      </MemoryRouter>,
    )
    expect(screen.getByText('erp-dashboard')).toBeTruthy()
    expect(screen.queryByText('moduleFailedLoad')).toBeNull()
  })
})
