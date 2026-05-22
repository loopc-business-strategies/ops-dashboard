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

/** Default ERP home dashboard: 3-column grid (row1: margins | fixing | bank; row2: cashflow+expenses+volume+apar; row3: chat+notif). */
export const ERP_DASH_ALL_WIDGETS = [
  { id: 'margins', label: 'Customer & Supplier Margins', icon: '📊', color: '#ffedd5', desc: 'Equity and margin by customer/supplier', cols: 1 },
  { id: 'fixing', label: 'Fixing Position Summary', icon: '📌', color: '#fdf2f8', desc: 'Net position by metal (XAU–XPD)', cols: 1, viewTab: 'fixing-register' },
  { id: 'bank', label: 'Bank & Cash Balances', icon: '🏦', color: '#ede9fe', desc: 'All account balances overview', cols: 1, viewTab: 'bank' },
  { id: 'cashflow', label: 'Cash Flow', icon: '💸', color: '#dcfce7', desc: 'Monthly inflow / outflow bar chart', cols: 2 },
  { id: 'expenses', label: 'Expenses', icon: '📋', color: '#fef9c3', desc: 'Expense breakdown by category', cols: 1 },
  { id: 'volume', label: 'Total Volume Traded', icon: '📦', color: '#ffedd5', desc: 'Trade volume by metal type', cols: 1 },
  { id: 'apar', label: 'Accounts Payable & Receivable', icon: '⚖️', color: '#fef3c7', desc: 'Live AP / AR with outstanding breakdown', cols: 2, viewTab: 'apar' },
  { id: 'chat', label: 'Chat', icon: '💬', color: '#eff6ff', desc: 'Recent team messages', cols: 1, viewTab: 'chat' },
  { id: 'notif', label: 'Notifications & Alerts', icon: '🔔', color: '#e0f2fe', desc: 'System alerts and reminders', cols: 1, viewTab: 'notif' },
]

export const ERP_DASH_DEFAULT = ['margins', 'fixing', 'bank', 'cashflow', 'expenses', 'volume', 'apar', 'chat', 'notif']

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
