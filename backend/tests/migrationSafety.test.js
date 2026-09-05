const {
  assertMigrationApplyAllowed,
  redactMongoUri,
  looksLikeNonProductionUri,
} = require('../utils/migrationSafety')

describe('migrationSafety', () => {
  const previous = { ...process.env }

  beforeEach(() => {
    process.env = { ...previous }
    delete process.env.ALLOW_PRODUCTION_MIGRATION
    delete process.env.APP_ENV
    delete process.env.STAGING_MONGO_URI_MG
    delete process.env.STAGING_MONGO_URI_LOOPC
    delete process.env.MONGO_URI_MG
    delete process.env.MONGO_URI_LOOPC
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = { ...previous }
    jest.restoreAllMocks()
  })

  test('redactMongoUri hides credentials', () => {
    const redacted = redactMongoUri('mongodb+srv://user:secret@cluster0.abcd.mongodb.net/mydb')
    expect(redacted).toBe('cluster0.abcd.mongodb.net/mydb')
    expect(redacted).not.toContain('secret')
  })

  test('blocks apply on production-like URI', () => {
    process.env.APP_ENV = 'staging'
    process.env.MIGRATION_I_HAVE_BACKUP = 'true'
    process.env.MIGRATION_CONFIRM_TOKEN = 'token'
    process.env.STAGING_MONGO_URI_MG = 'mongodb+srv://u:p@prod-cluster.mongodb.net/ops'

    expect(() => assertMigrationApplyAllowed({
      tenants: ['mg'],
      resolveUri: () => 'mongodb+srv://u:p@prod-cluster.mongodb.net/ops',
    })).toThrow(/production-like/i)
  })

  test('ALLOW_PRODUCTION_MIGRATION does not bypass staging gate', () => {
    process.env.APP_ENV = 'production'
    process.env.ALLOW_PRODUCTION_MIGRATION = 'true'
    process.env.MIGRATION_I_HAVE_BACKUP = 'true'
    process.env.MIGRATION_CONFIRM_TOKEN = 'token'
    process.env.STAGING_MONGO_URI_MG = 'mongodb+srv://u:p@staging-mg.abcd.mongodb.net/ops_staging'

    expect(() => assertMigrationApplyAllowed({
      tenants: ['mg'],
      resolveUri: () => process.env.STAGING_MONGO_URI_MG,
    })).toThrow(/APP_ENV must be exactly "staging"/i)
  })

  test('allows apply on staging URI when APP_ENV=staging and backup flag set', () => {
    process.env.APP_ENV = 'staging'
    process.env.MIGRATION_I_HAVE_BACKUP = 'true'
    process.env.MIGRATION_CONFIRM_TOKEN = 'token'
    process.env.STAGING_MONGO_URI_LOOPC = 'mongodb+srv://u:p@staging-loopc.abcd.mongodb.net/ops_staging'

    expect(() => assertMigrationApplyAllowed({
      tenants: ['loopc'],
      resolveUri: () => process.env.STAGING_MONGO_URI_LOOPC,
    })).not.toThrow()
  })

  test('looksLikeNonProductionUri detects staging hosts', () => {
    expect(looksLikeNonProductionUri('mongodb+srv://x/staging-db')).toBe(true)
    expect(looksLikeNonProductionUri('mongodb+srv://prod.abcd.mongodb.net/db')).toBe(false)
  })

  test('known production Atlas hosts are always rejected', () => {
    const { isKnownProductionMongoHost } = require('../utils/migrationSafety')
    expect(isKnownProductionMongoHost('mongodb+srv://u:p@cluster0.m5yqfs7.mongodb.net/ops')).toBe(true)
    expect(looksLikeNonProductionUri('mongodb+srv://u:p@cluster0.m5yqfs7.mongodb.net/ops_test')).toBe(false)
    expect(looksLikeNonProductionUri('mongodb+srv://u:p@staging-mg.abcd.mongodb.net/ops')).toBe(true)
  })
})
