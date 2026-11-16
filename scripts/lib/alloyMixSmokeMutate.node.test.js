const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  isProductionAlloyMixApiBase,
  isStagingAlloyMixMutateContext,
  pickVaultMixForRoundTrip,
} = require('./alloyMixSmokeMutate.cjs')

describe('alloyMixSmokeMutate guards', () => {
  it('refuses production API base', () => {
    assert.equal(isProductionAlloyMixApiBase('https://api.loopcstrategies.com'), true)
    assert.equal(isProductionAlloyMixApiBase('https://api.loopcstrategies.com/'), true)
    assert.equal(
      isProductionAlloyMixApiBase('https://ops-dashboard-staging-e6c6.up.railway.app'),
      false,
    )
  })

  it('mutate requires flag + staging-ish target', () => {
    assert.equal(isStagingAlloyMixMutateContext({
      mutate: true,
      envLabel: 'Staging',
      apiBase: 'https://ops-dashboard-staging-e6c6.up.railway.app',
    }), true)

    assert.equal(isStagingAlloyMixMutateContext({
      mutate: false,
      envLabel: 'Staging',
      apiBase: 'https://ops-dashboard-staging-e6c6.up.railway.app',
    }), false)

    assert.equal(isStagingAlloyMixMutateContext({
      mutate: true,
      envLabel: 'Production',
      apiBase: 'https://api.loopcstrategies.com',
    }), false)
  })

  it('picks a vault job without open floor descendants', () => {
    const picked = pickVaultMixForRoundTrip([
      { id: 'a', currentDepartment: 'vault_room', hasOpenFloorDescendants: true, targetGross: 10 },
      { id: 'b', currentDepartment: 'melting', targetGross: 10 },
      { id: 'c', currentDepartment: 'vault_room', targetGross: 25 },
    ])
    assert.equal(picked.id, 'c')
    assert.equal(pickVaultMixForRoundTrip([]), null)
  })
})
