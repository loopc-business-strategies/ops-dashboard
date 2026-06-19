import { API_URL, TENANT } from '@/src/config/tenant'

export type MetalRatesPayload = {
  goldPrice?: number
  silverPrice?: number
  platinumPrice?: number
  priceCurrency?: string
  priceUnit?: string
  sourceGoldPrice?: number
  sourceSilverPrice?: number
  sourcePlatinumPrice?: number
  sourceUnit?: string
  source?: string
  updatedAt?: string | null
}

export type LiveMetalRatesResponse = {
  success?: boolean
  live?: boolean
  feedType?: string
  message?: string
  rates?: MetalRatesPayload
}

export type SavedMetalRatesResponse = {
  success?: boolean
  rates?: MetalRatesPayload
}

export class MetalRatesHttpError extends Error {
  status: number
  network: boolean

  constructor(message: string, status: number, network = false) {
    super(message)
    this.name = 'MetalRatesHttpError'
    this.status = status
    this.network = network
  }
}

function buildUrl(path: string) {
  return `${API_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
}

async function metalRatesRequest<T>(path: string, token: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(buildUrl(path), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'x-tenant': TENANT,
        'x-company': TENANT,
        'X-Client': 'mobile',
      },
    })
  } catch {
    throw new MetalRatesHttpError('backend offline', 0, true)
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = typeof data?.message === 'string' ? data.message : `Request failed (${res.status})`
    throw new MetalRatesHttpError(message, res.status, false)
  }
  return data as T
}

export async function fetchLiveMetalRates(token: string) {
  return metalRatesRequest<LiveMetalRatesResponse>('/api/erp-accounting/currencies/metal-rates/live', token)
}

export async function fetchSavedMetalRates(token: string) {
  return metalRatesRequest<SavedMetalRatesResponse>('/api/erp-accounting/currencies/metal-rates', token)
}
