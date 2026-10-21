import { ACCOUNT_TYPES } from '../../constants/accountTypes'

export const JV_MODAL_DEFAULT_SIZE = Object.freeze({ width: 980, height: 640 })

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

/**
 * ERP home dashboard uses a 6-column CSS grid; each widget spans 2 columns (3 widgets per row).
 * Reference layout: row1 margins+fixing+bank; row2 cashflow+expenses+volume; row3 apar+chat+notif.
 */
export const ERP_DASH_GRID_COLUMNS = 6
export const ERP_DASH_WIDGET_BODY_HEIGHT = '380px'
export const ERP_DASH_CARD_MIN_HEIGHT = '440px'

export const ERP_DASH_ALL_WIDGETS = [
  { id: 'margins', label: 'Customer & Supplier Margins', icon: '📊', color: '#ffedd5', desc: 'Equity and margin by customer/supplier', cols: 2 },
  { id: 'fixing', label: 'Net Position', icon: '📌', color: '#fdf2f8', desc: 'Metal position by type (XAU–XPD)', cols: 2, viewTab: 'fixing-register' },
  { id: 'bank', label: 'Bank & Cash Balances', icon: '🏦', color: '#ede9fe', desc: 'All account balances overview', cols: 2, viewTab: 'bank' },
  { id: 'cashflow', label: 'Cash Flow', icon: '💸', color: '#dcfce7', desc: 'Monthly inflow / outflow bar chart', cols: 2 },
  { id: 'expenses', label: 'Expenses', icon: '📋', color: '#fef9c3', desc: 'Expense breakdown and monthly trend', cols: 2, expandable: true },
  { id: 'volume', label: 'Total Volume Traded', icon: '📦', color: '#ffedd5', desc: 'Trade volume by metal type', cols: 2 },
  { id: 'apar', label: 'Accounts Payable & Receivable', icon: '⚖️', color: '#fef3c7', desc: 'Live AP / AR with outstanding breakdown', cols: 2, viewTab: 'apar' },
  { id: 'chat', label: 'Chat', icon: '💬', color: '#eff6ff', desc: 'Recent team messages', cols: 2, viewTab: 'chat' },
  { id: 'notif', label: 'Notifications & Alerts', icon: '🔔', color: '#e0f2fe', desc: 'System alerts and reminders', cols: 2, viewTab: 'notif' },
]

export const ERP_DASH_DEFAULT = ['margins', 'fixing', 'bank', 'cashflow', 'expenses', 'volume', 'apar', 'chat', 'notif']

/** Canonical number of widgets in the default ERP home layout (must match `ERP_DASH_ALL_WIDGETS`). */
export const ERP_DASH_WIDGET_COUNT = ERP_DASH_ALL_WIDGETS.length

/** Fallback metal rates when API sync has not loaded yet (ERPTab shell). */
export const DEFAULT_METAL_RATES = Object.freeze({
  goldPrice: 285,
  silverPrice: 3.5,
  priceCurrency: 'USD',
  updatedAt: null,
})

const ERP_DASH_VALID_IDS = new Set(ERP_DASH_ALL_WIDGETS.map((widget) => widget.id))

/** Keep Customer & Supplier Margins first and Net Position immediately to its right when both are enabled. */
export function ensureMarginsThenFixingOrder(ids) {
  const list = Array.isArray(ids) ? ids : []
  const hasM = list.includes('margins')
  const hasF = list.includes('fixing')
  if (!hasM && !hasF) return [...list]
  const rest = list.filter((id) => id !== 'margins' && id !== 'fixing')
  const head = [...(hasM ? ['margins'] : []), ...(hasF ? ['fixing'] : [])]
  return [...head, ...rest]
}

/** Valid ids + dedupe + legacy strip; preserves list order (no margins/fixing pin). Used while persisting during Arrange. */
export const sanitizeDashWidgetsPreserveOrder = (value) => {
  const raw = Array.isArray(value) ? value.filter((id) => id !== 'metals') : value
  const source = Array.isArray(raw) ? raw : ERP_DASH_DEFAULT
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

export const sanitizeDashWidgets = (value) => ensureMarginsThenFixingOrder(sanitizeDashWidgetsPreserveOrder(value))
