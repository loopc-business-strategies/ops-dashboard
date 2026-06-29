import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'super_admin' }, token: 't' }),
}))

vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({ canViewTab: () => true, canEditTab: () => true }),
}))

vi.mock('../../api/legacyOpsErp', () => ({
  default: {
    getInventory: vi.fn(async () => ({ inventory: [] })),
    getSuppliers: vi.fn(async () => ({ suppliers: [] })),
    getPurchaseOrders: vi.fn(async () => ({ purchaseOrders: [] })),
    getProcurementDocuments: vi.fn(async () => ({ documents: [] })),
    getExpiryAlerts: vi.fn(async () => ({ alerts: [] })),
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
