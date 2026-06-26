import { apiRequest } from '@/src/api/client'

export type CurrencyRow = {
  _id?: string
  code?: string
  baseCurrency?: boolean
  exchangeRate?: number
}

export type CurrenciesResponse = {
  success?: boolean
  currencies?: CurrencyRow[]
}

export async function fetchCurrencies(token: string) {
  return apiRequest<CurrenciesResponse>('/api/erp-accounting/currencies', { token })
}

export function resolveBaseCurrencyCode(currencies: CurrencyRow[] | undefined, fallback = 'USD'): string {
  const base = (currencies || []).find((c) => c.baseCurrency === true)
  const code = String(base?.code || '').trim().toUpperCase()
  return code || fallback
}
