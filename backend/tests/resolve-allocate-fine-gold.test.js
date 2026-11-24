const { resolveAllocateFineGold } = require('../services/erpAccounting/alloyMixFloorBridge')

describe('resolveAllocateFineGold', () => {
  const recipeInputs = [
    { name: 'Gold Bar', gross: 505.182 },
    { name: 'pure copper', gross: 46.328 },
  ]

  test('uses stored gold-only fineGold when present (extras bump)', () => {
    expect(resolveAllocateFineGold({
      targetGross: 556.51,
      purity: 91.67,
      fineGold: 505.5692,
      inputComponents: recipeInputs,
    }, 556.51, 556.51)).toBe(505.5692)
  })

  test('derives FG from input sum × purity when extras bumped target without stored FG', () => {
    // 551.51 × 91.67% = 505.569217 → 505.5692 at 4 dp
    expect(resolveAllocateFineGold({
      targetGross: 556.51,
      purity: 91.67,
      inputComponents: recipeInputs,
    }, 556.51, 556.51)).toBe(505.5692)
  })

  test('falls back to move × purity when inputs match target', () => {
    expect(resolveAllocateFineGold({
      targetGross: 100,
      purity: 75,
      inputComponents: [
        { name: 'Gold', gross: 75 },
        { name: 'Silver', gross: 25 },
      ],
    }, 100, 100)).toBe(75)
  })

  test('scales stored FG for partial allocate', () => {
    expect(resolveAllocateFineGold({
      targetGross: 556.51,
      purity: 91.67,
      fineGold: 505.5692,
      inputComponents: recipeInputs,
    }, 278.255, 556.51)).toBe(252.7846)
  })
})
