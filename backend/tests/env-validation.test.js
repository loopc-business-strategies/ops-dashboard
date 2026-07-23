const {
  isWeakJwtSecret,
  isWeakBridgeToken,
  validateHardenedDeploySecrets,
  validateProductionSecrets,
  isStagingEnv,
} = require('../utils/envValidation')

describe('envValidation', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalServerBase = process.env.SERVER_BASE_URL
  const originalUploadRoot = process.env.UPLOAD_STORAGE_ROOT
  const originalMongoMg = process.env.MONGO_URI_MG
  const originalMongoCg = process.env.MONGO_URI_CG
  const originalMongoLoopc = process.env.MONGO_URI_LOOPC

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
    delete process.env.JWT_SECRET
    delete process.env.METAL_RATES_BRIDGE_TOKEN
    delete process.env.EMAIL_OAUTH_STATE_SECRET
    delete process.env.EMAIL_TOKEN_ENCRYPTION_KEY
    delete process.env.REQUIRE_REDIS
    delete process.env.EXPECTED_REPLICAS
    delete process.env.REDIS_URL
    delete process.env.REDIS_PRIVATE_URL
    if (originalServerBase === undefined) delete process.env.SERVER_BASE_URL
    else process.env.SERVER_BASE_URL = originalServerBase
    if (originalUploadRoot === undefined) delete process.env.UPLOAD_STORAGE_ROOT
    else process.env.UPLOAD_STORAGE_ROOT = originalUploadRoot
    if (originalMongoMg === undefined) delete process.env.MONGO_URI_MG
    else process.env.MONGO_URI_MG = originalMongoMg
    if (originalMongoCg === undefined) delete process.env.MONGO_URI_CG
    else process.env.MONGO_URI_CG = originalMongoCg
    if (originalMongoLoopc === undefined) delete process.env.MONGO_URI_LOOPC
    else process.env.MONGO_URI_LOOPC = originalMongoLoopc
  })

  test('isWeakJwtSecret rejects placeholders and empty values', () => {
    process.env.NODE_ENV = 'development'
    expect(isWeakJwtSecret('')).toBe(true)
    expect(isWeakJwtSecret('change_this_to_a_strong_random_secret')).toBe(true)
    expect(isWeakJwtSecret('local-dev-secret-32-chars-minimum!!')).toBe(false)
  })

  test('isWeakJwtSecret enforces production length and test-secret', () => {
    process.env.NODE_ENV = 'production'
    expect(isWeakJwtSecret('test-secret')).toBe(true)
    expect(isWeakJwtSecret('short')).toBe(true)
    expect(isWeakJwtSecret('a'.repeat(32))).toBe(false)
  })

  test('isWeakJwtSecret enforces staging rules', () => {
    process.env.NODE_ENV = 'staging'
    expect(isWeakJwtSecret('test-secret')).toBe(true)
    expect(isWeakJwtSecret('a'.repeat(32))).toBe(false)
  })

  test('isWeakBridgeToken detects placeholder bridge token', () => {
    expect(isWeakBridgeToken('change-this-long-random-token')).toBe(true)
    expect(isWeakBridgeToken('real-bridge-token-value')).toBe(false)
    expect(isWeakBridgeToken('')).toBe(false)
  })

  test('validateHardenedDeploySecrets returns errors for weak production config', () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = 'change_this_to_a_strong_random_secret'
    process.env.METAL_RATES_BRIDGE_TOKEN = 'change-this-long-random-token'

    const errors = validateHardenedDeploySecrets()
    expect(errors.some((e) => e.includes('JWT_SECRET'))).toBe(true)
    expect(errors.some((e) => e.includes('METAL_RATES_BRIDGE_TOKEN'))).toBe(true)
    expect(errors.some((e) => e.includes('SERVER_BASE_URL'))).toBe(true)
    expect(errors.some((e) => e.includes('UPLOAD_STORAGE_ROOT'))).toBe(true)
    expect(errors.some((e) => e.includes('MONGO_URI_MG'))).toBe(true)
  })

  test('validateHardenedDeploySecrets applies to staging', () => {
    process.env.NODE_ENV = 'staging'
    process.env.JWT_SECRET = 'short'
    const errors = validateHardenedDeploySecrets()
    expect(errors.some((e) => e.includes('JWT_SECRET'))).toBe(true)
    expect(isStagingEnv()).toBe(true)
  })

  test('validateHardenedDeploySecrets is a no-op outside production/staging', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.JWT_SECRET
    expect(validateHardenedDeploySecrets()).toEqual([])
    expect(validateProductionSecrets()).toEqual([])
  })

  test('validateHardenedDeploySecrets requires email OAuth signing secret', () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = 'a'.repeat(32)
    process.env.SERVER_BASE_URL = 'https://api.example.com'
    process.env.UPLOAD_STORAGE_ROOT = require('os').tmpdir()
    process.env.MONGO_URI_MG = 'mongodb://localhost/mg'
    process.env.MONGO_URI_CG = 'mongodb://localhost/cg'
    process.env.MONGO_URI_LOOPC = 'mongodb://localhost/loopc'
    delete process.env.EMAIL_OAUTH_STATE_SECRET
    delete process.env.EMAIL_TOKEN_ENCRYPTION_KEY
    delete process.env.REQUIRE_REDIS
    delete process.env.EXPECTED_REPLICAS

    const errors = validateHardenedDeploySecrets()
    expect(errors.some((e) => e.includes('EMAIL_OAUTH_STATE_SECRET'))).toBe(true)
  })

  test('isRedisRequired when EXPECTED_REPLICAS > 1 or REQUIRE_REDIS', () => {
    const { isRedisRequired, expectedReplicaCount } = require('../utils/envValidation')
    delete process.env.REQUIRE_REDIS
    delete process.env.EXPECTED_REPLICAS
    expect(isRedisRequired()).toBe(false)
    expect(expectedReplicaCount()).toBe(1)

    process.env.EXPECTED_REPLICAS = '2'
    expect(isRedisRequired()).toBe(true)
    expect(expectedReplicaCount()).toBe(2)
    delete process.env.EXPECTED_REPLICAS

    process.env.REQUIRE_REDIS = 'true'
    expect(isRedisRequired()).toBe(true)
    delete process.env.REQUIRE_REDIS
  })

  test('validateHardenedDeploySecrets requires REDIS_URL when scaled', () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = 'a'.repeat(32)
    process.env.SERVER_BASE_URL = 'https://api.example.com'
    process.env.UPLOAD_STORAGE_ROOT = require('os').tmpdir()
    process.env.MONGO_URI_MG = 'mongodb://localhost/mg'
    process.env.MONGO_URI_CG = 'mongodb://localhost/cg'
    process.env.MONGO_URI_LOOPC = 'mongodb://localhost/loopc'
    process.env.EMAIL_TOKEN_ENCRYPTION_KEY = 'b'.repeat(64)
    process.env.EXPECTED_REPLICAS = '2'
    delete process.env.REDIS_URL
    delete process.env.REDIS_PRIVATE_URL

    const errors = validateHardenedDeploySecrets()
    expect(errors.some((e) => e.includes('REDIS_URL'))).toBe(true)
    delete process.env.EXPECTED_REPLICAS
    delete process.env.EMAIL_TOKEN_ENCRYPTION_KEY
  })
})
