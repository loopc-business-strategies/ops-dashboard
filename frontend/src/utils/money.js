/**
 * ESM adapter for frontend — shared/money.js re-exports backend/shared/money.js.
 */
import money from '../../../shared/money.js'

const api = money?.default || money

export const toMoney = api.toMoney
export const roundMoney = api.roundMoney
export const parseNumber = api.parseNumber
export const parseAmount = api.parseAmount
export const formatAmount = api.formatAmount
export const formatCurrency = api.formatCurrency
export const formatMoney = api.formatMoney
export const getCurrencyDisplayPrecision = api.getCurrencyDisplayPrecision
export const getCurrencyPrecision = api.getCurrencyPrecision
export const getSubunitLabel = api.getSubunitLabel
export const getMajorUnitLabel = api.getMajorUnitLabel
export const amountToWords = api.amountToWords

export default api
