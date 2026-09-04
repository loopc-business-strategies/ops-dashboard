import { exchangeRateFromUnitsPerBase } from './erpCurrencyRowHelpers'

export function createEmptyCustomerForm(baseCurrencyCode = 'USD') {
  const base = String(baseCurrencyCode || 'USD').trim().toUpperCase() || 'USD'
  return {
    name: '',
    phone: '',
    email: '',
    address: '',
    gstVat: '',
    openingBalance: '',
    creditLimit: '',
    paymentTermsDays: '',
    currency: base,
    notes: '',
  }
}

/** @deprecated Prefer createEmptyCustomerForm(baseCurrencyCode) */
export const EMPTY_CUSTOMER_FORM = createEmptyCustomerForm('USD')

export const EMPTY_CURRENCY_FORM = {
  code: '',
  name: '',
  symbol: '',
  exchangeRate: 1,
  baseCurrency: false,
  oneUsdEquals: '',
}

export const EMPTY_MAPPING_FORM = {
  mappingType: '',
  debitAccountId: '',
  creditAccountId: '',
  department: '',
  description: '',
}

export function buildReferenceEditFormState(type, record, baseCurrencyCode = 'USD') {
  const base = String(baseCurrencyCode || 'USD').trim().toUpperCase() || 'USD'
  if (type === 'account') {
    return {
      accountName: record.accountName || '',
      description: record.description || '',
      currency: record.currency || base,
      department: record.department || '',
    }
  }
  if (type === 'mapping') {
    return {
      mappingType: record.mappingType || '',
      debitAccountId: record.debitAccountId?._id || '',
      creditAccountId: record.creditAccountId?._id || '',
      department: record.department || '',
      description: record.description || '',
    }
  }
  if (type === 'currency') {
    const r = Number(record.exchangeRate || 0)
    const unitsPerUsd = !record.baseCurrency && Number.isFinite(r) && r > 0 ? 1 / r : ''
    return {
      code: record.code || '',
      name: record.name || '',
      symbol: record.symbol || '',
      exchangeRate: record.exchangeRate || 1,
      baseCurrency: Boolean(record.baseCurrency),
      oneUsdEquals: unitsPerUsd === '' ? '' : String(unitsPerUsd),
    }
  }
  if (type === 'customer') {
    return {
      name: record.name || '',
      phone: record.phone || '',
      email: record.email || '',
      address: record.address || '',
      gstVat: record.gstVat || '',
      creditLimit: record.creditLimit || 0,
      paymentTermsDays: record.paymentTermsDays || 0,
      currency: record.currency || base,
      notes: record.notes || '',
    }
  }
  return {}
}

export function resolveCurrencyExchangeRate(form, _erpBaseCurrencyCode) {
  let exchangeRate = Number(form.exchangeRate || 1)
  const fromQuote = exchangeRateFromUnitsPerBase(form.oneUsdEquals)
  if (!form.baseCurrency && fromQuote !== null) exchangeRate = fromQuote
  if (form.baseCurrency) exchangeRate = 1
  return { exchangeRate, fromQuote }
}

export function validateCurrencyExchangeRate(form, exchangeRate, _erpBaseCurrencyCode) {
  if (form.baseCurrency) return true
  if (Number.isFinite(exchangeRate) && exchangeRate > 0) return true
  return false
}

export function currencyFormPayload(form) {
  const { oneUsdEquals: _omitQuote, ...currencyBody } = form
  return currencyBody
}
