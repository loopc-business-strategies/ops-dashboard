import { ACCOUNT_TYPES } from '../../../constants/accountTypes'
import {
  formatPartyAddress,
  getAccountCodeValue,
  normalizeLookupValue,
} from './voucherTabShared'

function chartAddressForCode(chartAccounts, code) {
  const lookup = normalizeLookupValue(code)
  if (!lookup) return ''
  const account = (chartAccounts || []).find((item) => normalizeLookupValue(getAccountCodeValue(item)) === lookup)
  return String(account?.address || '').trim()
}

export function resolveVoucherPartyRecord(partyCode, {
  activeVendors = [],
  activeCustomers = [],
  chartAccounts = [],
  voucherType = '',
} = {}) {
  const lookupValue = normalizeLookupValue(partyCode)
  if (!lookupValue) return null

  const vendorMatch = activeVendors.find((item) => {
    const ledgerCode = normalizeLookupValue(item.ledgerAccountId?.accountCode)
    return lookupValue === normalizeLookupValue(item._id)
      || lookupValue === normalizeLookupValue(item.vendorCode)
      || lookupValue === ledgerCode
  })

  const customerMatch = activeCustomers.find((item) => {
    const ledgerCode = normalizeLookupValue(item.ledgerAccountId?.accountCode)
    return lookupValue === normalizeLookupValue(item._id) || lookupValue === ledgerCode
  })

  const toVendor = (vendor) => ({
    customerId: '',
    vendorId: vendor._id,
    partyName: vendor.name || '',
    partyCode: vendor.vendorCode || vendor.ledgerAccountId?.accountCode || String(vendor._id),
    partyId: `vendor:${String(vendor._id)}`,
    partyType: 'vendor',
    accountCurrency: String(vendor.ledgerAccountId?.currency || vendor.currency || '').trim().toUpperCase(),
    email: vendor.email || '',
    phone: vendor.phone || '',
    address: formatPartyAddress(vendor.address, vendor.city, vendor.country, vendor.postalCode, chartAddressForCode(chartAccounts, vendor.ledgerAccountId?.accountCode || vendor.vendorCode)),
  })

  const toCustomer = (customer) => ({
    customerId: customer._id,
    vendorId: '',
    partyName: customer.name || '',
    partyCode: customer.ledgerAccountId?.accountCode || String(customer._id),
    partyId: `customer:${String(customer._id)}`,
    partyType: 'customer',
    accountCurrency: String(customer.ledgerAccountId?.currency || customer.currency || '').trim().toUpperCase(),
    email: customer.email || '',
    phone: customer.phone || '',
    address: formatPartyAddress(customer.address, chartAddressForCode(chartAccounts, customer.ledgerAccountId?.accountCode)),
  })

  // Sale/receipt: prefer customer (counterparty is usually buyer). Purchase/payment: prefer vendor (supplier).
  const preferCustomerFirst = voucherType === 'sale' || voucherType === 'receipt' || voucherType === 'metal_payment'
  if (preferCustomerFirst) {
    if (customerMatch) return toCustomer(customerMatch)
    if (vendorMatch) return toVendor(vendorMatch)
  } else {
    if (vendorMatch) return toVendor(vendorMatch)
    if (customerMatch) return toCustomer(customerMatch)
  }
  return null
}

