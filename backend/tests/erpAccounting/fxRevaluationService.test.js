const { createFxRevaluationService } = require('../../services/erpAccounting/fxRevaluationService')

describe('fxRevaluationService.resolveVoucherFxMetrics', () => {
  const svc = createFxRevaluationService({
    parseNumber: Number,
    toMoney: (n) => Math.round(n * 100) / 100,
    Ledger: {},
    FX_REVALUATION_EPSILON: 0.01,
    appendTransactionAudit: () => {},
    Currency: {},
    BASE_CURRENCY_CODE: 'USD',
  })

  test('single line item calculates line-level FX metrics', () => {
    const voucherMeta = {
      lineItems: [{ currCode: 'AED', currRate: 3.674, amountFC: 100 }],
    }
    const result = svc.resolveVoucherFxMetrics({
      voucherMeta,
      txAmount: 367.4,
      referenceRate: 3.5,
    })

    expect(result.actualForeignAmount).toBe(100)
    expect(result.totalBaseAmount).toBeCloseTo(367.4, 5)
    expect(result.expectedForeignAmount).toBeCloseTo(367.4 / 3.5, 5)
    expect(result.fcDifference).toBeCloseTo(100 - 367.4 / 3.5, 5)
  })

  test('multi-line same currency sums line-level actual and expected FC', () => {
    const voucherMeta = {
      lineItems: [
        { currCode: 'AED', currRate: 3.674, amountFC: 100 },
        { currCode: 'AED', currRate: 3.674, amountFC: 50 },
        { currCode: 'AED', currRate: 3.674, amountFC: 25 },
      ],
    }
    const result = svc.resolveVoucherFxMetrics({
      voucherMeta,
      txAmount: 367.4,
      referenceRate: 3.5,
    })

    expect(result.actualForeignAmount).toBe(175)
    expect(result.totalBaseAmount).toBeCloseTo(175 * 3.674, 5)
    expect(result.expectedForeignAmount).toBeCloseTo((175 * 3.674) / 3.5, 5)
  })

  test('mixed currency lines are calculated line-by-line then summed', () => {
    const voucherMeta = {
      lineItems: [
        { currCode: 'USD', currRate: 1.0, amountFC: 100 },
        { currCode: 'AED', currRate: 3.674, amountFC: 100 },
      ],
    }
    const result = svc.resolveVoucherFxMetrics({
      voucherMeta,
      txAmount: 100,
      referenceRate: 3.5,
    })

    expect(result.actualForeignAmount).toBe(200)
    expect(result.totalBaseAmount).toBeCloseTo(100 + 367.4, 5)
    const expectedUsdLine = 100 / 3.5
    const expectedAedLine = 367.4 / 3.5
    expect(result.expectedForeignAmount).toBeCloseTo(expectedUsdLine + expectedAedLine, 5)
  })
})
