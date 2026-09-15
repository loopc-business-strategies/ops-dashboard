const {
  hasModuleVerb,
  resolveApprovalPolicy,
  assertMakerChecker,
  isFinanceUser,
  VERBS,
} = require('../services/permissions/approvalPolicy')

describe('approvalPolicy', () => {
  test('exposes standard verbs', () => {
    expect(VERBS).toEqual(expect.arrayContaining(['view', 'create', 'edit', 'submit', 'approve', 'post', 'delete', 'export']))
  })

  test('legacy module on grants view/create/edit', () => {
    const user = { role: 'department_user', modulePermissions: { finance: { on: true } } }
    expect(hasModuleVerb(user, 'finance', 'view')).toBe(true)
    expect(hasModuleVerb(user, 'finance', 'edit')).toBe(true)
    expect(hasModuleVerb(user, 'finance', 'approve')).toBe(false)
  })

  test('explicit verb true wins', () => {
    const user = { role: 'department_user', modulePermissions: { finance: { on: true, export: true } } }
    expect(hasModuleVerb(user, 'finance', 'export')).toBe(true)
  })

  test('maker-checker blocks same user', () => {
    const policy = resolveApprovalPolicy('payment')
    expect(policy.dualControl).toBe(true)
    const msg = assertMakerChecker({
      policy,
      creatorId: 'u1',
      approverId: 'u1',
      amount: 50000,
    })
    expect(msg).toMatch(/cannot be the same/i)
  })

  test('maker-checker allows distinct users', () => {
    const policy = resolveApprovalPolicy('payment')
    expect(assertMakerChecker({
      policy,
      creatorId: 'u1',
      approverId: 'u2',
      amount: 50000,
    })).toBeNull()
  })

  test('isFinanceUser maps finance department head', () => {
    expect(isFinanceUser({ role: 'department_head', department: 'finance' })).toBe(true)
    expect(isFinanceUser({ role: 'department_user', department: 'finance' })).toBe(false)
    expect(isFinanceUser({ role: 'super_admin' })).toBe(true)
  })
})
