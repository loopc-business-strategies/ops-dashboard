const { describe, expect, test } = require('@jest/globals')
const { buildLedgerListSearchOr } = require('../utils/ledgerListSearch')

describe('buildLedgerListSearchOr', () => {
  test('returns null for blank search', () => {
    expect(buildLedgerListSearchOr('')).toBeNull()
    expect(buildLedgerListSearchOr('   ')).toBeNull()
  })

  test('matches description, notes, autoTxNo, chequeNo, and account ids', () => {
    const clauses = buildLedgerListSearchOr('Bank', [{ _id: 'acc1' }, { _id: 'acc2' }])
    expect(clauses).toHaveLength(6)
    expect(clauses[0]).toHaveProperty('description')
    expect(clauses[1]).toHaveProperty('notes')
    expect(clauses[2]).toHaveProperty('autoTxNo')
    expect(clauses[3]).toHaveProperty('chequeNo')
    expect(clauses[4]).toEqual({ debitAccountId: { $in: ['acc1', 'acc2'] } })
    expect(clauses[5]).toEqual({ creditAccountId: { $in: ['acc1', 'acc2'] } })
    expect(clauses[0].description.test('Bank USD')).toBe(true)
    expect(clauses[0].description.test('Cash')).toBe(false)
  })
})
