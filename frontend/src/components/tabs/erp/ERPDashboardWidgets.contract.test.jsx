import React from 'react'
import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderERP_DashWidget } from './ERPDashboardWidgets'

describe('ERPDashboardWidgets contract', () => {
  test('renders fallback content for unknown widget id', () => {
    render(<div>{renderERP_DashWidget('unknown-widget', {}, [])}</div>)
    expect(screen.getByText('Widget content')).toBeTruthy()
  })

  test('renders expenses empty-state contract', () => {
    render(<div>{renderERP_DashWidget('expenses', { expenses: { total: 0, breakdown: [] } }, [])}</div>)
    expect(screen.getByText('No expenses in period.')).toBeTruthy()
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
})
