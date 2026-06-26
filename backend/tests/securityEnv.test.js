const { isLocalDevEnv, isProductionEnv } = require('../utils/securityEnv')

describe('securityEnv', () => {
  const previous = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = previous
  })

  test('isLocalDevEnv is true only for development and test', () => {
    process.env.NODE_ENV = 'development'
    expect(isLocalDevEnv()).toBe(true)
    process.env.NODE_ENV = 'test'
    expect(isLocalDevEnv()).toBe(true)
    process.env.NODE_ENV = 'staging'
    expect(isLocalDevEnv()).toBe(false)
    process.env.NODE_ENV = 'production'
    expect(isLocalDevEnv()).toBe(false)
  })

  test('isProductionEnv matches production only', () => {
    process.env.NODE_ENV = 'production'
    expect(isProductionEnv()).toBe(true)
    process.env.NODE_ENV = 'staging'
    expect(isProductionEnv()).toBe(false)
  })
})
