const {
  planMetalOutMixShrink,
  buildUpdatedMixRemainLines,
} = require('../services/erpAccounting/alloyMixFloorBridge')

describe('planMetalOutMixShrink / buildUpdatedMixRemainLines', () => {
  const recipeSum = 551.51
  const bumped = 556.51
  const priorFg = 505.5692

  test('no shrink when Out ≥ bumped target', () => {
    expect(planMetalOutMixShrink({
      priorTarget: bumped,
      nextTarget: bumped,
      inputGrossSum: recipeSum,
      priorFineGold: priorFg,
      purityPct: 91.67,
    }).action).toBe('none')
  })

  test('extras-only shrink when Out still covers Post Mix recipe', () => {
    const plan = planMetalOutMixShrink({
      priorTarget: bumped,
      nextTarget: 554,
      inputGrossSum: recipeSum,
      priorFineGold: priorFg,
      purityPct: 91.67,
    })
    expect(plan).toMatchObject({
      action: 'shrink_extras_only',
      scaleBase: recipeSum,
      nextTarget: 554,
      fineGold: priorFg,
    })
  })

  test('update_mix scales against recipe (not bumped target) when Out < recipe', () => {
    const plan = planMetalOutMixShrink({
      priorTarget: bumped,
      nextTarget: 550,
      inputGrossSum: recipeSum,
      priorFineGold: priorFg,
      purityPct: 91.67,
    })
    expect(plan.action).toBe('update_mix')
    expect(plan.scaleBase).toBe(recipeSum)
    expect(plan.nextTarget).toBe(550)
    // 505.5692 * (550 / 551.51) ≈ 504.1849
    expect(plan.fineGold).toBeCloseTo(504.1849, 3)
  })

  test('normal loss without extras still scales against prior target', () => {
    const plan = planMetalOutMixShrink({
      priorTarget: 100,
      nextTarget: 99.3,
      inputGrossSum: 100,
      priorFineGold: 75,
      purityPct: 75,
    })
    expect(plan).toMatchObject({
      action: 'update_mix',
      scaleBase: 100,
      nextTarget: 99.3,
    })
    expect(plan.fineGold).toBeCloseTo(74.475, 3)
  })

  test('buildUpdatedMixRemainLines does not dump extras gap onto last metal', () => {
    const lines = buildUpdatedMixRemainLines([
      { itemId: 'g', gross: 505.182, consumeGross: 505.182, role: 'gold', label: 'gold' },
      { itemId: 'c', gross: 46.328, consumeGross: 46.328, role: 'extra', label: 'copper' },
    ], { nextTarget: 550, scaleBase: 551.51 })

    expect(lines).toHaveLength(2)
    const gold = lines[0]
    const copper = lines[1]
    expect(gold.remainGross + copper.remainGross).toBeCloseTo(550, 3)
    // Copper must shrink (not gain) vs prior 46.328
    expect(copper.remainGross).toBeLessThan(46.328)
    expect(copper.remainGross).toBeCloseTo(46.201, 2)
    expect(gold.lossGross).toBeGreaterThan(0)
    expect(copper.lossGross).toBeGreaterThanOrEqual(0)
  })

  test('old buggy scale against bumped target would inflate last line (guard)', () => {
    const buggy = buildUpdatedMixRemainLines([
      { itemId: 'g', gross: 505.182, role: 'gold' },
      { itemId: 'c', gross: 46.328, role: 'extra' },
    ], { nextTarget: 550, scaleBase: 556.51 })
    // Demonstrates the failure mode we avoid: copper remain > prior.
    expect(buggy[1].remainGross).toBeGreaterThan(46.328)
  })
})
