import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MasterSettingsTab from './MasterSettingsTab'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token', user: { company: 'loopc' }, company: { key: 'loopc' } }),
}))

vi.mock('../../api/notifications', () => ({
  getNotificationPreferences: vi.fn(async () => ({
    notificationPreferences: {
      topics: {
        voucher_submitted: true,
        voucher_approved: true,
        voucher_posted: true,
        voucher_returned: true,
        voucher_rejected: true,
        jv_posted: true,
        task_due: true,
        task_overdue: true,
        vendor_due: true,
        vendor_overdue: true,
        chat_message: true,
        chat_mention: true,
        report_digest: true,
        gold_price_alert: true,
        low_stock: true,
      },
      reportDigest: {
        enabled: true,
        timeLocal: '08:00',
        includeExpensesToday: true,
        includeSalesToday: true,
        includeBankCashBalance: true,
        includeGoldPrice: true,
      },
    },
  })),
  updateNotificationPreferences: vi.fn(async (payload) => ({ notificationPreferences: payload })),
  previewReportDigest: vi.fn(async () => ({ text: 'preview' })),
  sendReportDigest: vi.fn(async () => ({ text: 'sent' })),
}))

vi.mock('../../utils/webPushRegister', () => ({
  isWebPushAvailable: vi.fn(async () => true),
  ensureWebPushSubscription: vi.fn(async () => ({ ok: true })),
}))

vi.mock('../../api/erp-accounting', () => ({
  default: {
    getReportBranding: vi.fn(async () => ({
      branding: {
        companyName: 'LoopC',
        address: 'Dubai',
        voucherPrint: { tableHeaders: { no: 'No.' } },
        statementPrint: { title: 'Statement of Account' },
      },
    })),
    updateReportBranding: vi.fn(async (payload) => ({ branding: payload })),
  },
}))

describe('MasterSettingsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is collapsed by default and expands on click', async () => {
    render(<MasterSettingsTab />)

    expect(await screen.findByText('Master Settings')).toBeTruthy()
    expect(screen.queryByText('Vouchers')).toBeNull()
    expect(screen.queryByText('Report digest schedule')).toBeNull()
    expect(screen.queryByText('Web push (browser)')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Notification Settings/i }))
    expect(await screen.findByText('Vouchers')).toBeTruthy()
    expect(screen.getByText('Report digest schedule')).toBeTruthy()
    expect(screen.getByText('Web push (browser)')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Notification Settings/i }))
    expect(screen.queryByText('Vouchers')).toBeNull()
  })

  it('shows voucher and statement settings sections for LOOPC', async () => {
    render(<MasterSettingsTab />)
    expect(await screen.findByRole('button', { name: /Voucher Settings/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Statement Settings/i })).toBeTruthy()
  })

  it('expands voucher settings panel', async () => {
    render(<MasterSettingsTab />)
    fireEvent.click(await screen.findByRole('button', { name: /Voucher Settings/i }))
    expect(await screen.findByText('Save voucher settings')).toBeTruthy()
    expect(screen.getByText('Table headers')).toBeTruthy()
  })
})
