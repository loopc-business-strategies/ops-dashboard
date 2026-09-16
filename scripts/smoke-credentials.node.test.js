const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  listTenantSmokeCredentialCandidates,
  getTenantSmokeCredentials,
} = require('./smoke-credentials')

describe('smoke credential candidates', () => {
  it('prefers dedicated then shared for mg', () => {
    const env = {
      SMOKE_AUTH_NAME: 'shared-user',
      SMOKE_AUTH_PASSWORD: 'shared-pass',
      SMOKE_AUTH_NAME_MG: 'mg-user',
      SMOKE_AUTH_PASSWORD_MG: 'mg-pass',
    }
    const candidates = listTenantSmokeCredentialCandidates('mg', env)
    assert.equal(candidates.length, 2)
    assert.equal(candidates[0].source, 'dedicated SMOKE_AUTH_*_MG')
    assert.equal(candidates[0].name, 'mg-user')
    assert.equal(candidates[1].source, 'shared SMOKE_AUTH_*')
    assert.deepEqual(getTenantSmokeCredentials('mg', env), {
      name: 'mg-user',
      password: 'mg-pass',
    })
  })

  it('uses shared only when dedicated missing', () => {
    const env = {
      SMOKE_AUTH_NAME: 'shared-user',
      SMOKE_AUTH_PASSWORD: 'shared-pass',
    }
    const candidates = listTenantSmokeCredentialCandidates('cg', env)
    assert.equal(candidates.length, 1)
    assert.equal(candidates[0].source, 'shared SMOKE_AUTH_*')
  })

  it('does not fall back to shared for vb', () => {
    const env = {
      SMOKE_AUTH_NAME: 'shared-user',
      SMOKE_AUTH_PASSWORD: 'shared-pass',
      SMOKE_AUTH_NAME_VB: 'vb-user',
      SMOKE_AUTH_PASSWORD_VB: 'vb-pass',
    }
    const withDedicated = listTenantSmokeCredentialCandidates('vb', env)
    assert.equal(withDedicated.length, 1)
    assert.equal(withDedicated[0].source, 'dedicated SMOKE_AUTH_*_VB')

    const sharedOnly = listTenantSmokeCredentialCandidates('vb', {
      SMOKE_AUTH_NAME: 'shared-user',
      SMOKE_AUTH_PASSWORD: 'shared-pass',
    })
    assert.equal(sharedOnly.length, 0)
    assert.equal(getTenantSmokeCredentials('vb', {
      SMOKE_AUTH_NAME: 'shared-user',
      SMOKE_AUTH_PASSWORD: 'shared-pass',
    }), null)
  })

  it('dedupes when dedicated matches shared', () => {
    const env = {
      SMOKE_AUTH_NAME: 'same',
      SMOKE_AUTH_PASSWORD: 'same-pass',
      SMOKE_AUTH_NAME_LOOPC: 'same',
      SMOKE_AUTH_PASSWORD_LOOPC: 'same-pass',
    }
    const candidates = listTenantSmokeCredentialCandidates('loopc', env)
    assert.equal(candidates.length, 1)
    assert.equal(candidates[0].source, 'dedicated SMOKE_AUTH_*_LOOPC')
  })
})
