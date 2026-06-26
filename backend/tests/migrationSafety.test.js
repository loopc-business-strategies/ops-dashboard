const {
  assertMigrationApplyAllowed,
  redactMongoUri,
  looksLikeNonProductionUri,
} = require('../utils/migrationSafety')

describe('migrationSafety', () => {
  const previous = { ...process.env }

  afterEach(() => {
    process.env = { ...previous }
  })

  test('redactMongoUri hides credentials', () => {
    const redacted = redactMongoUri('mongodb+srv://user:secret@cluster0.abcd.mongodb.net/mydb')
    expect(redacted).toBe('cluster0.abcd.mongodb.net/mydb')
    expect(redacted).not.toContain('secret')
  })

  test('blocks apply on production-like URI without override', () => {
    process.env.MIGRATION_I_HAVE_BACKUP = 'true'
    process.env.MIGRATION_CONFIRM_TOKEN = 'token'
    delete process.env.ALLOW_PRODUCTION_MIGRATION

    expect(() => assertMigrationApplyAllowed({
      tenants: ['mg'],
      resolveUri: () => 'mongodb+srv://u:p@prod-cluster.mongodb.net/ops',
    })).toThrow(/production-like/i)
  })

  test('allows apply on staging URI when backup flag set', () => {
    process.env.MIGRATION_I_HAVE_BACKUP = 'true'
    process.env.MIGRATION_CONFIRM_TOKEN = 'token'

    expect(() => assertMigrationApplyAllowed({
      tenants: ['loopc'],
      resolveUri: () => 'mongodb+srv://u:p@staging-loopc.abcd.mongodb.net/ops_staging',
    })).not.toThrow()
  })

  test('looksLikeNonProductionUri detects staging hosts', () => {
    expect(looksLikeNonProductionUri('mongodb+srv://x/staging-db')).toBe(true)
    expect(looksLikeNonProductionUri('mongodb+srv://prod.abcd.mongodb.net/db')).toBe(false)
  })
})
