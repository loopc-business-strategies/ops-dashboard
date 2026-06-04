const {
  canManageEmployees,
  buildEmployeeReadFilter,
  canCreateTask,
  canViewTask,
  canWriteFinanceModule,
  canWriteComplianceModule,
  canWriteTrainingModule,
  canViewCrm,
  canEditCrm,
  canAccessDepartmentStateModule,
  canManageAttendance,
  canSeeAllMessages,
  buildMessageScopeForUser,
  canEditInventory,
  resolveModuleAccess,
  erp,
} = require('../services/permissions/moduleAccessPolicy')

const user = (overrides = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  name: 'Test User',
  role: 'department_user',
  department: '',
  allowedModules: [],
  modulePermissions: {},
  ...overrides,
})

describe('moduleAccessPolicy', () => {
  test('HR manage allows super admin and HR department head', () => {
    expect(canManageEmployees(user({ role: 'super_admin' }))).toBe(true)
    expect(canManageEmployees(user({ role: 'department_head', department: 'hr' }))).toBe(true)
    expect(canManageEmployees(user({ role: 'department_head', department: 'finance' }))).toBe(false)
  })

  test('modulePermissions override legacy HR access', () => {
    expect(canManageEmployees(user({
      role: 'department_head',
      department: 'hr',
      modulePermissions: { hr: { on: false, edit: false } },
    }))).toBe(false)

    expect(canManageEmployees(user({
      role: 'department_user',
      department: 'finance',
      modulePermissions: { hr: { on: true, edit: true } },
    }))).toBe(true)
  })

  test('employee read filter scopes non-management users to their department', () => {
    expect(buildEmployeeReadFilter(user({ role: 'super_admin' }))).toEqual({})
    expect(buildEmployeeReadFilter(user({ role: 'department_head', department: 'finance' }))).toEqual({
      department: /^finance$/i,
    })
    expect(buildEmployeeReadFilter(user({ role: 'department_user', department: '' }))).toBeNull()
  })

  test('tasks block management and external from creating tasks', () => {
    expect(canCreateTask(user({ role: 'management' }))).toBe(false)
    expect(canCreateTask(user({ role: 'external' }))).toBe(false)
    expect(canCreateTask(user({ role: 'department_user', department: 'finance' }))).toBe(true)
  })

  test('external task visibility respects allowedModules', () => {
    const task = { department: 'finance', assignedTo: 'Other', assignedToId: null }
    expect(canViewTask(user({ role: 'external', allowedModules: ['finance'] }), task)).toBe(true)
    expect(canViewTask(user({ role: 'external', allowedModules: ['sales'] }), task)).toBe(false)
  })

  test('finance/compliance/training write rules match module policy', () => {
    expect(canWriteFinanceModule(user({ role: 'department_head', department: 'finance' }))).toBe(true)
    expect(canWriteFinanceModule(user({ role: 'department_head', department: 'sales' }))).toBe(false)
    expect(canWriteComplianceModule(user({ role: 'department_head', department: 'compliance' }))).toBe(true)
    expect(canWriteTrainingModule(user({ role: 'department_head', department: 'operations' }))).toBe(true)
  })

  test('CRM view/edit honors sales roles and modulePermissions', () => {
    expect(canViewCrm(user({ role: 'department_user', department: 'sales' }))).toBe(true)
    expect(canEditCrm(user({ role: 'department_user', department: 'sales' }))).toBe(false)
    expect(canEditCrm(user({ role: 'department_head', department: 'sales' }))).toBe(true)
    expect(canViewCrm(user({
      role: 'department_user',
      department: 'finance',
      modulePermissions: { sales: { on: true } },
    }))).toBe(true)
  })

  test('department-state module access maps departments correctly', () => {
    expect(canAccessDepartmentStateModule(user({ role: 'super_admin' }), 'admin')).toBe(true)
    expect(canAccessDepartmentStateModule(user({ role: 'department_head', department: 'finance' }), 'finance')).toBe(true)
    expect(canAccessDepartmentStateModule(user({ role: 'department_head', department: 'government' }), 'compliance')).toBe(true)
    expect(canAccessDepartmentStateModule(user({ role: 'department_head', department: 'hr' }), 'training')).toBe(true)
    expect(canAccessDepartmentStateModule(user({ role: 'department_head', department: 'sales' }), 'finance')).toBe(false)
  })

  test('buildMessageScopeForUser scopes DMs, member groups, and legacy group rows', () => {
    const uid = '507f1f77bcf86cd799439011'
    const gid = '507f1f77bcf86cd799439012'
    const user = { _id: uid, name: 'Alice' }
    const scope = buildMessageScopeForUser(user, [gid])
    expect(scope.$or).toHaveLength(3)
    expect(scope.$or[0]).toMatchObject({ type: 'dm' })
    expect(scope.$or[1]).toEqual({ type: 'group', groupId: { $in: [gid] } })
    expect(scope.$or[2].type).toBe('group')
    expect(scope.$or[2].$and).toBeDefined()
  })

  test('buildMessageScopeForUser without groups omits groupId clause', () => {
    const user = { _id: '507f1f77bcf86cd799439011', name: 'Bob' }
    const scope = buildMessageScopeForUser(user, [])
    expect(scope.$or).toHaveLength(2)
    expect(scope.$or.find((c) => c.groupId)).toBeUndefined()
  })

  test('attendance and messages helpers preserve role semantics', () => {
    expect(canManageAttendance(user({ role: 'department_head', department: 'hr' }))).toBe(true)
    expect(canSeeAllMessages(user({ role: 'management' }))).toBe(true)
    expect(canSeeAllMessages(user({ role: 'department_user', department: 'finance' }))).toBe(false)
  })

  test('legacy ERP inventory edit requires production head or super admin', () => {
    expect(canEditInventory(user({ role: 'super_admin' }))).toBe(true)
    expect(canEditInventory(user({ role: 'department_head', department: 'production' }))).toBe(true)
    expect(canEditInventory(user({ role: 'department_head', department: 'operations' }))).toBe(false)
  })

  test('ERP accounting policy remains available through moduleAccessPolicy.erp', () => {
    expect(erp.canAccessTransactions(user({ role: 'super_admin' }))).toBe(true)
    expect(erp.canAccessTransactions(user({ role: 'department_head', department: 'sales' }))).toBe(true)
  })

  test('resolveModuleAccess falls back to legacy when modulePermissions unset', () => {
    expect(resolveModuleAccess(user({ role: 'department_head', department: 'hr' }), 'hr', () => false)).toBe(false)
    expect(resolveModuleAccess(user({ role: 'department_head', department: 'hr' }), 'hr', () => true)).toBe(true)
  })
})
