import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import ExpenseDashboardModal from './ExpenseDashboardModal'

vi.mock('./useExpenseRegisterExports', () => ({
  useExpenseRegisterExports: () => ({
    exportBusy: false,
    handleDownloadMonthlyReports: vi.fn(),
  }),
}))

vi.mock('./useExpenseRegister', () => ({
  expenseRegisterYearStart: () => '2026-01-01',
  useExpenseRegister: () => ({
    items: [
      {
        id: 'e1',
        date: '2026-06-04T00:00:00.000Z',
        category: 'Gpay/Paytm',
        amount: 1000,
        paymentSource: 'bank',
      },
      {
        id: 'e2',
        date: '2026-06-04T00:00:00.000Z',
        category: 'Rent Expense',
        amount: 200,
        paymentSource: 'bank',
      },
    ],
    categories: ['Gpay/Paytm', 'Rent Expense'],
    total: 2,
    loading: false,
    error: '',
    reload: () => {},
  }),
}))

describe('ExpenseDashboardModal chart filters', () => {
  it('shows category breakdown from register when all months selected', () => {
    render(
      <ExpenseDashboardModal
        dashboard={{
          expenses: {
            total: 0,
            breakdown: [],
            ytdTotal: 303972,
            monthlyTrend: [{ label: 'Jun 2026', month: 'Jun', year: '2026', monthIndex: 5, amount: 303972 }],
          },
        }}
        token="test-token"
        onClose={() => {}}
        onOpenLedgerEntry={() => {}}
      />,
    )

    const breakdownSection = screen.getByText('Expense Breakdown').closest('section')
    expect(within(breakdownSection).getByText('Gpay/Paytm')).toBeTruthy()
    expect(within(breakdownSection).getByText('Rent Expense')).toBeTruthy()
    expect(within(breakdownSection).getByText('$1,200.00')).toBeTruthy()
  })
})
