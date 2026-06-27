export type ErpDashWidgetId =
  | 'margins'
  | 'fixing'
  | 'bank'
  | 'expenses'
  | 'volume'
  | 'apar'

export type ErpDashWidgetMeta = {
  id: ErpDashWidgetId
  label: string
  icon: string
}

export const ERP_DASH_WIDGETS: ErpDashWidgetMeta[] = [
  { id: 'margins', label: 'Customer & Supplier Margins', icon: '📊' },
  { id: 'fixing', label: 'Net Position', icon: '📌' },
  { id: 'bank', label: 'Bank & Cash Balances', icon: '🏦' },
  { id: 'expenses', label: 'Expenses', icon: '📋' },
  { id: 'volume', label: 'Total Volume Traded', icon: '📦' },
  { id: 'apar', label: 'Accounts Payable & Receivable', icon: '⚖️' },
]
