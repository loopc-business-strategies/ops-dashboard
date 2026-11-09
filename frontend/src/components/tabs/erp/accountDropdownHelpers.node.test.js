import { describe, expect, test } from 'vitest'
import {
  buildEntryAccountOptions,
  excludeLedgerAccountsRepresentedByParties,
  filterActiveAccounts,
  filterActiveCustomers,
  filterActiveVendors,
  filterPartyAccounts,
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
      { _id: 'c4', isActive: true, ledgerAccountId: null },
      { _id: 'c5', isActive: true, ledgerAccountId: { _id: 'a5', accountCode: '69f9a1ef682467dc3f029e42', isActive: true } },
    ]
    expect(filterActiveCustomers(rows).map((row) => row._id)).toEqual(['c1'])
  })

  test('filterActiveVendors rejects deleted or inactive vendors', () => {
    const rows = [
      { _id: 'v1', isActive: true, vendorCode: 'VEN-0001', ledgerAccountId: { _id: 'a1', accountCode: '2100', isActive: true } },
      { _id: 'v2', isActive: true, deletedAt: '2026-01-01' },
      { _id: 'v3', isActive: false },
      { _id: 'v4', isActive: true, vendorCode: 'VEN-0002', ledgerAccountId: null },
    ]
    expect(filterActiveVendors(rows).map((row) => row._id)).toEqual(['v1', 'v4'])
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

  test('filterPartyAccounts rejects mongo-id account codes', () => {
    const rows = [
      { _id: 'a1', accountCode: '1303', accountName: 'Trade Party', accountType: 'Asset', isActive: true },
      { _id: 'a2', accountCode: '69f9a1ef682467dc3f029e42', accountName: 'Bad', accountType: 'Asset', isActive: true },
      { _id: 'a3', accountCode: '2000', accountName: 'AP', accountType: 'Liability', isActive: false },
    ]
    expect(filterPartyAccounts(rows).map((row) => row._id)).toEqual(['a1'])
  })

  test('filterPartyAccounts keeps party ledgers and drops cash/stock/P&L', () => {
    const rows = [
      { _id: 'party', accountCode: '1306', accountName: 'NEW BUYER', accountType: 'Asset', isActive: true },
      { _id: 'debtor', accountCode: '1310', accountName: 'Acme (Debtor)', accountType: 'Asset', isActive: true },
      { _id: 'cash', accountCode: '1000', accountName: 'Cash on Hand', accountType: 'Asset', isActive: true },
      { _id: 'stock', accountCode: '1200', accountName: 'Stock in Hand', accountType: 'Asset', isActive: true },
      { _id: 'sales', accountCode: '4000', accountName: 'Sales Revenue', accountType: 'Income', isActive: true },
      { _id: 'ar', accountCode: '1100', accountName: 'Accounts Receivable', accountType: 'Asset', isActive: true },
    ]
    expect(filterPartyAccounts(rows).map((row) => row._id)).toEqual(['party', 'debtor'])
  })
})
