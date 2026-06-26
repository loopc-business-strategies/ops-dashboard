import { describe, expect, test } from 'vitest'
import type { AccountListItem } from '@/src/api/erpReports'
import { groupAccountsByType } from '@/src/utils/accountListGroups'

function account(
  overrides: Partial<AccountListItem> & { _id: string },
): AccountListItem {
  return {
    accountCode: overrides.accountCode || overrides._id,
    accountName: overrides.accountName || overrides._id,
    ...overrides,
  }
}

describe('accountListGroups', () => {
  test('groupAccountsByType orders sections and sorts within section', () => {
    const accounts = [
      account({ _id: '1', accountCode: '2000', accountName: 'Payables', accountType: 'Liability' }),
      account({ _id: '2', accountCode: '1010', accountName: 'Main Bank', accountType: 'Asset' }),
      account({ _id: '3', accountCode: '1000', accountName: 'Cash', accountType: 'Asset' }),
      account({ _id: '4', accountCode: '9999', accountName: 'Misc', accountType: '' }),
    ]

    const sections = groupAccountsByType(accounts)
    expect(sections.map((s) => s.title)).toEqual(['Asset', 'Liability', 'Other'])
    expect(sections[0].data.map((a) => a.accountCode)).toEqual(['1000', '1010'])
  })

  test('groupAccountsByType filters by search query', () => {
    const accounts = [
      account({ _id: '1', accountCode: '1010', accountName: 'Main Bank', accountType: 'Asset' }),
      account({ _id: '2', accountCode: '2000', accountName: 'Payables', accountType: 'Liability' }),
    ]

    const sections = groupAccountsByType(accounts, 'bank')
    expect(sections).toHaveLength(1)
    expect(sections[0].title).toBe('Asset')
    expect(sections[0].data).toHaveLength(1)
    expect(sections[0].data[0].accountCode).toBe('1010')
  })
})
