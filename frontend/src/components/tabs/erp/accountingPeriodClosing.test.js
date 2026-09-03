import { describe, expect, it } from 'vitest'
import { canManageAccountingPeriods, deriveErpAccessPolicy } from './accessPolicy'
import { isAccountingPeriodClosingEnabled } from '../../../config/tenantBranding'

describe('accounting period permissions', () => {
  it('allows only super_admin to manage periods', () => {
    expect(canManageAccountingPeriods({ role: 'super_admin' })).toBe(true)
    expect(canManageAccountingPeriods({ role: 'department_head', department: 'finance' })).toBe(false)
    expect(deriveErpAccessPolicy({ role: 'super_admin' }).canManageAccountingPeriods).toBe(true)
  })
})

describe('accountingPeriodClosing tenant flag', () => {
  it('is enabled for loopc and cg, disabled for mg', () => {
    expect(isAccountingPeriodClosingEnabled('loopc')).toBe(true)
    expect(isAccountingPeriodClosingEnabled('cg')).toBe(true)
    expect(isAccountingPeriodClosingEnabled('mg')).toBe(false)
  })
})
