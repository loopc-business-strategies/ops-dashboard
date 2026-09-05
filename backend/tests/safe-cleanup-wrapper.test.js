const { validateExecutionRequest } = require('../utils/safeCleanupWrapper')

const originalEnv = { ...process.env }
const originalArgv = [...process.argv]

beforeEach(() => {
  process.env = { ...originalEnv }
  process.argv = [...originalArgv]
  delete process.env.APP_ENV
  delete process.env.ALLOW_PRODUCTION_DESTRUCTIVE_SCRIPT
  delete process.env.ALLOW_PRODUCTION_CLEANUP
  delete process.env.STAGING_MONGO_URI_MG
  delete process.env.MONGO_URI_MG
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  process.env = { ...originalEnv }
  process.argv = [...originalArgv]
  jest.restoreAllMocks()
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

  test('blocks cleanup without APP_ENV=staging', () => {
    process.env.NODE_ENV = 'production'
    process.env.CLEANUP_CONFIRM_TOKEN = 'real-cleanup-token'
    process.env.STAGING_MONGO_URI_MG = 'mongodb+srv://u:p@staging-mg.abcd.mongodb.net/ops'

    const result = validateExecutionRequest({
      tenant: 'mg',
      apply: true,
      providedToken: 'real-cleanup-token',
      reason: 'approved cleanup',
    })

    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/APP_ENV must be exactly "staging"/i)
  })

  test('ALLOW_PRODUCTION flags do not bypass staging gate', () => {
    process.env.NODE_ENV = 'production'
    process.env.ALLOW_PRODUCTION_DESTRUCTIVE_SCRIPT = 'true'
    process.env.ALLOW_PRODUCTION_CLEANUP = 'true'
    process.env.CLEANUP_CONFIRM_TOKEN = 'real-cleanup-token'
    process.env.STAGING_MONGO_URI_MG = 'mongodb+srv://u:p@staging-mg.abcd.mongodb.net/ops'

    const result = validateExecutionRequest({
      tenant: 'mg',
      apply: true,
      providedToken: 'real-cleanup-token',
      reason: 'approved cleanup',
    })

    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/APP_ENV must be exactly "staging"/i)
  })

  test('allows execution when staging env and staging URI are set', () => {
    process.env.APP_ENV = 'staging'
    process.env.CLEANUP_CONFIRM_TOKEN = 'real-cleanup-token'
    process.env.STAGING_MONGO_URI_MG = 'mongodb+srv://u:p@staging-mg.abcd.mongodb.net/ops_staging'

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
