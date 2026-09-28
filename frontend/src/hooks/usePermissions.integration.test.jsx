import React from 'react'
import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

let mockedUser = null

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockedUser }),
}))

import { usePermissions } from './usePermissions'

function PermissionsProbe() {
  const perms = usePermissions()
  return (
    <div>
      <p data-testid="erp">{String(perms.canViewERP)}</p>
      <p data-testid="erp-dashboard">{String(perms.canViewERPSubTab('dashboard'))}</p>
      <p data-testid="erp-transactions">{String(perms.canViewERPSubTab('transactions'))}</p>
      <p data-testid="finance">{String(perms.canViewModule('finance'))}</p>
      <p data-testid="sales">{String(perms.canViewModule('sales'))}</p>
      <p data-testid="admin">{String(perms.canViewAdmin)}</p>
      <p data-testid="readonly">{String(perms.isReadOnly)}</p>
      <p data-testid="operations">{String(perms.canViewModule('operations'))}</p>
      <p data-testid="mg-floor-approver">{String(perms.canApproveMgFloor)}</p>
    </div>
  )
}

describe('sidebar permission integration', () => {
  test('granular permissions control module visibility before role defaults', () => {
    mockedUser = {
      role: 'management',
      allowedModules: [],
      modulePermissions: {
        erp: { on: true },
        finance: { on: false },
        sales: { on: true },
      },
    }

    render(<PermissionsProbe />)

    expect(screen.getByTestId('erp').textContent).toBe('true')
    expect(screen.getByTestId('finance').textContent).toBe('false')
    expect(screen.getByTestId('sales').textContent).toBe('true')
    expect(screen.getByTestId('admin').textContent).toBe('false')
    expect(screen.getByTestId('readonly').textContent).toBe('true')
  })

  test('granular ERP subtabs override legacy allowedModules access', () => {
    mockedUser = {
      role: 'management',
      allowedModules: ['erp'],
      modulePermissions: {
        erp: {
          on: true,
          subs: {
            transactions: { on: true },
          },
        },
      },
    }

    render(<PermissionsProbe />)

    expect(screen.getByTestId('erp').textContent).toBe('true')
    expect(screen.getByTestId('erp-dashboard').textContent).toBe('false')
    expect(screen.getByTestId('erp-transactions').textContent).toBe('true')
  })

  test('granular ERP off overrides legacy allowedModules access', () => {
    mockedUser = {
      role: 'management',
      allowedModules: ['erp'],
      modulePermissions: {
        erp: { on: false },
      },
    }

    render(<PermissionsProbe />)

    expect(screen.getByTestId('erp').textContent).toBe('false')
    expect(screen.getByTestId('erp-transactions').textContent).toBe('false')
  })

  test('department users only see their own department by default', () => {
    mockedUser = {
      role: 'department_user',
      department: 'finance',
      allowedModules: [],
      modulePermissions: {},
    }

    render(<PermissionsProbe />)

    expect(screen.getByTestId('finance').textContent).toBe('true')
    expect(screen.getByTestId('sales').textContent).toBe('false')
    expect(screen.getByTestId('erp').textContent).toBe('false')
  })

  test('MG production heads are Floor Manager approvers without getting the Operations module', () => {
    mockedUser = { role: 'department_head', department: 'production', company: 'mg', allowedModules: [], modulePermissions: {} }

    render(<PermissionsProbe />)

    expect(screen.getByTestId('mg-floor-approver').textContent).toBe('true')
    expect(screen.getByTestId('operations').textContent).toBe('false')
  })

  test('operators, other tenants and other departments are not MG Floor approvers', () => {
    const cases = [
      { role: 'department_user', department: 'production', company: 'mg' },
      { role: 'department_head', department: 'production', company: 'loopc' },
      { role: 'department_head', department: 'finance', company: 'mg' },
    ]
    for (const user of cases) {
      mockedUser = { ...user, allowedModules: [], modulePermissions: {} }
      const { unmount } = render(<PermissionsProbe />)
      expect(screen.getByTestId('mg-floor-approver').textContent).toBe('false')
      unmount()
    }
  })

  test('an explicit floor_manager productionRole counts as an MG Floor approver', () => {
    mockedUser = { role: 'department_user', department: 'operations', productionRole: 'floor_manager', company: 'MG', allowedModules: [], modulePermissions: {} }

    render(<PermissionsProbe />)

    expect(screen.getByTestId('mg-floor-approver').textContent).toBe('true')
  })
})
