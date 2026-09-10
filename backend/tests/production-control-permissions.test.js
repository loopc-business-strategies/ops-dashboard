const { describe, expect, test } = require('@jest/globals')
const {
  resolveProductionRole,
  hasProductionPermission,
} = require('../services/productionControl/permissions')

describe('productionControl permissions', () => {
  test('maps existing roles without requiring productionRole field', () => {
    expect(resolveProductionRole({ role: 'super_admin' })).toBe('production_manager')
    expect(resolveProductionRole({ role: 'department_head', department: 'production' })).toBe('floor_manager')
    expect(resolveProductionRole({ role: 'department_user', department: 'production' })).toBe('operator')
    expect(resolveProductionRole({ role: 'department_user', department: 'finance' })).toBeNull()
  })

  test('explicit productionRole wins', () => {
    expect(resolveProductionRole({
      role: 'department_user',
      department: 'production',
      productionRole: 'vault_officer',
    })).toBe('vault_officer')
  })

  test('weight adjust is manager-only', () => {
    expect(hasProductionPermission({ role: 'super_admin' }, 'adjustWeight')).toBe(true)
    expect(hasProductionPermission({
      role: 'department_user',
      department: 'production',
      productionRole: 'operator',
    }, 'adjustWeight')).toBe(false)
    expect(hasProductionPermission({
      role: 'department_user',
      productionRole: 'production_manager',
    }, 'adjustWeight')).toBe(true)
  })
})
