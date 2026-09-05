const {
  assertStagingOnlyScript,
  isApprovedStagingAppEnv,
  warnIgnoredProductionOverrides,
} = require('../utils/assertStagingOnlyScript')

describe('assertStagingOnlyScript', () => {
  const previous = { ...process.env }
  const previousArgv = [...process.argv]
  let warnSpy

  beforeEach(() => {
    process.env = { ...previous }
    process.argv = [...previousArgv]
    delete process.env.APP_ENV
    delete process.env.ALLOW_PRODUCTION_DESTRUCTIVE_SCRIPT
    delete process.env.ALLOW_PRODUCTION_MIGRATION
    delete process.env.ALLOW_PRODUCTION_CLEANUP
    delete process.env.STAGING_MONGO_HOST_ALLOWLIST
    for (const tenant of ['MG', 'CG', 'LOOPC']) {
      delete process.env[`STAGING_MONGO_URI_${tenant}`]
      delete process.env[`MONGO_URI_${tenant}`]
    }
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = { ...previous }
    process.argv = [...previousArgv]
    jest.restoreAllMocks()
  })

  test('isApprovedStagingAppEnv accepts staging only', () => {
    expect(isApprovedStagingAppEnv({ APP_ENV: 'staging' })).toBe(true)
    expect(isApprovedStagingAppEnv({ APP_ENV: ' Staging ' })).toBe(true)
    expect(isApprovedStagingAppEnv({ APP_ENV: 'production' })).toBe(false)
    expect(isApprovedStagingAppEnv({})).toBe(false)
  })

  test('refuses without APP_ENV=staging', () => {
    process.env.STAGING_MONGO_URI_MG = 'mongodb+srv://u:p@staging-mg.abcd.mongodb.net/ops'
    expect(() => assertStagingOnlyScript({
      scriptName: 'test-script',
      tenants: ['mg'],
    })).toThrow(/APP_ENV must be exactly "staging"/i)
  })

  test('refuses production-like URI', () => {
    process.env.APP_ENV = 'staging'
    process.env.STAGING_MONGO_URI_MG = 'mongodb+srv://u:p@prod-cluster.mongodb.net/ops'
    expect(() => assertStagingOnlyScript({
      scriptName: 'test-script',
      tenants: ['mg'],
    })).toThrow(/production-like/i)
  })

  test('ignores ALLOW_PRODUCTION override and still refuses production URI', () => {
    process.env.APP_ENV = 'staging'
    process.env.ALLOW_PRODUCTION_DESTRUCTIVE_SCRIPT = 'true'
    process.env.ALLOW_PRODUCTION_MIGRATION = 'true'
    process.env.ALLOW_PRODUCTION_CLEANUP = 'true'
    process.env.STAGING_MONGO_URI_MG = 'mongodb+srv://u:p@prod-cluster.mongodb.net/ops'

    expect(() => assertStagingOnlyScript({
      scriptName: 'test-script',
      tenants: ['mg'],
    })).toThrow(/production-like/i)

    expect(warnSpy).toHaveBeenCalled()
    const warnText = warnSpy.mock.calls.map((call) => call.join(' ')).join('\n')
    expect(warnText).toMatch(/IGNORED\/deprecated/i)
  })

  test('warnIgnoredProductionOverrides is a no-op when flags unset', () => {
    warnIgnoredProductionOverrides({})
    expect(warnSpy).not.toHaveBeenCalled()
  })

  test('accepts staging APP_ENV with staging URI', () => {
    process.env.APP_ENV = 'staging'
    process.env.STAGING_MONGO_URI_MG = 'mongodb+srv://u:p@staging-mg.abcd.mongodb.net/ops_staging'
    expect(() => assertStagingOnlyScript({
      scriptName: 'test-script',
      tenants: ['mg'],
    })).not.toThrow()
  })

  test('refuses --production flag even with staging env', () => {
    process.env.APP_ENV = 'staging'
    process.env.STAGING_MONGO_URI_MG = 'mongodb+srv://u:p@staging-mg.abcd.mongodb.net/ops_staging'
    expect(() => assertStagingOnlyScript(
      { scriptName: 'test-script', tenants: ['mg'] },
      process.env,
      ['node', 'script.js', '--production'],
    )).toThrow(/--production/i)
  })

  test('enforces STAGING_MONGO_HOST_ALLOWLIST when set', () => {
    process.env.APP_ENV = 'staging'
    process.env.STAGING_MONGO_URI_MG = 'mongodb+srv://u:p@staging-mg.abcd.mongodb.net/ops_staging'
    process.env.STAGING_MONGO_HOST_ALLOWLIST = 'other-host.mongodb.net'
    expect(() => assertStagingOnlyScript({
      scriptName: 'test-script',
      tenants: ['mg'],
    })).toThrow(/STAGING_MONGO_HOST_ALLOWLIST/i)
  })
})
