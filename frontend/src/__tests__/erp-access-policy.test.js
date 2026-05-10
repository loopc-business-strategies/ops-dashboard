import { describe, it, expect } from 'vitest'
import { deriveErpAccessPolicy } from '../components/tabs/erp/accessPolicy'

describe('deriveErpAccessPolicy', () => {
  it('grants broad ERP access to super admin', () => {
    const policy = deriveErpAccessPolicy({ role: 'super_admin', department: '' })

    expect(policy.canAccessERP).toBe(true)
    expect(policy.canAccessTransactions).toBe(true)
    expect(policy.canManageVendors).toBe(true)
    expect(policy.canAccessDirectDeals).toBe(true)
    expect(policy.canViewBalanceEnquiry).toBe(true)
  })

  it('grants sales head transaction and direct deal access but not ledger', () => {
    const policy = deriveErpAccessPolicy({ role: 'department_head', department: 'sales' })

    expect(policy.canAccessTransactions).toBe(true)
    expect(policy.canAccessDirectDeals).toBe(true)
    expect(policy.canAccessVouchers).toBe(true)
    expect(policy.canViewLedger).toBe(false)
    expect(policy.canManageAccounts).toBe(false)
  })

  it('limits department user without finance role from account management', () => {
    const policy = deriveErpAccessPolicy({ role: 'department_user', department: 'operations' })

    expect(policy.canManageAccounts).toBe(false)
    expect(policy.canViewLedger).toBe(false)
    expect(policy.canAccessInventory).toBe(false)
    expect(policy.canAccessERP).toBe(false)
  })
})
