import { describe, expect, test } from 'vitest'
import {
  buildLineAccountComboGroups,
  buildVoucherPartyOptions,
  findVoucherPartyOptionByCode,
  resolveVoucherPartyRecord,
  toPartyComboGroups,
} from './voucherPartyOptions'

const customer = {
  _id: 'cust-1',
  name: 'Test Buyer',
  email: 'buyer@example.com',
  ledgerAccountId: { _id: 'acct-c', accountCode: '1319', currency: 'uzs' },
}
const vendor = {
  _id: 'vend-1',
  name: 'Test Supplier',
  vendorCode: '1319',
  ledgerAccountId: { _id: 'acct-v', accountCode: '1319', currency: 'USD' },
}

describe('voucherPartyOptions', () => {
  test('prefers the customer on a sale when the code matches both parties', () => {
    const resolved = resolveVoucherPartyRecord('1319', {
      activeCustomers: [customer],
      activeVendors: [vendor],
      voucherType: 'sale',
    })
    expect(resolved.partyType).toBe('customer')
    expect(resolved.accountCurrency).toBe('UZS')
    expect(resolved.partyId).toBe('customer:cust-1')
  })

  test('prefers the vendor on a purchase when the code matches both parties', () => {
    const resolved = resolveVoucherPartyRecord('1319', {
      activeCustomers: [customer],
      activeVendors: [vendor],
      voucherType: 'purchase',
    })
    expect(resolved.partyType).toBe('vendor')
    expect(resolved.partyCode).toBe('1319')
  })

  test('groups customers before chart accounts and finds a party by code', () => {
    const options = buildVoucherPartyOptions({
      activeCustomers: [customer],
      activeVendors: [],
      partyChartAccounts: [{ _id: 'cash', accountCode: '1000', accountName: 'Cash on Hand', accountType: 'Asset' }],
    })
    expect(options.map((item) => item.partyCode)).toEqual(['1319', '1000'])
    expect(toPartyComboGroups(options).map((group) => group.label)).toEqual(['Customers', 'Asset'])
    expect(findVoucherPartyOptionByCode(options, '1000').partyName).toBe('Cash on Hand')
  })

  test('groups line accounts in chart order', () => {
    const groups = buildLineAccountComboGroups([
      { accountCode: '5190', accountName: 'Exchange Loss', accountType: 'Expense' },
      { accountCode: '1000', accountName: 'Cash on Hand', accountType: 'Asset' },
    ])
    expect(groups.map((group) => group.label)).toEqual(['Asset', 'Expense'])
    expect(groups[0].options[0]).toEqual({ value: '1000', label: '1000 - Cash on Hand' })
  })
})
