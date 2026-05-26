import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import Dashboard from '../pages/Dashboard'

const useAuthMock = vi.fn()
const usePermissionsMock = vi.fn()
const useLanguageMock = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => usePermissionsMock(),
}))

vi.mock('../context/LanguageContext', () => ({
  LANGUAGES: [
    { code: 'en', nativeLabel: 'English', flag: 'EN' },
    { code: 'ar', nativeLabel: 'Arabic', flag: 'AR' },
  ],
  useLanguage: () => useLanguageMock(),
}))

vi.mock('../components/BuildInfoBadge', () => ({
  default: () => <div>build-info</div>,
}))

vi.mock('../components/tabs/OverviewTab', () => ({
  default: () => <div>overview-tab</div>,
}))
vi.mock('../components/tabs/AdminTab', () => ({
  default: () => <div>admin-tab</div>,
}))
vi.mock('../components/tabs/HRTab', () => ({
  default: () => <div>hr-tab</div>,
}))
vi.mock('../components/tabs/FinanceTab', () => ({
  default: () => <div>finance-tab</div>,
}))
vi.mock('../components/tabs/ProductionTab', () => ({
  default: () => <div>production-tab</div>,
}))
vi.mock('../components/tabs/ChatTab', () => ({
  default: () => <div>chat-tab</div>,
}))
vi.mock('../components/tabs/TrainingTab', () => ({
  default: () => <div>training-tab</div>,
}))
vi.mock('../components/tabs/OperationsTab', () => ({
  default: () => <div>operations-tab</div>,
}))
vi.mock('../components/tabs/SalesTab', () => ({
  default: () => <div>sales-tab</div>,
}))
vi.mock('../components/tabs/ComplianceTab', () => ({
  default: () => <div>compliance-tab</div>,
}))
vi.mock('../components/tabs/ProcurementPlusTab', () => ({
  default: () => <div>procurement-plus-tab</div>,
}))
vi.mock('../components/tabs/ERPTab', () => ({
  default: ({ focusTab }) => <div>{`erp-tab-focus:${focusTab}`}</div>,
}))

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  )
}

describe('Dashboard navigation behavior', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      user: { name: 'Nan', role: 'super_admin', company: 'mg' },
      company: 'mg',
      logout: vi.fn(),
    })

    usePermissionsMock.mockReturnValue({
      canViewModule: () => true,
      canViewERP: true,
      isReadOnly: false,
    })

    useLanguageMock.mockReturnValue({
      t: (key) => {
        const map = {
          overview: 'Overview',
          chat: 'Chat',
          admin: 'Admin',
          hr: 'HR',
          compliance: 'Compliance',
          production: 'Production',
          finance: 'Finance',
          sales: 'Sales',
          operations: 'Operations',
          training: 'Training',
          adminSection: 'Admin',
          departments: 'Departments',
          erp: 'ERP',
          dashboard: 'Dashboard',
          signOut: 'Sign out',
          controlSystem: 'Control System',
          language: 'Language',
          superAdmin: 'Super Admin',
        }
        return map[key] || key
      },
      isRTL: false,
      switchLanguage: vi.fn(),
      langMeta: { code: 'en', nativeLabel: 'English', flag: 'EN' },
    })
  })

  it('renders overview tab by default', async () => {
    renderDashboard()
    expect(await screen.findByText('overview-tab')).toBeTruthy()
  })

  it('navigates to ERP ledger and passes focusTab=ledger to ERPTab', async () => {
    renderDashboard()

    const ledgerButton = await screen.findByRole('button', { name: 'Ledger' })
    fireEvent.click(ledgerButton)

    expect(await screen.findByText('erp-tab-focus:ledger')).toBeTruthy()
  })
})
