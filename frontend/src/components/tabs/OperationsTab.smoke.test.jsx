import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'super_admin', company: 'mg' }, token: 't', company: 'mg' }),
}))

vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    canViewTab: () => true,
    canEditTab: () => true,
    isSuperAdmin: true,
    isDepartmentHead: false,
    isManagement: false,
    isDepartmentUser: false,
    isExternal: false,
  }),
}))

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: (key) => key }),
}))

vi.mock('../../api/operations/inventory', () => ({
  inventoryApi: {
    getInventory: vi.fn(async () => ({ inventory: [] })),
  },
}))

const listBatchEntries = vi.fn()
vi.mock('../../api/mgFloorBatchEntries', () => ({
  mgFloorBatchEntriesApi: {
    list: (...args) => listBatchEntries(...args),
    approve: vi.fn(),
    reject: vi.fn(),
  },
}))

import OperationsTab from './OperationsTab'

describe('OperationsTab smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listBatchEntries.mockResolvedValue({ entries: [], counts: { PENDING: 0 }, canDecide: false })
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
