import { describe, expect, test, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ChartOfAccountsTree from './ChartOfAccountsTree'

const t = (key) => ({
  add: 'Add',
  accountTree: 'Account Tree',
  refresh: 'Refresh',
  searchByNameOrCode: 'Search',
  loading: 'Loading',
  cancel: 'Cancel',
  create: 'Create',
  saving: 'Saving',
  update: 'Update',
  move: 'Move',
  selectType: 'Select type...',
  exampleAccountCode: 'e.g. 1010',
  noAccounts: 'No accounts',
  failedToLoadAccounts: 'Failed',
}[key] || key)

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token' }),
}))

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ t }),
}))

vi.mock('../../utils/erpSharedAccountChart', () => ({
  loadSharedAccountChart: vi.fn(async (_token, { onPage } = {}) => {
    const rows = [
      {
        _id: 'a1',
        accountCode: '1000',
        accountName: 'Cash',
        accountType: 'Asset',
        currency: 'USD',
        isActive: true,
      },
    ]
    onPage?.(rows, { page: 1 })
    return rows
  }),
}))

vi.mock('../../utils/erpSharedCurrencies', () => ({
  loadSharedCurrencies: vi.fn(async () => ({
    currencies: [
      { code: 'USD', name: 'US Dollar', baseCurrency: true, isActive: true },
      { code: 'AED', name: 'UAE Dirham', isActive: true },
    ],
  })),
}))

vi.mock('../../api/erp-accounting', () => ({
  default: {},
}))

describe('ChartOfAccountsTree Add Sub Account modal layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('opens a wide single-view form without vertical scroll on the shell', async () => {
    render(<ChartOfAccountsTree canManageAccounts />)

    await waitFor(() => {
      expect(screen.getByText('+ Add')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('+ Add'))

    expect(await screen.findByRole('heading', { name: 'Add Sub Account' })).toBeTruthy()

    for (const label of [
      'Create As',
      'Account Name *',
      'Account Code *',
      'Account Type *',
      'Sub Account Under',
      'Currency',
      'Department',
      'Opening Balance',
      'Margin %',
      'TRN',
      'Authorized Person',
      'Address',
      'Description',
    ]) {
      expect(screen.getByText(label)).toBeTruthy()
    }

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy()

    const shell = screen.getByRole('heading', { name: 'Add Sub Account' }).closest('div')?.parentElement
    expect(shell).toBeTruthy()
    expect(shell.style.width).toBe('780px')
    expect(shell.style.overflow).toBe('hidden')
    expect(shell.style.overflowY).not.toBe('auto')
    expect(shell.style.display).toBe('flex')
  })
})
