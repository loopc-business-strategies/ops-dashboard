import { apiRequest } from '@/src/api/client'
import { monthStartISO, todayISO } from '@/src/utils/format'

export type DashboardPayload = {
  success?: boolean
  apAr?: {
    totalAR?: number
    totalAP?: number
    netPosition?: number
    arCount?: number
    apCount?: number
  }
  expenses?: {
    total?: number
    ytdTotal?: number
    currentMonthTotal?: number
  }
  cashFlow?: {
    inflow?: number
    outflow?: number
    net?: number
  }
  bankBalances?: Array<{ accountName?: string; balance?: number }>
  cashBalances?: Array<{ accountName?: string; balance?: number }>
  customerMargins?: Array<{ customerName?: string; equity?: number; marginPercent?: number }>
  supplierMargins?: { rows?: Array<{ supplierName?: string; equity?: number }> }
  fixingPositions?: Array<{ metal?: string; code?: string; netPosition?: number }>
  vendorComplianceRisk?: { nonCompliant?: number; averageScore?: number }
  vendorDocumentExpiry?: { warning30?: number; warning60?: number }
  lowStockAlerts?: Array<{ name?: string; sku?: string; quantity?: number }>
  metalRates?: Record<string, unknown>
  generatedAt?: string
}

export type LiveMetalRates = {
  success?: boolean
  goldPrice?: number
  silverPrice?: number
  source?: string
}

export async function fetchDashboard(token: string, startDate = monthStartISO(), endDate = todayISO()) {
  return apiRequest<DashboardPayload>('/api/erp-accounting/reports/dashboard', {
    token,
    params: { startDate, endDate },
  })
}

export async function fetchLiveMetalRates(token: string) {
  return apiRequest<LiveMetalRates>('/api/erp-accounting/metal-rates/live', { token })
}
