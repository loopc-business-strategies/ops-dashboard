const {
  getTransactionWorkflowErrorStatus,
} = require('../utils/transactionWorkflowHelpers')

describe('getTransactionWorkflowErrorStatus', () => {
  test('maps Insufficient vault stock to 400 so clients see the real message', () => {
    expect(
      getTransactionWorkflowErrorStatus('Insufficient vault stock. Available: 91.7 g, requested: 100 g.'),
    ).toBe(400)
  })

  test('keeps unmapped errors as 500', () => {
    expect(getTransactionWorkflowErrorStatus('Unexpected database failure')).toBe(500)
  })
})
