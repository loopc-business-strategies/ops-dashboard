const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { parseWeightFrame } = require('../scales/WeightParser')
const { StabilityDetector } = require('../scales/StabilityDetector')

describe('WeightParser', () => {
  it('parses ST frame', () => {
    const r = parseWeightFrame('ST,GS,+  125.36 g')
    assert.equal(r.weight, 125.36)
    assert.equal(r.stableHint, true)
    assert.equal(r.unit, 'g')
  })

  it('parses unstable frame', () => {
    const r = parseWeightFrame('US,GS,+10.00 g')
    assert.equal(r.stableHint, false)
  })

  it('flags malformed', () => {
    const r = parseWeightFrame('??BAD##')
    assert.equal(r.parseError, true)
  })
})

describe('StabilityDetector', () => {
  it('requires sustained stability', () => {
    const d = new StabilityDetector({ toleranceGrams: 0.05, durationMs: 500 })
    assert.equal(d.update(10, 0).stable, false)
    assert.equal(d.update(10.01, 200).stable, false)
    assert.equal(d.update(10.02, 600).stable, true)
    assert.equal(d.update(11, 700).stable, false)
  })
})
