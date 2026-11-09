import { describe, expect, test } from 'vitest'
import {
  buildLineAccountComboGroups,
  buildVoucherPartyOptions,
  findVoucherPartyOptionByCode,
  resolvePreferredPartyDisplayName,
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

  test('vendor party options prefer ledger account code/name like MG COA', () => {
    const options = buildVoucherPartyOptions({
      activeCustomers: [],
      activeVendors: [{
        _id: 'vend-1',
        name: 'test supplier',
        vendorCode: 'VEN-0001',
        ledgerAccountId: {
          _id: 'acct-p',
          accountCode: '2301',
          accountName: 'Prestige (Creditor)',
          currency: 'USD',
        },
      }],
      partyChartAccounts: [],
    })
    expect(options).toEqual([expect.objectContaining({
      partyCode: '2301',
      partyName: 'Prestige (Creditor)',
      label: '2301 - Prestige (Creditor)',
      group: 'Vendors',
    })])
  })

  test('resolveVoucherPartyRecord prefers vendor ledger name over vendor-master nickname', () => {
    const vendors = [{
      _id: 'vend-1',
      name: 'test supplier',
      vendorCode: 'VEN-0001',
      ledgerAccountId: {
        _id: 'acct-p',
        accountCode: '2301',
        accountName: 'Prestige (Creditor)',
        currency: 'USD',
      },
    }]
    const resolved = resolveVoucherPartyRecord('2301', {
      activeVendors: vendors,
      voucherType: 'purchase',
    })
    expect(resolved.partyName).toBe('Prestige (Creditor)')
    expect(resolved.partyType).toBe('vendor')
    expect(resolvePreferredPartyDisplayName({
      partyCode: '2301',
      savedPartyName: 'test supplier',
      resolveVoucherParty: (code) => resolveVoucherPartyRecord(code, {
        activeVendors: vendors,
        voucherType: 'purchase',
      }),
    })).toBe('Prestige (Creditor)')
  })

  test('groups customers before party chart accounts and finds a party by code', () => {
    const options = buildVoucherPartyOptions({
      activeCustomers: [customer],
      activeVendors: [],
      partyChartAccounts: [{ _id: 'party', accountCode: '1306', accountName: 'NEW BUYER', accountType: 'Asset' }],
    })
    expect(options.map((item) => item.partyCode)).toEqual(['1319', '1306'])
    expect(toPartyComboGroups(options).map((group) => group.label)).toEqual(['Customers', 'Asset'])
    expect(findVoucherPartyOptionByCode(options, '1306').partyName).toBe('NEW BUYER')
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
