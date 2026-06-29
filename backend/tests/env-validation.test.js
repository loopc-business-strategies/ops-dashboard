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
  const originalMongoMg = process.env.MONGO_URI_MG
  const originalMongoCg = process.env.MONGO_URI_CG
  const originalMongoLoopc = process.env.MONGO_URI_LOOPC

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
    delete process.env.JWT_SECRET
    delete process.env.METAL_RATES_BRIDGE_TOKEN
    if (originalServerBase === undefined) delete process.env.SERVER_BASE_URL
    else process.env.SERVER_BASE_URL = originalServerBase
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
})
