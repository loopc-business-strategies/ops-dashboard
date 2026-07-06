import React from 'react'
import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ERP_DASH_ALL_WIDGETS } from '../erpTabConstants'
import ExpenseDashboardModal from './ExpenseDashboardModal'
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
  test('all dashboard widgets use uniform 2-column span', () => {
    ERP_DASH_ALL_WIDGETS.forEach((widget) => {
      expect(widget.cols).toBe(2)
    })
  })

  test('renders fallback content for unknown widget id', () => {
    render(<div>{renderERP_DashWidget('unknown-widget', {}, [])}</div>)
    expect(screen.getByText('Widget content')).toBeTruthy()
  })

  test('renders expenses empty-state contract', () => {
    render(<div>{renderERP_DashWidget('expenses', { expenses: { total: 0, breakdown: [], ytdTotal: 0, monthlyTrend: [] } }, [])}</div>)
    expect(screen.getByText('Sign in to load expenses.')).toBeTruthy()
  })

  test('expenses card shows charts only without register or filters', () => {
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

    expect(screen.getByText('Expense Breakdown')).toBeTruthy()
    expect(screen.getByText('Monthly Trend')).toBeTruthy()
    expect(screen.getByText('Operating Expenses')).toBeTruthy()
    expect(screen.queryByText('1 entries')).toBeNull()
    expect(screen.queryByLabelText('Expense year')).toBeNull()
    expect(screen.queryByLabelText('Expense month')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Download expense report PDF' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Bank' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open in Ledger' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })

  test('expense dashboard modal shows charts register and close', () => {
    render(
      <ExpenseDashboardModal
        dashboard={{
          expenses: {
            total: 500,
            breakdown: [{ name: 'Operating Expenses', amount: 500 }],
            ytdTotal: 500,
            currentMonthTotal: 500,
            lastMonthTotal: 0,
            transactionCount: 1,
            monthlyTrend: [{ label: 'Jul 2026', month: 'Jul', year: '2026', amount: 500 }],
          },
        }}
        token="test-token"
        onClose={() => {}}
        onOpenLedgerEntry={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
    expect(screen.getByText('Expense Breakdown')).toBeTruthy()
    expect(screen.getByText('Monthly Trend')).toBeTruthy()
    expect(screen.getAllByLabelText('Expense month').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Download expense report PDF' })).toBeTruthy()
    expect(screen.getByLabelText('Expense category')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open in Ledger' })).toBeTruthy()
    expect(screen.getByText('Total Expenses')).toBeTruthy()
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
