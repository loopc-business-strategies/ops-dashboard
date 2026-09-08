const { fingerprintMongoUri, findTenantUriCollisions } = require('../utils/mongoUriFingerprint')

describe('mongoUriFingerprint', () => {
  test('redacts credentials to host/database', () => {
    expect(fingerprintMongoUri('mongodb+srv://user:secret@cluster0.fiotefu.mongodb.net/ops-dashboard'))
      .toBe('cluster0.fiotefu.mongodb.net/ops-dashboard')
  })

  test('detects MG/VB sharing the same host and database', () => {
    const errors = findTenantUriCollisions([
      { tenant: 'mg', uri: 'mongodb://h/ops-dashboard' },
      { tenant: 'vb', uri: 'mongodb://h/ops-dashboard' },
    ])
    expect(errors.join(' ')).toMatch(/mg and vb/)
  })

  test('allows same host with different database names', () => {
    const errors = findTenantUriCollisions([
      { tenant: 'mg', uri: 'mongodb://h/ops-dashboard' },
      { tenant: 'vb', uri: 'mongodb://h/ops-dashboard-vb' },
    ])
    expect(errors).toEqual([])
  })
})
