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
      <p data-testid="finance">{String(perms.canViewModule('finance'))}</p>
      <p data-testid="sales">{String(perms.canViewModule('sales'))}</p>
      <p data-testid="readonly">{String(perms.isReadOnly)}</p>
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
    expect(screen.getByTestId('readonly').textContent).toBe('true')
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
})
