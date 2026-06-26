const {
  assertStagingMongoTargets,
  resolveStagingMongoUri,
  mapStagingMongoToProcessEnv,
} = require('../utils/stagingMongoSafety')

describe('stagingMongoSafety', () => {
  test('resolveStagingMongoUri prefers STAGING_MONGO_URI_*', () => {
    const uri = resolveStagingMongoUri('mg', {
      STAGING_MONGO_URI_MG: 'mongodb+srv://x/staging-mg',
      MONGO_URI_MG: 'mongodb+srv://x/prod-mg',
    })
    expect(uri).toContain('staging-mg')
  })

  test('assertStagingMongoTargets blocks production-like URIs', () => {
    expect(() => assertStagingMongoTargets(['mg'], {
      STAGING_MONGO_URI_MG: 'mongodb+srv://u:p@prod-cluster.mongodb.net/ops',
    })).toThrow(/production-like/i)
  })

  test('assertStagingMongoTargets allows staging URIs', () => {
    expect(() => assertStagingMongoTargets(['loopc'], {
      STAGING_MONGO_URI_LOOPC: 'mongodb+srv://u:p@staging-loopc.abcd.mongodb.net/ops_staging',
    })).not.toThrow()
  })

  test('mapStagingMongoToProcessEnv copies staging keys', () => {
    const mapped = mapStagingMongoToProcessEnv({
      STAGING_MONGO_URI_MG: 'mongodb+srv://x/staging',
    })
    expect(mapped.MONGO_URI_MG).toBe('mongodb+srv://x/staging')
  })
})
