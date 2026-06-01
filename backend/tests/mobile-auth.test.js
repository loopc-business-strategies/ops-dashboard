const request = require('supertest')

describe('mobile login token', () => {
  test('isMobileClientRequest pattern documented', () => {
    const isMobile = (headers) => {
      const client = String(headers['x-client'] || headers['X-Client'] || '').trim().toLowerCase()
      return client === 'mobile' || client === 'mg-mobile'
    }
    expect(isMobile({ 'x-client': 'mobile' })).toBe(true)
    expect(isMobile({ 'X-Client': 'mg-mobile' })).toBe(true)
    expect(isMobile({})).toBe(false)
  })
})
