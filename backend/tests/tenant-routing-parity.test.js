const cases = require('../../shared/tenant-routing-cases.json')
const { resolveTenantFromHost } = require('../config/tenants')

describe('backend tenant routing parity cases', () => {
  test.each(cases)('$name', ({ hostname, fallback, expected }) => {
    expect(resolveTenantFromHost(hostname, fallback)).toBe(expected)
  })
})
