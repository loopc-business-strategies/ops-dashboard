/**
 * ESM adapter for frontend — import backend CJS money helpers via Vite interop.
 * Avoid shared/money.js re-export (no default export under Vite ESM).
 */
import * as moneyNs from '../../../backend/shared/money.js'

const api = moneyNs.default || moneyNs

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