export function buildVoucherPartyOptions({
  activeCustomers = [],
  activeVendors = [],
  partyChartAccounts = [],
} = {}) {
  const PARTY_TYPE_ORDER = ['Asset', 'Liability', 'Equity', 'Income', 'Expense']
  const chartPartyOptions = partyChartAccounts
    .map((account) => {
      const code = getAccountCodeValue(account)
      const name = String(account?.accountName || account?.name || '').trim()
      return {
        id: `account:${String(account?._id || code)}`,
        accountId: String(account?._id || code),
        label: `${code}${name ? ` - ${name}` : ''}`,
        partyCode: code,
        partyName: name,
        accountType: String(account?.accountType || 'Other').trim() || 'Other',
        group: String(account?.accountType || 'Other').trim() || 'Other',
      }
    })
    .filter((item) => Boolean(item.partyCode))
    .sort((a, b) => {
      const ai = PARTY_TYPE_ORDER.indexOf(a.accountType)
      const bi = PARTY_TYPE_ORDER.indexOf(b.accountType)
      const tc = (ai === -1 ? PARTY_TYPE_ORDER.length : ai) - (bi === -1 ? PARTY_TYPE_ORDER.length : bi)
      if (tc !== 0) return tc
      return String(a.partyCode).localeCompare(String(b.partyCode))
    })

  const customerPartyOptions = activeCustomers
    .map((customer) => {
      const code = String(customer?.ledgerAccountId?.accountCode || '').trim()
      const name = String(customer?.name || '').trim()
      if (!code) return null
      return {
        id: `customer:${String(customer._id)}`,
        accountId: String(customer?.ledgerAccountId?._id || customer._id),
        label: `${code}${name ? ` - ${name}` : ''}`,
        partyCode: code,
        partyName: name,
        accountType: 'Customers',
        group: 'Customers',
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(a.partyCode).localeCompare(String(b.partyCode)))

  const vendorPartyOptions = activeVendors
    .map((vendor) => {
      const code = String(vendor?.vendorCode || vendor?.ledgerAccountId?.accountCode || '').trim()
      const name = String(vendor?.name || '').trim()
      if (!code) return null
      return {
        id: `vendor:${String(vendor._id)}`,
        accountId: String(vendor?.ledgerAccountId?._id || vendor._id),
        label: `${code}${name ? ` - ${name}` : ''}`,
        partyCode: code,
        partyName: name,
        accountType: 'Vendors',
        group: 'Vendors',
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(a.partyCode).localeCompare(String(b.partyCode)))

  return [...customerPartyOptions, ...vendorPartyOptions, ...chartPartyOptions]
}

export function toPartyComboGroups(partyOptions = []) {
  const grouped = partyOptions.reduce((groups, item) => {
    const type = item.group || item.accountType
    const existing = groups.find((g) => g.type === type)
    if (existing) existing.items.push(item)
    else groups.push({ type, items: [item] })
    return groups
  }, [])
  return grouped.map((g) => ({
    label: g.type,
    options: g.items.map((item) => ({ value: item.id, label: item.label })),
  }))
}

export function findVoucherPartyOptionByCode(partyOptions = [], code) {
  const lookupValue = normalizeLookupValue(code)
  if (!lookupValue) return null
  return partyOptions.find((item) => (
    lookupValue === normalizeLookupValue(item.partyCode)
    || lookupValue === normalizeLookupValue(item.partyName)
  )) || null
}

export function buildLineAccountComboGroups(activeAccounts = []) {
  const accountList = activeAccounts
    .map((a) => ({
      code: getAccountCodeValue(a),
      name: String(a?.accountName || a?.name || '').trim(),
      accountType: String(a?.accountType || 'Other').trim(),
    }))
    .filter((a) => a.code)
    .sort((a, b) => {
      const ai = ACCOUNT_TYPES.indexOf(a.accountType)
      const bi = ACCOUNT_TYPES.indexOf(b.accountType)
      const tc = (ai === -1 ? ACCOUNT_TYPES.length : ai) - (bi === -1 ? ACCOUNT_TYPES.length : bi)
      if (tc !== 0) return tc
      return a.code.localeCompare(b.code)
    })
  const groupMap = {}
  accountList.forEach((item) => {
    if (!groupMap[item.accountType]) groupMap[item.accountType] = []
    groupMap[item.accountType].push({ value: item.code, label: `${item.code}${item.name ? ` - ${item.name}` : ''}` })
  })
  return ACCOUNT_TYPES
    .filter((type) => groupMap[type])
    .map((type) => ({ label: type, options: groupMap[type] }))
}
