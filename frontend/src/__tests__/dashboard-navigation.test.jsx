import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import Dashboard from '../pages/Dashboard'

const useAuthMock = vi.fn()
const usePermissionsMock = vi.fn()
const useLanguageMock = vi.fn()

const notifSocket = { onNotification: null }

vi.mock('../utils/realtimeSocket', () => ({
  startUserNotifications: (opts) => {
    notifSocket.onNotification = opts.onNotification
    return () => {
      notifSocket.onNotification = null
    }
  },
  startProjectsSse: () => () => {},
}))

vi.mock('../context/LiveMetalRatesContext', () => ({
  LiveMetalRatesProvider: ({ children }) => <>{children}</>,
}))

vi.mock('../components/TopbarMetalTickers', () => ({
  default: () => null,
}))

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
  default: ({ onNavigate, buildTabHref }) => (
    <div>
      <div>overview-tab</div>
      {buildTabHref ? (
        <a
          href={buildTabHref('finance')}
          onClick={(event) => {
            event.preventDefault()
            onNavigate?.('finance')
          }}
        >
          Revenue
        </a>
      ) : null}
    </div>
  ),
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
  default: ({ focusTab, jumpToTransactionId }) => (
    <div>{`erp-tab-focus:${focusTab}`}{jumpToTransactionId ? `|jump:${jumpToTransactionId}` : ''}</div>
  ),
}))

function renderDashboard(initialEntry = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Dashboard />
    </MemoryRouter>
  )
}

describe('Dashboard navigation behavior', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      user: { name: 'Nan', role: 'super_admin', company: 'mg', _id: '507f1f77bcf86cd799439011' },
      company: 'mg',
      token: 'test-token',
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

  it('sidebar ERP ledger link opens in a new tab', async () => {
    renderDashboard()

    const ledgerLink = await screen.findByRole('link', { name: 'Ledger' })
    expect(ledgerLink.getAttribute('href')).toContain('tab=erp-ledger')
    expect(ledgerLink.getAttribute('target')).toBe('_blank')
    expect(ledgerLink.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('loads ERP supplier margin from URL deep link', async () => {
    renderDashboard('/dashboard?tab=erp-supplier-margin')
    expect(await screen.findByText('erp-tab-focus:supplier-margin')).toBeTruthy()
  })

  it('loads HR tab from URL deep link', async () => {
    renderDashboard('/dashboard?tab=hr&sub=labour_law')
    expect(await screen.findByText('hr-tab')).toBeTruthy()
  })

  it('shows Sales Manager AI as external sidebar link for LoopC', async () => {
    useAuthMock.mockReturnValue({
      user: { name: 'Loop User', role: 'super_admin', company: 'loopc', _id: '507f1f77bcf86cd799439011' },
      company: 'loopc',
      token: 'test-token',
      logout: vi.fn(),
    })

    renderDashboard()
    const link = await screen.findByRole('link', { name: 'Sales Manager AI' })
    expect(link.getAttribute('href')).toBe('https://sales.loopcstrategies.com')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('loads Account Summary from URL deep link with account param', async () => {
    renderDashboard('/dashboard?tab=erp-enquiry&account=1000&view=statement')
    expect(await screen.findByText('erp-tab-focus:enquiry')).toBeTruthy()
  })

  it('overview finance KPI link includes tab query for open in new tab', async () => {
    renderDashboard()
    await screen.findByText('overview-tab')

    const financeLink = screen.getByRole('link', { name: /Revenue/i })
    expect(financeLink.getAttribute('href')).toContain('tab=finance')
    fireEvent.click(financeLink)

    expect(await screen.findByText('finance-tab')).toBeTruthy()
  })

  it('bell lists chat notification and opens Chat tab when row is clicked', async () => {
    renderDashboard()
    await screen.findByText('overview-tab')

    const senderId = '507f1f77bcf86cd799439012'
    notifSocket.onNotification?.({
      type: 'chat_message',
      data: {
        channelType: 'dm',
        senderId,
        senderName: 'Alex',
        message: 'Hello there',
      },
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }))
    expect(await screen.findByText('Message from Alex')).toBeTruthy()

    fireEvent.click(screen.getByText('Hello there'))
    expect(await screen.findByText('chat-tab')).toBeTruthy()
  })

  it('bell transaction mention opens ERP transactions with jump id', async () => {
    renderDashboard()
    await screen.findByText('overview-tab')

    const txId = '507f1f77bcf86cd799439099'
    notifSocket.onNotification?.({
      type: 'transaction_chat_mention',
      data: {
        transactionId: txId,
        message: '@you fix this',
        senderName: 'Alex',
      },
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }))
    fireEvent.click(screen.getByText('Transaction chat mention'))

    expect(await screen.findByText(`erp-tab-focus:transactions|jump:${txId}`)).toBeTruthy()
  })
})
