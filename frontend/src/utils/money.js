/**
 * ESM adapter for frontend — shared/money.js is CommonJS.
 * Import from here in React code.
 */
import money from '../../../shared/money.js'

const api = money?.default || money

export const toMoney = api.toMoney
export const parseNumber = api.parseNumber
export const parseAmount = api.parseAmount
export const formatAmount = api.formatAmount
export const formatCurrency = api.formatCurrency
export const getCurrencyDisplayPrecision = api.getCurrencyDisplayPrecision
export const getSubunitLabel = api.getSubunitLabel
export const amountToWords = api.amountToWords

export default api
