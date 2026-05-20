import { ACCOUNT_TYPES } from '../../constants/accountTypes'

export const LEDGER_REFERENCE_TYPES = ['journal', 'expense', 'invoice', 'payment', 'purchase', 'vendor_payment', 'inventory', 'payroll', 'bank_jv']
export const LEDGER_DEPARTMENTS = ['finance', 'sales', 'production', 'hr', 'operations', 'management']
export const ENQUIRY_HISTORY_STORAGE_KEY = 'erp-account-enquiry-history'
export const ENQUIRY_DETAILS_PANEL_STORAGE_KEY = 'erp-account-enquiry-details-panel'
export const ENQUIRY_STATEMENT_AUDIT_TOGGLE_STORAGE_KEY = 'erp-account-statement-audit-toggle'
export const INVENTORY_STOCK_CODE_SETTINGS_STORAGE_KEY = 'erp-inventory-stock-code-settings'
export const ACCOUNT_TYPE_ORDER = ACCOUNT_TYPES
export const METAL_UNIT_FACTORS = {
  gram: 1,
  ounce: 31.1034768,
  kg: 1000,
}

export const ERP_DASH_ALL_WIDGETS = [
  { id: 'margins', label: 'Customer & Supplier Margins', icon: '📊', color: '#e8f5ef', desc: 'Equity status and margin by customer/supplier', cols: 2 },
  { id: 'metals', label: 'Spot metals (live)', icon: '📈', color: '#fef9c3', desc: 'USD per troy oz — gold, silver, platinum, palladium', cols: 1 },
  { id: 'bank', label: 'Bank & Cash Balances', icon: '🏦', color: '#dbeafe', desc: 'All account balances overview', cols: 1, viewTab: 'bank' },
  { id: 'cashflow', label: 'Cash Flow', icon: '💸', color: '#dcfce7', desc: 'Monthly inflow / outflow bar chart', cols: 2 },
  { id: 'expenses', label: 'Expenses', icon: '📋', color: '#fee2e2', desc: 'Expense breakdown by category', cols: 1 },
  { id: 'volume', label: 'Total Volume Traded', icon: '📦', color: '#e8f5ef', desc: 'Trade volume by metal type', cols: 1 },
  { id: 'apar', label: 'Accounts Payable & Receivable', icon: '⚖️', color: '#fef3c7', desc: 'Live AP / AR with outstanding breakdown', cols: 3, viewTab: 'apar' },
  { id: 'fixing', label: 'Fixing Position Summary', icon: '📌', color: '#f0fdf4', desc: 'Open fixing positions by metal', cols: 3, viewTab: 'fixing-register' },
  { id: 'chat', label: 'Chat', icon: '💬', color: '#eff6ff', desc: 'Recent team messages', cols: 1, viewTab: 'chat' },
  { id: 'notif', label: 'Notifications & Alerts', icon: '🔔', color: '#fff7ed', desc: 'System alerts and reminders', cols: 1, viewTab: 'notif' },
]

export const ERP_DASH_DEFAULT = ['margins', 'metals', 'bank', 'cashflow', 'expenses', 'volume', 'apar', 'fixing', 'chat', 'notif']

const ERP_DASH_VALID_IDS = new Set(ERP_DASH_ALL_WIDGETS.map((widget) => widget.id))

export const sanitizeDashWidgets = (value) => {
  const source = Array.isArray(value) ? value : ERP_DASH_DEFAULT
  const seen = new Set()
  const normalized = []

  source.forEach((id) => {
    if (ERP_DASH_VALID_IDS.has(id) && !seen.has(id)) {
      seen.add(id)
      normalized.push(id)
    }
  })

  return normalized.length ? normalized : [...ERP_DASH_DEFAULT]
}
