import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'finance', department: 'finance' }, token: 't' }),
}))

vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({ canViewTab: () => true, canEditTab: () => true }),
}))

vi.mock('../../api/erp-accounting', () => ({
  default: {
    getFinanceSummary: vi.fn(async () => ({ summary: {} })),
    getFinanceRecords: vi.fn(async () => ({ records: [] })),
  },
}))

import FinanceTab from '../FinanceTab'

describe('FinanceTab smoke', () => {
  it('mounts finance tab without throwing', async () => {
    render(<FinanceTab />)
    expect(await screen.findByText(/finance|revenue|expense/i)).toBeTruthy()
  })
})
