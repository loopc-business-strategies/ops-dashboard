import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'super_admin', company: 'mg' }, token: 't', company: 'mg' }),
}))

const superAdminPerms = {
  canViewTab: () => true,
  canEditTab: () => true,
  isSuperAdmin: true,
  isDepartmentHead: false,
  isManagement: false,
  isDepartmentUser: false,
  isExternal: false,
}
let mockPerms = superAdminPerms
vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => mockPerms,
}))

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: (key) => key }),
}))

const getInventory = vi.fn(async () => ({ inventory: [] }))
vi.mock('../../api/operations/inventory', () => ({
  inventoryApi: {
    getInventory: (...args) => getInventory(...args),
  },
}))

const listBatchEntries = vi.fn()
vi.mock('../../api/mgFloorBatchEntries', () => ({
  mgFloorBatchEntriesApi: {
    list: (...args) => listBatchEntries(...args),
    approve: vi.fn(),
    reject: vi.fn(),
    lossLimits: vi.fn(async () => ({ success: true, limits: {} })),
  },
}))

const listOperationsEntries = vi.fn()
vi.mock('../../api/productionControl', () => ({
  productionControlApi: {
    listOperationsEntries: (...args) => listOperationsEntries(...args),
    createOperationsEntry: vi.fn(),
    updateOperationsEntry: vi.fn(),
    deleteOperationsEntry: vi.fn(),
  },
}))

import OperationsTab from './OperationsTab'

describe('OperationsTab smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPerms = superAdminPerms
    listBatchEntries.mockResolvedValue({ entries: [], counts: { PENDING: 0 }, canDecide: false })
    listOperationsEntries.mockResolvedValue({ entries: [], total: 0, hasMore: false })
  })

  it('opens the Production department workbook first for non-LoopC tenants', async () => {
    render(
      <MemoryRouter>
        <OperationsTab />
      </MemoryRouter>,
    )
    const tabLabels = screen.getAllByRole('link').map((el) => el.textContent)
    expect(tabLabels[0]).toBe('Production')
    expect(await screen.findByText('VAULT ROOM', { exact: false }, { timeout: 5000 })).toBeTruthy()
    await waitFor(() => expect(listOperationsEntries).toHaveBeenCalled(), { timeout: 5000 })
    expect(await screen.findByText(/Source of truth for the Production Dashboard/, {}, { timeout: 5000 })).toBeTruthy()
  })

  it('shows the FM tab with the pending count when the backend allows approving', async () => {
    listBatchEntries.mockResolvedValue({ entries: [], counts: { PENDING: 3 }, canDecide: true })
    render(
      <MemoryRouter>
        <OperationsTab />
      </MemoryRouter>,
    )
    expect(await screen.findByText('FM (3)')).toBeTruthy()
    expect(listBatchEntries).toHaveBeenCalledWith({ status: 'PENDING', limit: 1 })
  })

  it('hides the FM tab when the user cannot approve', async () => {
    render(
      <MemoryRouter>
        <OperationsTab />
      </MemoryRouter>,
    )
    await vi.waitFor(() => expect(listBatchEntries).toHaveBeenCalled())
    expect(screen.queryByText(/^FM/)).toBeNull()
  })

  it('gives a Floor Manager without the Operations module only the Production and floor tabs', async () => {
    mockPerms = {
      ...superAdminPerms,
      isSuperAdmin: false,
      isDepartmentHead: true,
      canApproveMgFloor: true,
      canViewModule: (module) => module === 'production',
    }
    listBatchEntries.mockResolvedValue({ entries: [], counts: { PENDING: 1 }, canDecide: true })
    render(
      <MemoryRouter>
        <OperationsTab />
      </MemoryRouter>,
    )
    expect(await screen.findByText('FM (1)')).toBeTruthy()
    expect(screen.getAllByRole('link').map((el) => el.textContent)).toEqual(['Production', 'FM (1)', 'Attendance', 'Loss limits', 'Loss report', 'History'])
    expect(screen.queryByText(/kpiOverview/i)).toBeNull()
    expect(getInventory).not.toHaveBeenCalled()
  })

  it('mounts operations tab shell', async () => {
    render(
      <MemoryRouter>
        <OperationsTab />
      </MemoryRouter>,
    )
    // Shell tab labels use t('kpiOverview'); smoke mock returns the key as-is.
    expect(screen.getAllByText(/kpiOverview/i).length).toBeGreaterThan(0)
  })
})
