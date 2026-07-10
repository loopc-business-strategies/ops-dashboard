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

  it('keeps section content hidden until a launcher opens its modal', async () => {
    render(<MasterSettingsTab />)

    expect(await screen.findByText('Master Settings')).toBeTruthy()
    expect(screen.queryByText('Vouchers')).toBeNull()
    expect(screen.queryByText('Report digest schedule')).toBeNull()
    expect(screen.queryByText('Save voucher settings')).toBeNull()
  })

  it('shows voucher and statement launcher cards for LOOPC', async () => {
    render(<MasterSettingsTab />)
    expect(await screen.findByRole('button', { name: /Voucher Settings/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Statement Settings/i })).toBeTruthy()
  })

  it('opens voucher settings in a modal', async () => {
    render(<MasterSettingsTab />)
    fireEvent.click(await screen.findByRole('button', { name: /Voucher Settings/i }))
    expect(await screen.findByRole('dialog', { name: 'Voucher Settings' })).toBeTruthy()
    expect(screen.getByText('Save voucher settings')).toBeTruthy()
    expect(screen.getByText('Table headers')).toBeTruthy()
    expect(screen.getByText('Full voucher preview')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open full preview' })).toBeTruthy()
    expect(screen.getByText('No line items')).toBeTruthy()
  })

  it('closes voucher settings modal from the header close button', async () => {
    render(<MasterSettingsTab />)
    fireEvent.click(await screen.findByRole('button', { name: /Voucher Settings/i }))
    expect(await screen.findByRole('dialog', { name: 'Voucher Settings' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'Voucher Settings' })).toBeNull()
    expect(screen.queryByText('Save voucher settings')).toBeNull()
  })

  it('opens statement settings modal with full preview controls', async () => {
    render(<MasterSettingsTab />)
    fireEvent.click(await screen.findByRole('button', { name: /Statement Settings/i }))
    expect(await screen.findByRole('dialog', { name: 'Statement Settings' })).toBeTruthy()
    expect(screen.getByText('Save statement settings')).toBeTruthy()
    expect(screen.getByText('Full statement preview')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Empty' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sample' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open full preview' })).toBeTruthy()
    expect(await screen.findByTitle('Statement inline preview')).toBeTruthy()
  })

  it('opens notification settings in a modal', async () => {
    render(<MasterSettingsTab />)
    fireEvent.click(await screen.findByRole('button', { name: /Notification Settings/i }))
    expect(await screen.findByRole('dialog', { name: 'Notification Settings' })).toBeTruthy()
    expect(screen.getByText('Vouchers')).toBeTruthy()
    expect(screen.getByText('Report digest schedule')).toBeTruthy()
    expect(screen.getByText('Web push (browser)')).toBeTruthy()
  })
})
