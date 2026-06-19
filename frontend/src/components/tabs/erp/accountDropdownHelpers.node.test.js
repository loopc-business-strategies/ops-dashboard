import { describe, expect, test } from 'vitest'
import {
  buildEntryAccountOptions,
  excludeLedgerAccountsRepresentedByParties,
  filterActiveAccounts,
  filterActiveCustomers,
  filterActiveVendors,
} from './accountDropdownHelpers'

describe('accountDropdownHelpers', () => {
  test('filterActiveAccounts removes inactive and dedupes by id', () => {
    const rows = [
      { _id: '1', accountCode: '1000', isActive: true },
      { _id: '1', accountCode: '1000', isActive: true },
      { _id: '2', accountCode: '2000', isActive: false },
    ]
    expect(filterActiveAccounts(rows)).toEqual([{ _id: '1', accountCode: '1000', isActive: true }])
  })

  test('filterActiveCustomers rejects inactive customer or inactive ledger', () => {
    const rows = [
      { _id: 'c1', isActive: true, ledgerAccountId: { _id: 'a1', accountCode: '3000', isActive: true } },
      { _id: 'c2', isActive: false, ledgerAccountId: { _id: 'a2', accountCode: '3001', isActive: true } },
      { _id: 'c3', isActive: true, ledgerAccountId: { _id: 'a3', accountCode: '3002', isActive: false } },
    ]
    expect(filterActiveCustomers(rows).map((row) => row._id)).toEqual(['c1'])
  })

  test('filterActiveVendors rejects deleted or inactive vendors', () => {
    const rows = [
      { _id: 'v1', isActive: true, ledgerAccountId: { _id: 'a1', isActive: true } },
      { _id: 'v2', isActive: true, deletedAt: '2026-01-01' },
      { _id: 'v3', isActive: false },
    ]
    expect(filterActiveVendors(rows).map((row) => row._id)).toEqual(['v1'])
  })

  test('buildEntryAccountOptions merges active party ledgers without duplicates', () => {
    const options = buildEntryAccountOptions({
      accounts: [{ _id: 'a1', accountCode: '1000', isActive: true }],
      customers: [{ _id: 'c1', isActive: true, ledgerAccountId: { _id: 'a1', accountCode: '1000', isActive: true } }],
      vendors: [{ _id: 'v1', isActive: true, ledgerAccountId: { _id: 'a2', accountCode: '2000', isActive: true } }],
    })
    expect(options.map((row) => row._id).sort()).toEqual(['a1', 'a2'])
  })

  test('excludeLedgerAccountsRepresentedByParties drops chart rows already shown as parties', () => {
    const accounts = [
      { _id: 'a1', accountCode: '3000', isActive: true },
      { _id: 'a2', accountCode: '4000', isActive: true },
    ]
    const customers = [{ _id: 'c1', isActive: true, ledgerAccountId: { _id: 'a1', accountCode: '3000', isActive: true } }]
    expect(excludeLedgerAccountsRepresentedByParties(accounts, customers, []).map((row) => row._id)).toEqual(['a2'])
  })
})
