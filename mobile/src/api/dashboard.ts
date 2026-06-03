import { apiRequest } from '@/src/api/client'
import { monthStartISO, todayISO } from '@/src/utils/format'

export type MarginRow = {
  customerName?: string
  supplierName?: string
  name?: string
  equity?: number
  netCashFlow?: number
  marginAmount?: number
  marginExcess?: number
  marginPercent?: number
  status?: string
  goldPosition?: number
  silverPosition?: number
}

export type FixingPosition = {
  code?: string
  metal?: string
  netPosition?: number
  qty?: number
  unit?: string
}

export type CashFlowMonth = {
  month?: string
  inflow?: number
  outflow?: number
  cashIn?: number
  cashOut?: number
  net?: number
}

export type ExpenseBreakdown = {
  name?: string
  label?: string
  month?: string
  amount?: number
}

export type ExpenseRecent = {
  date?: string
  category?: string
  description?: string
  amount?: number
  paymentMethod?: string
}

export type VolumeTraded = {
  metal?: string
  qty?: number
  value?: number
}

export type OutstandingRow = {
  customerName?: string
  supplierName?: string
  outstanding?: number
  count?: number
}

export type DashboardPayload = {
  success?: boolean
  apAr?: {
    totalAR?: number
    totalAP?: number
    netPosition?: number
    arCount?: number
    apCount?: number
    customerOutstanding?: OutstandingRow[]
    supplierOutstanding?: OutstandingRow[]
  }
  expenses?: {
    total?: number
    ytdTotal?: number
    currentMonthTotal?: number
    lastMonthTotal?: number
    txCount?: number
    breakdown?: ExpenseBreakdown[]
    recent?: ExpenseRecent[]
    monthlyTrend?: Array<{ key?: string; label?: string; month?: string; year?: string | number; amount?: number }>
  }
  cashFlow?: {
    inflow?: number
    outflow?: number
    net?: number
    monthly?: CashFlowMonth[]
    activity?: {
      operating?: { net?: number }
      investing?: { net?: number }
      financing?: { net?: number }
    }
    quality?: {
      runwayMonths?: number | null
      operatingCoverage?: number | null
    }
  }
  bankBalances?: Array<{ accountName?: string; accountCode?: string; balance?: number }>
  cashBalances?: Array<{ accountName?: string; accountCode?: string; balance?: number }>
  customerMargins?: MarginRow[]
  supplierMargins?: { rows?: MarginRow[] }
  fixingPositions?: FixingPosition[]
  volumeTraded?: VolumeTraded[]
  vendorComplianceRisk?: { nonCompliant?: number; averageScore?: number }
  vendorDocumentExpiry?: { warning30?: number; warning60?: number }
  lowStockAlerts?: Array<{ name?: string; sku?: string; quantity?: number }>
  metalRates?: Record<string, unknown>
  generatedAt?: string
}

export async function fetchDashboard(token: string, startDate = monthStartISO(), endDate = todayISO()) {
  return apiRequest<DashboardPayload>('/api/erp-accounting/reports/dashboard', {
    token,
    params: { startDate, endDate },
  })
}
