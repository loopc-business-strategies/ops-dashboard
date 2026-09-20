const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { XrfManager } = require('./XrfManager')

describe('XrfManager — no silent MG-XRF-001', () => {
  it('empty analyzers leaves connections empty (simulator mode)', () => {
    const mgr = new XrfManager({ gatewayId: 'GW-1', analyzers: [], mode: 'simulator' })
    assert.equal(mgr.connections.size, 0)
    assert.equal(mgr.getConnection('MG-XRF-001'), undefined)
    assert.deepEqual(mgr.getStatuses(), [])
  })

  it('missing analyzers arg leaves connections empty', () => {
    const mgr = new XrfManager({ gatewayId: 'GW-1', mode: 'simulator' })
    assert.equal(mgr.connections.size, 0)
  })

  it('skips configs without analyzerId', () => {
    const mgr = new XrfManager({
      gatewayId: 'GW-1',
      mode: 'simulator',
      analyzers: [{ enabled: true, model: 'x' }, { analyzerId: 'MG-XRF-LAB', enabled: true }],
    })
    assert.equal(mgr.connections.size, 1)
    assert.ok(mgr.getConnection('MG-XRF-LAB'))
    assert.equal(mgr.getConnection('MG-XRF-001'), undefined)
  })

  it('runTest requires analyzerId', async () => {
    const mgr = new XrfManager({ gatewayId: 'GW-1', analyzers: [], mode: 'simulator' })
    await assert.rejects(() => mgr.runTest(''), /analyzerId is required/)
  })
})
