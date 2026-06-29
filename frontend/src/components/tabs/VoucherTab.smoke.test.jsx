import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'super_admin' }, token: 't' }),
}))

vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({ canViewTab: () => true }),
}))

vi.mock('../voucher/voucherErpApi', () => ({
  default: {
    listVouchers: vi.fn(async () => ({ vouchers: [] })),
  },
}))

vi.mock('../../api/erp-accounting', () => ({
  default: {
    getCurrencies: vi.fn(async () => ({ currencies: [] })),
    getCustomers: vi.fn(async () => ({ customers: [] })),
  },
}))

import VoucherTab from '../VoucherTab'

describe('VoucherTab smoke', () => {
  it('renders voucher editor shell', async () => {
    render(<VoucherTab />)
    expect(await screen.findByText(/voucher/i)).toBeTruthy()
  })
})
