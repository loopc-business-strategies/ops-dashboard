const { MIX_CODE_PREFIX, isAlloyMixBatchCode } = require('../services/erpAccounting/alloyMixBatchCode')

describe('alloy mix batch codes', () => {
  test('BMG-#### is the live prefix; legacy AMX still recognized', () => {
    expect(MIX_CODE_PREFIX).toBe('BMG-')
    expect(isAlloyMixBatchCode('BMG-0001')).toBe(true)
    expect(isAlloyMixBatchCode('bmg-0012')).toBe(true)
    expect(isAlloyMixBatchCode('AMX-261117-0005')).toBe(true)
    expect(isAlloyMixBatchCode('BATCH-1')).toBe(false)
    expect(isAlloyMixBatchCode('')).toBe(false)
  })
})
