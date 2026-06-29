import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'super_admin' }, token: 't' }),
}))

vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({ canViewTab: () => true, canEditTab: () => true }),
}))

vi.mock('../../api/operations/inventory', () => ({
  inventoryApi: {
    getInventory: vi.fn(async () => ({ inventory: [] })),
  },
}))

import OperationsTab from '../OperationsTab'

describe('OperationsTab smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mounts operations tab shell', async () => {
    render(<OperationsTab />)
    expect(await screen.findByText(/operations|inventory|procurement/i)).toBeTruthy()
  })
})
