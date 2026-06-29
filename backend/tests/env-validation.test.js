const {
  isWeakJwtSecret,
  isWeakBridgeToken,
  validateProductionSecrets,
} = require('../utils/envValidation')

describe('envValidation', () => {
  const originalNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
    delete process.env.JWT_SECRET
    delete process.env.METAL_RATES_BRIDGE_TOKEN
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

  test('isWeakBridgeToken detects placeholder bridge token', () => {
    expect(isWeakBridgeToken('change-this-long-random-token')).toBe(true)
    expect(isWeakBridgeToken('real-bridge-token-value')).toBe(false)
    expect(isWeakBridgeToken('')).toBe(false)
  })

  test('validateProductionSecrets returns errors for weak production config', () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = 'change_this_to_a_strong_random_secret'
    process.env.METAL_RATES_BRIDGE_TOKEN = 'change-this-long-random-token'

    const errors = validateProductionSecrets()
    expect(errors.some((e) => e.includes('JWT_SECRET'))).toBe(true)
    expect(errors.some((e) => e.includes('METAL_RATES_BRIDGE_TOKEN'))).toBe(true)
  })

  test('validateProductionSecrets is a no-op outside production', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.JWT_SECRET
    expect(validateProductionSecrets()).toEqual([])
  })
})
