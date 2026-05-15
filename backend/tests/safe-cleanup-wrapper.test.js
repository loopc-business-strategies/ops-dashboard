const { validateExecutionRequest } = require('../utils/safeCleanupWrapper')

const originalEnv = { ...process.env }
const originalArgv = [...process.argv]

afterEach(() => {
  process.env = { ...originalEnv }
  process.argv = [...originalArgv]
})

describe('safe cleanup wrapper guards', () => {
  test('rejects arbitrary 8-character tokens when env token differs', () => {
    process.env.CLEANUP_CONFIRM_TOKEN = 'real-cleanup-token'

    const result = validateExecutionRequest({
      tenant: 'mg',
      apply: true,
      providedToken: '12345678',
      reason: 'approved cleanup',
    })

    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/invalid confirmation token/i)
  })

  test('requires apply mode before execution', () => {
    process.env.CLEANUP_CONFIRM_TOKEN = 'real-cleanup-token'

    const result = validateExecutionRequest({
      tenant: 'mg',
      apply: false,
      providedToken: 'real-cleanup-token',
      reason: 'approved cleanup',
    })

    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/--apply/i)
  })

  test('requires a reason/comment before execution', () => {
    process.env.CLEANUP_CONFIRM_TOKEN = 'real-cleanup-token'

    const result = validateExecutionRequest({
      tenant: 'mg',
      apply: true,
      providedToken: 'real-cleanup-token',
      reason: 'short',
    })

    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/reason\/comment/i)
  })

  test('blocks production cleanup without explicit production allow flag', () => {
    process.env.NODE_ENV = 'production'
    process.env.CLEANUP_CONFIRM_TOKEN = 'real-cleanup-token'

    const result = validateExecutionRequest({
      tenant: 'mg',
      apply: true,
      providedToken: 'real-cleanup-token',
      reason: 'approved cleanup',
    })

    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/production cleanup is blocked/i)
  })

  test('allows execution only when all guard inputs match exactly', () => {
    process.env.NODE_ENV = 'production'
    process.env.ALLOW_PRODUCTION_DESTRUCTIVE_SCRIPT = 'true'
    process.env.CLEANUP_CONFIRM_TOKEN = 'real-cleanup-token'

    const result = validateExecutionRequest({
      tenant: 'mg',
      apply: true,
      providedToken: 'real-cleanup-token',
      reason: 'approved cleanup',
    })

    expect(result.ok).toBe(true)
    expect(result.cleanupReason).toBe('approved cleanup')
  })
})
