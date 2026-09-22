/**
 * Mobile adapter for shared money utilities (same source as web/backend).
 * Vendored copy: `src/vendor/money.js` (from backend/shared/money.js) so Metro
 * release bundles do not depend on monorepo paths outside mobile/ (Windows
 * junction builds hit SHA-1 failures for ../shared).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const moneyModule = require('../vendor/money-impl.js')
const api = moneyModule?.default || moneyModule

export const toMoney = api.toMoney as (value: unknown) => number
export const roundMoney = api.roundMoney as (value: unknown, currencyCode?: string, currencyRow?: unknown) => number
export const parseNumber = api.parseNumber as (value: unknown, fallback?: number) => number
export const parseAmount = api.parseAmount as (value: unknown) => number | null
export const formatAmount = api.formatAmount as (
  value: unknown,
  options?: { currencyCode?: string; currencyRow?: unknown; fractionDigits?: number; minimumFractionDigits?: number; maximumFractionDigits?: number },
) => string
export const formatCurrency = api.formatCurrency as (value: unknown, options?: Record<string, unknown>) => string
export const formatMoney = api.formatMoney as (
  value: unknown,
  currencyCode?: string | Record<string, unknown>,
  options?: Record<string, unknown>,
) => string
export const getCurrencyPrecision = api.getCurrencyPrecision as (currencyCode?: string, currencyRow?: unknown) => number
export const getCurrencyDisplayPrecision = api.getCurrencyDisplayPrecision as (
  currencyCode?: string,
  currencyRow?: unknown,
) => number
export const getSubunitLabel = api.getSubunitLabel as (currencyCode?: string) => string
export const getMajorUnitLabel = api.getMajorUnitLabel as (currencyCode?: string) => string
export const amountToWords = api.amountToWords as (value: unknown, options?: Record<string, unknown>) => string

export default api
