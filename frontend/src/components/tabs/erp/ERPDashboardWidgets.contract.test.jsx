import React from 'react'
import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { renderERP_DashWidget } from './ERPDashboardWidgets'

vi.mock('./useExpenseRegister', () => ({
  expenseRegisterYearStart: () => '2026-01-01',
  useExpenseRegister: () => ({
    items: [{
      id: 'e1',
      date: '2026-05-01T00:00:00.000Z',
      category: 'Operating Expenses',
      description: 'Office rent',
      amount: 500,
      paymentSource: 'bank',
      paymentMethod: 'Bank',
      paymentRoute: 'HSBC Current (1010) → Operating Expenses (6100)',
      referenceType: 'expense',
      ledgerRef: 'JV-1024',
      creditAccount: { code: '1010', name: 'HSBC Current' },
      debitAccount: { code: '6100', name: 'Operating Expenses' },
    }],
    categories: ['Operating Expenses'],
    total: 1,
    loading: false,
    error: '',
    reload: () => {},
  }),
}))

describe('ERPDashboardWidgets contract', () => {
  test('renders fallback content for unknown widget id', () => {
    render(<div>{renderERP_DashWidget('unknown-widget', {}, [])}</div>)
    expect(screen.getByText('Widget content')).toBeTruthy()
  })

  test('renders expenses empty-state contract', () => {
    render(<div>{renderERP_DashWidget('expenses', { expenses: { total: 0, breakdown: [], ytdTotal: 0, monthlyTrend: [] } }, [])}</div>)
    expect(screen.getByText('No expenses in period.')).toBeTruthy()
  })

  test('renders expenses YTD fallback when current period is empty', () => {
    render(
      <div>
        {renderERP_DashWidget(
          'expenses',
          {
            expenses: {
              total: 0,
              breakdown: [],
              ytdTotal: 15000,
              currentMonthTotal: 0,
              lastMonthTotal: 4200,
              monthlyTrend: [
                { label: 'May 2026', month: 'May', year: '2026', amount: 4200 },
                { label: 'Apr 2026', month: 'Apr', year: '2026', amount: 10800 },
              ],
            },
          },
          []
        )}
      </div>
    )

    expect(screen.getByText(/year-to-date activity/i)).toBeTruthy()
    expect(screen.getByText('THIS YEAR')).toBeTruthy()
  })

  test('expenses modal shows register filters, payment route, and ledger ref', () => {
    render(
      <div>
        {renderERP_DashWidget(
          'expenses',
          {
            expenses: {
              total: 500,
              breakdown: [{ name: 'Operating Expenses', amount: 500 }],
              ytdTotal: 500,
              currentMonthTotal: 500,
              lastMonthTotal: 0,
              transactionCount: 1,
              monthlyTrend: [{ label: 'Jul 2026', month: 'Jul', year: '2026', amount: 500 }],
            },
          },
          [],
          null,
          null,
          { token: 'test-token', onOpenLedgerEntry: () => {} },
        )}
      </div>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'View More Details' }))
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
    expect(screen.getByText('Expense Register')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bank' })).toBeTruthy()
    expect(screen.getByText('HSBC Current (1010) → Operating Expenses (6100)')).toBeTruthy()
    expect(screen.getByText('JV-1024')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open in Ledger' })).toBeTruthy()
  })

  test('renders notifications contract with action link', () => {
    render(
      <div>
        {renderERP_DashWidget(
          'notif',
          {
            vendorComplianceRisk: { nonCompliant: 2, averageScore: 78 },
            vendorDocumentExpiry: { warning30: 1, warning60: 3 },
            lowStockAlerts: [{ id: 1 }],
          },
          [],
          () => {},
          null
        )}
      </div>
    )

    expect(screen.getByText('↗ View All Alerts')).toBeTruthy()
  })

  test('renders AP/AR empty state and deficit styling', () => {
    render(
      <div>
        {renderERP_DashWidget(
          'apar',
          {
            apAr: {
              totalAR: 0,
              totalAP: 3388.43,
              netPosition: -3388.43,
              arCount: 0,
              apCount: 2,
              customerOutstanding: [],
              supplierOutstanding: [
                { supplierName: 'Vendor A', outstanding: 2000 },
                { supplierName: 'Vendor B', outstanding: 1388.43 },
              ],
            },
          },
          []
        )}
      </div>
    )

    expect(screen.getByText('0 open')).toBeTruthy()
    expect(screen.getByText('No outstanding balances.')).toBeTruthy()
    expect(screen.getByText('▼ Deficit')).toBeTruthy()
  })
})
