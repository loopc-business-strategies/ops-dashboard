import { describe, expect, test } from 'vitest'
import { vaultMetalProductOptions } from './vaultAddMetal'

describe('vaultMetalProductOptions purity', () => {
  test('keeps Post Mix style fraction (not percent)', () => {
    const opts = vaultMetalProductOptions([
      {
        _id: 'cd1',
        name: 'cadmium',
        category: 'mainStock=cadmium;recordType=product;productPurity=1',
      },
      {
        _id: 'au1',
        name: 'Gold Bar',
        category: 'mainStock=gold;recordType=product;productPurity=0.999',
      },
      {
        _id: 'legacy',
        name: 'legacy copper',
        category: 'mainStock=copper;recordType=product;productPurity=99.9',
      },
    ])
    expect(opts.find((r) => r.name === 'cadmium')?.purity).toBe('1')
    expect(opts.find((r) => r.name === 'Gold Bar')?.purity).toBe('0.999')
    expect(opts.find((r) => r.name === 'legacy copper')?.purity).toBe('0.999')
  })
})
