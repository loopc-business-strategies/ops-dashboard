export type ErpDashWidgetId =
  | 'margins'
  | 'fixing'
  | 'bank'
  | 'cashflow'
  | 'expenses'
  | 'volume'
  | 'apar'
  | 'chat'
  | 'notif'

export type ErpDashWidgetMeta = {
  id: ErpDashWidgetId
  label: string
  icon: string
}

export const ERP_DASH_WIDGETS: ErpDashWidgetMeta[] = [
  { id: 'margins', label: 'Customer & Supplier Margins', icon: '📊' },
  { id: 'fixing', label: 'Fixing Position Summary', icon: '📌' },
  { id: 'bank', label: 'Bank & Cash Balances', icon: '🏦' },
  { id: 'cashflow', label: 'Cash Flow', icon: '💸' },
  { id: 'expenses', label: 'Expenses', icon: '📋' },
  { id: 'volume', label: 'Total Volume Traded', icon: '📦' },
  { id: 'apar', label: 'Accounts Payable & Receivable', icon: '⚖️' },
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'notif', label: 'Notifications & Alerts', icon: '🔔' },
]
