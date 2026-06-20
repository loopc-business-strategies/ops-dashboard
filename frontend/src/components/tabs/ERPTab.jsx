import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { getTenantBranding, isLocalTenantHost } from '../../config/tenantBranding'
import {
  buildDashboardSearchParams,
  buildEnquiryHref,
  enquiryDeepLinkKey,
} from '../../utils/dashboardNavigation'
import erpAccountingAPI from '../../api/erp-accounting'
import { readSummaryAccountsCache, writeSummaryAccountsCache } from '../../utils/erpSummaryAccountsCache'
import { buildEntryAccountOptions, filterActiveAccounts } from './erp/accountDropdownHelpers'
import { readAccountEnquiryCache, writeAccountEnquiryCache } from '../../utils/erpAccountEnquiryCache'
import { ACCOUNT_TYPES } from '../../constants/accountTypes'
import {
  LEDGER_REFERENCE_TYPES,
  LEDGER_DEPARTMENTS,
  ENQUIRY_HISTORY_STORAGE_KEY,
  ENQUIRY_DETAILS_PANEL_STORAGE_KEY,
  ENQUIRY_STATEMENT_AUDIT_TOGGLE_STORAGE_KEY,
  INVENTORY_STOCK_CODE_SETTINGS_STORAGE_KEY,
  ACCOUNT_TYPE_ORDER,
  ERP_DASH_ALL_WIDGETS,
} from './erpTabConstants'
import { formatTransactionAuditEntry, formatTransactionCommentKind, getTransactionBulkSelectionLabel } from './transactionWorkflow'
import { useERPTabStateAdapter } from './erp/useERPTabStateAdapter'
import { useErpDashUiState } from './erp/useErpDashUiState'
import { useErpDashWidgetData } from './erp/useErpDashWidgetData'
import { useFixingRegisterPanelDrag } from './erp/useFixingRegisterPanelDrag'
import { useFixingRegisterState } from './erp/useFixingRegisterState'
import { useJvModalDragResize } from './erp/useJvModalDragResize'
import { useFixingRegisterStockTypeOptions } from './erp/useFixingRegisterStockTypeOptions'
import { ERP_TAB_COLORS as C, TRANSACTION_STATUS_STYLES, ERP_EMPTY_CARD_STYLE, ERP_MODAL_BACKDROP_STYLE, ERP_MODAL_CARD_STYLE, ERP_MODAL_INPUT_STYLE } from './erp/erpTabPresentation'
import { useTransactionComposer } from './erp/useTransactionComposer'
import { useJournalVoucher } from './erp/useJournalVoucher'
import AccountEnquiryModal from './erp/accountEnquiry/AccountEnquiryModal'
import StatementPreviewModal from './erp/accountEnquiry/StatementPreviewModal'
import { useAccountEnquiryStatement } from './erp/accountEnquiry/useAccountEnquiryStatement'
import { useAccountEnquiryModalDrag } from './erp/accountEnquiry/useAccountEnquiryModalDrag'
import { useEnquiryDeepLinkEffects } from './erp/accountEnquiry/useEnquiryDeepLinkEffects'
import {
  fixingRegFmtQty,
  fixingRegFmtRate,
  fixingRegFmtAmt,
} from './erp/fixingRegisterUtils'

import { deriveErpAccessPolicy, getAvailableTransactionTypes } from './erp/accessPolicy'
import {
  ERPAccountsTabContainer,
  ERPVouchersTabContainer,
} from './erp/ERPTabContainers'
import {
  DEFAULT_INVENTORY_STOCK_CODE_SETTINGS,
  buildAutoStockCode,
  buildUniqueStockCode,
  createInventoryMappingForm,
  createInventoryProductForm,
  decodeInventoryCategoryMeta,
  decodeInventoryCategoryPairs,
  encodeInventoryCategoryMeta,
  erpTabNeedsLiveMetalRates,
  formatVatPercent,
  getTransactionActionLabels,
  getTransactionTypeLabels,
  resolveMainStockValueFromForm,
  resolveTransactionAttachmentUrl,
  titleCaseWords,
} from './erp/erpTabUtils'
import ERPDashboardTab from './erp/tabs/ERPDashboardTab'
import { useErpMetalRatesRealtime } from './erp/useErpMetalRatesRealtime'
import { useErpCustomers } from './erp/useErpCustomers'
import { useErpMappings } from './erp/useErpMappings'
import { useErpCurrencies } from './erp/useErpCurrencies'
import { useErpCustomerMargin, useErpSupplierMargin, useErpMarginContextMenuDismissal } from './erp/useErpMarginTabs'

import { trialBalanceRowsForView } from './erp/trialBalanceReportRows'
import { startERPRealtimeFeeds } from '../../utils/realtimeSocket'
import {
  liveRatesToMetalRatesState,
  resolveInventoryValuationUnitCost,
} from '../../utils/liveMetalRates'
import { downloadBlob, downloadCsv, printStatementHtml } from './erp/exportHelpers'
import {
  formatAccountEnquiryExcessDisplay,
  getAccountEnquirySignedMetricColor,
  resolveExposureDirection,
  isMetalStatementEntry,
} from './erp/statementHelpers'
import { generateStatementHtml as buildStatementHtml } from './erp/statementPrintHtml'
import {
  canViewErpSubTab,
} from '../../utils/erpSubTabPermissions'
import {
  JV_MODE_META,
  buildJvDocNo as buildNextJvDocNo,
  convertJvAmountBetweenCurrencies,
  createJvHeader as createNextJvHeader,
  emptyJvLine,
  extractLedgerJvDocNoFromDescription,
  normalizeJvCurrencyCode,
  resolveJvModeMeta,
} from './erp/journalVoucherHelpers'
import {
  DEFAULT_BRANDING,
  DEFAULT_BRANDING_PROFILES,
  LOGO_UPLOAD_MAX_BYTES,
  normalizeBrandingKey,
  clampBrandingDimension,
  createLogoRenderAsset,
  isSupportedLogoUpload,
} from './erp/ERPBrandingUtils'
import { resolveDocumentBranding } from './erp/documentBranding'
import { loadExcel, loadPdfTools } from './erp/lazyExportLibs'
import { exchangeRateFromUnitsPerBase, resolveCurrencyRowByCode } from './erp/erpCurrencyRowHelpers'
import StatementExportOptionsModal from './erp/StatementExportOptionsModal'

const JV_MODAL_DEFAULT_SIZE = Object.freeze({ width: 980, height: 640 })

const ChartOfAccountsTree = lazy(() => import('./ChartOfAccountsTree'))
const DirectDealsTab = lazy(() => import('./DirectDealsTab'))
const ERPInventoryTab = lazy(() => import('./erp/tabs/ERPInventoryTab'))
const ERPVendorsTab = lazy(() => import('./erp/tabs/ERPVendorsTab'))
const ERPLedgerTab = lazy(() => import('./erp/tabs/ERPLedgerTab'))
const ERPTransactionsTab = lazy(() => import('./erp/tabs/ERPTransactionsTab'))
const ERPReportsTab = lazy(() => import('./erp/tabs/ERPReportsTab'))
const ERPFixingRegisterTab = lazy(() => import('./erp/tabs/ERPFixingRegisterTab'))
const ERPCustomersTab = lazy(() => import('./erp/tabs/ERPCustomersTab'))
const ERPCustomerMarginTab = lazy(() => import('./erp/tabs/ERPCustomerMarginTab'))
const ERPSupplierMarginTab = lazy(() => import('./erp/tabs/ERPSupplierMarginTab'))
const ERPMappingsTab = lazy(() => import('./erp/tabs/ERPMappingsTab'))
const ERPEnquiryTab = lazy(() => import('./erp/tabs/ERPEnquiryTab'))
const ERPSettingsTab = lazy(() => import('./erp/tabs/ERPSettingsTab'))
const ERPCurrenciesTab = lazy(() => import('./erp/tabs/ERPCurrenciesTab'))

const VoucherTab = lazy(() => import('./VoucherTab'))

function ErpSubTabFallback() {
  return (
    <div style={{ padding: '1rem', color: '#6B7280', fontSize: '0.875rem' }}>
      Loading…
    </div>
  )
}

function ERPTab({
  focusTab,
  onNavigateMain,
  onErpSubTabChange,
  jumpToTransactionId = null,
  onJumpToTransactionConsumed,
  jumpToVoucher = null,
  onJumpToVoucherConsumed,
  jumpToEnquiryAccountCode = null,
  onJumpToEnquiryConsumed,
}) {
  const { user, token } = useAuth()
  const inventoryTenantKey = getTenantBranding(user?.company || user?.tenant?.key || user?.tenant?.name)?.key || ''
  const { t } = useLanguage()
  const TRANSACTION_TYPE_LABELS = getTransactionTypeLabels(t)
  const TRANSACTION_ACTION_LABELS = getTransactionActionLabels(t)
  const { activeTab, setActiveTab } = useERPTabStateAdapter(focusTab, user)
  const setActiveTabGuarded = useCallback((next) => {
    setActiveTab((prev) => {
      const candidate = typeof next === 'function' ? next(prev) : next
      if (!candidate || typeof candidate !== 'string') return prev
      const resolved = canViewErpSubTab(user, candidate) ? candidate : prev
      if (resolved !== prev) onErpSubTabChange?.(resolved)
      return resolved
    })
  }, [setActiveTab, user, onErpSubTabChange])
  const canViewCurrentErpSubTab = canViewErpSubTab(user, activeTab)
  const {
    dashEditMode,
    setDashEditMode,
    dashWidgets,
    setDashWidgets,
    dashHoveredWid,
    setDashHoveredWid,
    dashWidgetCols,
    setDashWidgetCols,
    dashCustomizeOpen,
    setDashCustomizeOpen,
    dashPickSelected,
    setDashPickSelected,
    dashDragSrc,
  } = useErpDashUiState({ user })
  const activeTabRef = useRef(activeTab)
  const [accounts, setAccounts] = useState([])
  const [summaryAccounts, setSummaryAccounts] = useState([])
  const safeSummaryAccounts = useMemo(
    () => filterActiveAccounts(Array.isArray(summaryAccounts) ? summaryAccounts : [])
      .filter((item) => item?._id && String(item?.accountCode || '').trim())
      .map((item) => ({ ...item, accountCode: String(item.accountCode).trim() })),
    [summaryAccounts],
  )
  const [customers, setCustomers] = useState([])
  const {
    fixingRegFilter,
    setFixingRegFilter,
    fixingRegResults,
    setFixingRegResults,
    fixingRegOpening,
    fixingRegLoading,
    fixingRegShown,
    setFixingRegShown,
    fixingRegError,
    setFixingRegError,
    handleFixingRegProceed,
  } = useFixingRegisterState({ token })
  const [ledger, setLedger] = useState([])
  const [mappings, setMappings] = useState([])
  const [currencies, setCurrencies] = useState([])
  const erpBaseCurrencyCode = useMemo(
    () => String(currencies.find((c) => c.baseCurrency)?.code || 'USD').trim().toUpperCase() || 'USD',
    [currencies],
  )
  const convertJvAmount = useCallback(
    (amount, fromCurrency, toCurrency) => convertJvAmountBetweenCurrencies(
      amount,
      fromCurrency,
      toCurrency,
      currencies,
      erpBaseCurrencyCode,
    ),
    [currencies, erpBaseCurrencyCode],
  )
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [_ledgerLoading, setLedgerLoading] = useState(false)
  const [reportsLoading, setReportsLoading] = useState(false)
  const [_accountsLoading, setAccountsLoading] = useState(false)
  const [_customersLoading, setCustomersLoading] = useState(false)
  const [_mappingsLoading, setMappingsLoading] = useState(false)
  const [_currenciesLoading, setCurrenciesLoading] = useState(false)
  const [_vendorsLoading, setVendorsLoading] = useState(false)
  const [_inventoryLoading, setInventoryLoading] = useState(false)
  const [summaryAccountsLoading, setSummaryAccountsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [exportOptionsOpen, setExportOptionsOpen] = useState(false)
  // ─── Multi-line Journal Voucher state ─────────────────────────────────────
  const buildJvDocNo = (mode = 'journal') => buildNextJvDocNo(ledger, mode)
  const createJvHeader = (currencyCode = 'USD', mode = 'journal') => createNextJvHeader(ledger, currencyCode, mode)
  const [jvLines, setJvLines] = useState([emptyJvLine(1), emptyJvLine(2)])
  const [jvHeader, setJvHeader] = useState(() => createJvHeader('USD', 'journal'))
  const [nextJvLineId, setNextJvLineId] = useState(3)
  const [jvMode, setJvMode] = useState('journal')
  const [ledgerVoucherTab, setLedgerVoucherTab] = useState('journal')
  const [jvEditEntryIds, setJvEditEntryIds] = useState([]) // IDs of entries being edited (empty = new JV)
  const [jvReadOnly, setJvReadOnly] = useState(false)
  const [currencyForm, setCurrencyForm] = useState({
    code: '',
    name: '',
    symbol: '',
    exchangeRate: 1,
    baseCurrency: false,
    oneUsdEquals: '',
  })
  const [usdConversion, setUsdConversion] = useState({ usdAmount: '1', targetCode: 'UZS' })
  const [mappingForm, setMappingForm] = useState({ mappingType: '', debitAccountId: '', creditAccountId: '', department: '', description: '' })
  const [mappingFilters, setMappingFilters] = useState({ department: '' })
  const [mappingSummary, setMappingSummary] = useState({ total: 0, shared: 0, byDepartment: {} })
  const [customerForm, setCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    gstVat: '',
    openingBalance: '',
    creditLimit: '',
    paymentTermsDays: '',
    currency: 'USD',
    notes: '',
  })
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [showLedgerForm, setShowLedgerForm] = useState(false)
  const [jvModalOffset, setJvModalOffset] = useState({ x: 0, y: 0 })
  const [jvModalDrag, setJvModalDrag] = useState({ active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 })
  const [jvModalSize, setJvModalSize] = useState(JV_MODAL_DEFAULT_SIZE)
  const [jvModalResize, setJvModalResize] = useState({ active: false, pointerX: 0, pointerY: 0, startW: JV_MODAL_DEFAULT_SIZE.width, startH: JV_MODAL_DEFAULT_SIZE.height })
  const [showCurrencyForm, setShowCurrencyForm] = useState(false)
  const [showMappingForm, setShowMappingForm] = useState(false)
  const [ledgerFilters, setLedgerFilters] = useState({ startDate: '', endDate: '', department: '', referenceType: '', accountId: '' })
  const [editState, setEditState] = useState({ type: '', record: null, form: {} })
  const [success, setSuccess] = useState('')
  const [pagination, setPagination] = useState({ accounts: 1, ledger: 1, mappings: 1 })
  const [sorting, setSorting] = useState({ accounts: { by: 'code', asc: true }, ledger: { by: 'date', asc: false }, mappings: { by: 'type', asc: true } })
  const [showMappingTest, setShowMappingTest] = useState(false)
  const [testMapping, setTestMapping] = useState(null)
  const [accountEnquiryCode, setAccountEnquiryCode] = useState('')
  const [accountEnquiryData, setAccountEnquiryData] = useState(null)
  const accountEnquiryDataRef = useRef(null)
  const [enquiryLoading, setEnquiryLoading] = useState(false)
  const [enquiryStatus, setEnquiryStatus] = useState({ type: '', message: '' })
  const [statementFilters, setStatementFilters] = useState({
    startDate: '',
    endDate: '',
    referenceType: '',
    department: '',
    fixStatus: '',
    foreignCurrency: '',
    metalCommodity: '',
    showAmountIn: '',
  })
  const [statementMetalCommodityEnabled, setStatementMetalCommodityEnabled] = useState(false)
  const [showStatementAuditIds, setShowStatementAuditIds] = useState(false)
  const [statementAuditPreferenceReady, setStatementAuditPreferenceReady] = useState(false)
  const [metalRates, setMetalRates] = useState({ goldPrice: 285, silverPrice: 3.5, priceCurrency: 'USD', updatedAt: null })
  const metalRatesRef = useRef(metalRates)
  metalRatesRef.current = metalRates
  const [enquiryHistory, setEnquiryHistory] = useState([])
  const [showEnquiryModal, setShowEnquiryModal] = useState(false)
  const showEnquiryModalRef = useRef(false)
  const [showStatementPreview, setShowStatementPreview] = useState(false)
  const [statementPreviewHtml, setStatementPreviewHtml] = useState('')
  const [statementPreviewLoading, setStatementPreviewLoading] = useState(false)
  const [statementPreviewTitle, setStatementPreviewTitle] = useState('Statement of Account')
  const [pendingStatementPreview, setPendingStatementPreview] = useState(false)
  const lastEnquiryDeepLinkKeyRef = useRef('')
  const [searchParams, setSearchParams] = useSearchParams()
  const enquiryIncludeCompany = useMemo(
    () => typeof window !== 'undefined' && isLocalTenantHost(window.location.hostname),
    [],
  )
  const enquiryCompany = user?.company || user?.tenant || ''
  const syncEnquiryUrl = useCallback(({ account, view, replace = true } = {}) => {
    setSearchParams((prev) => buildDashboardSearchParams({
      activeTab: 'erp',
      erpSubTab: 'enquiry',
      enquiryAccount: account,
      enquiryView: view,
      company: enquiryCompany,
      includeCompany: enquiryIncludeCompany,
      preserveFrom: prev,
    }), { replace })
  }, [setSearchParams, enquiryIncludeCompany, enquiryCompany])
  const buildAccountEnquiryHref = useCallback((account, view) => buildEnquiryHref({
    account,
    view,
    company: enquiryCompany,
    includeCompany: enquiryIncludeCompany,
  }), [enquiryCompany, enquiryIncludeCompany])
  const [showEnquiryLookupMenu, setShowEnquiryLookupMenu] = useState(false)
  const [detailsPanel, setDetailsPanel] = useState({
    pinned: false,
    floating: false,
    x: 120,
    y: 150,
    width: 500,
    height: 520,
  })
  const statementAuditPreferenceKey = `${ENQUIRY_STATEMENT_AUDIT_TOGGLE_STORAGE_KEY}:${String(user?._id || user?.email || 'anonymous')}`
  const [excessCurrency, setExcessCurrency] = useState('')
  const [transactions, setTransactions] = useState([])
  const [vendors, setVendors] = useState([])
  const [inventoryProducts, setInventoryProducts] = useState([])
  const [stockMovements, setStockMovements] = useState([])
  const [stockMovementsLoading, setStockMovementsLoading] = useState(false)
  const [stockMovementsFilter, setStockMovementsFilter] = useState('')
  const [reports, setReports] = useState({
    trialBalance: null,
    profitLoss: null,
    balanceSheet: null,
    dayBook: null,
    customerOutstanding: null,
    vendorOutstanding: null,
    forex: null,
  })
  const [reportView, setReportView] = useState('summary')
  const [reportFilters, setReportFilters] = useState({
    period: 'ytd',
    startDate: '',
    endDate: '',
    accountType: '',
    includeZeroAccounts: false,
    sortBy: 'accountCode',
    sortDir: 'asc',
    comparePrevious: true,
    referenceType: '',
    minAmount: '',
    search: '',
  })
  const [selectedReportAccountId, setSelectedReportAccountId] = useState('')
  const [selectedReportAccountCode, setSelectedReportAccountCode] = useState('')
  const [ledgerReportRows, setLedgerReportRows] = useState([])
  const [voucherSource, setVoucherSource] = useState(null)
  const [voucherSourceLoading, setVoucherSourceLoading] = useState(false)
  const [selectedTransactionId, setSelectedTransactionId] = useState('')
  const [brandingProfiles, setBrandingProfiles] = useState(DEFAULT_BRANDING_PROFILES)
  const [selectedBrandingKey, setSelectedBrandingKey] = useState(DEFAULT_BRANDING.key)
  const [reportBranding, setReportBranding] = useState(DEFAULT_BRANDING)
  const [brandingForm, setBrandingForm] = useState(DEFAULT_BRANDING)
  const [brandingPreviewLogo, setBrandingPreviewLogo] = useState('')
  const [transactionFilters, setTransactionFilters] = useState({ search: '', status: '', type: '', startDate: '', endDate: '' })
  const [transactionSummary, setTransactionSummary] = useState({ totalCount: 0, totalAmount: 0, draft: 0, submitted: 0, approved: 0, posted: 0, returned: 0, rejected: 0 })
  const [ledgerMeta, setLedgerMeta] = useState({ cursor: null, nextCursor: null, hasMore: false, cursorHistory: [] })
  const [transactionMeta, setTransactionMeta] = useState({ page: 1, limit: 25, total: 0, cursor: null, nextCursor: null, hasMore: false, cursorHistory: [] })
  const [selectedTransactionIds, setSelectedTransactionIds] = useState([])
  const [transactionWorkflowNote, setTransactionWorkflowNote] = useState('')
  const [transactionCommentDraft, setTransactionCommentDraft] = useState('')
  const [transactionAttachmentInputKey, setTransactionAttachmentInputKey] = useState(0)
  const [vendorForm, setVendorForm] = useState({
    vendorCode: '',
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    country: '',
    postalCode: '',
    gstVat: '',
    taxRegistrationNo: '',
    openingBalance: '',
    paymentTermsDays: '30',
    creditLimit: '',
    category: 'general',
    rating: '3',
    riskLevel: 'medium',
    status: 'active',
    notes: '',
    tags: '',
    preferredCurrency: 'USD',
    bankName: '',
    bankAccountNumber: '',
    iban: '',
    swiftCode: '',
    currency: 'USD',
  })
  const [vendorFilters, setVendorFilters] = useState({ search: '', status: '', approvalStatus: '', riskLevel: '', category: '', includeInactive: false })
  const [vendorSummary, setVendorSummary] = useState({ totalVendors: 0, totalOutstanding: 0, overLimit: 0, blacklisted: 0, onHold: 0, nonCompliant: 0 })
  const [vendorPermissions, setVendorPermissions] = useState({ canManage: false, canUpdateOperational: false })
  const [selectedVendorId, setSelectedVendorId] = useState('')
  const [selectedVendorDetails, setSelectedVendorDetails] = useState(null)
  const [vendorWorkflowReason, setVendorWorkflowReason] = useState('')
  const [vendorDocumentForm, setVendorDocumentForm] = useState({ docType: 'contract', title: '', documentNo: '', fileUrl: '', file: null, issueDate: '', expiryDate: '', status: 'active', verified: false, notes: '' })
  const [vendorPaymentCalendar, setVendorPaymentCalendar] = useState({ rows: [], alerts: { overdue: 0, due_soon: 0, upcoming: 0, later: 0, totalDue: 0 } })
  const [vendorComplianceSummary, setVendorComplianceSummary] = useState({ summary: { total: 0, nonCompliant: 0, avgComplianceScore: 0 }, expiryBuckets: { expired: 0, warning30: 0, warning60: 0, warning90: 0 }, atRisk: [] })
  const [vendorOverdueQueue, setVendorOverdueQueue] = useState({ summary: { total: 0, withRecipient: 0, critical: 0, totalAmountDue: 0 }, queue: [] })
  const [showVendorForm, setShowVendorForm] = useState(false)
  const [editingVendorId, setEditingVendorId] = useState('')
  const [inventoryMappingForm, setInventoryMappingForm] = useState(createInventoryMappingForm)
  const [stockTypeModalTab, setStockTypeModalTab] = useState('details')
  const [editingProductId, setEditingProductId] = useState('')
  const [showInventoryMappingModal, setShowInventoryMappingModal] = useState(false)
  const [showInventoryProductModal, setShowInventoryProductModal] = useState(false)
  const [inventoryProductForm, setInventoryProductForm] = useState(createInventoryProductForm)
  const [editingInventoryProductId, setEditingInventoryProductId] = useState('')
  const [inventoryVatFilter, setInventoryVatFilter] = useState('all')
  const [inventoryVatSortDir, setInventoryVatSortDir] = useState('none')
  const [inventoryStockCodeManualOverride, setInventoryStockCodeManualOverride] = useState(false)
  const [inventoryModalOffset, setInventoryModalOffset] = useState({ x: 0, y: 0 })
  const [inventoryModalDragging, setInventoryModalDragging] = useState(false)
  const inventoryModalDragRef = useRef({ moveHandler: null, upHandler: null })
  const [inventoryProductModalOffset, setInventoryProductModalOffset] = useState({ x: 0, y: 0 })
  const [inventoryProductModalDragging, setInventoryProductModalDragging] = useState(false)
  const inventoryProductModalDragRef = useRef({ moveHandler: null, upHandler: null })
  const [inventoryStockCodeSettings, setInventoryStockCodeSettings] = useState(DEFAULT_INVENTORY_STOCK_CODE_SETTINGS)
  const inventoryStockCodeSettingsKey = `${INVENTORY_STOCK_CODE_SETTINGS_STORAGE_KEY}:${String(user?._id || user?.email || 'anonymous')}`
  const ITEMS_PER_PAGE = 25
  const statementTableRef = useRef(null)
  const showNotification = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }
  // Role-based permissions
  const {
    isSuperAdmin,
    isDepartmentHead: _isDepartmentHead,
    isManagementRole: _isManagementRole,
    isFinance,
    isSalesRole: _isSalesRole,
    isOperationsRole: _isOperationsRole,
    isHRRole: _isHRRole,
    canViewAccounts,
    canManageAccounts,
    canViewMappings,
    canViewLedger,
    canViewCustomers,
    canManageCustomers,
    canViewBalanceEnquiry,
    canUpdateMetalRates: _canUpdateMetalRates,
    canExportAccountSummary,
    canAccessTransactions,
    canAccessReports,
    canAccessVendors,
    canManageVendors,
    canUpdateVendorOperational: _canUpdateVendorOperational,
    canAccessInventory,
    canAccessVouchers,
    canAccessDirectDeals,
    canAccessErpSettings,
    canAccessCurrencies,
    canAccessFixingRegister,
    canCreateTransaction: _canCreateTransaction,
    canManageDirectDeals,
    canManageTransactionWorkflow: _canManageTransactionWorkflow,
    canCloseLedgerPeriod,
    canAccessERP,
  } = deriveErpAccessPolicy(user)
  const canLoadReferenceData = canViewAccounts || canAccessTransactions || canAccessVouchers || canViewBalanceEnquiry || canViewLedger || canAccessReports || canAccessCurrencies || canAccessErpSettings || canAccessFixingRegister
  const canLoadParties = canViewCustomers || canAccessVendors || canAccessTransactions || canAccessVouchers || canAccessFixingRegister || canAccessDirectDeals
  const canLoadInventoryData = canAccessInventory || canAccessFixingRegister
  const canLoadDashboard = canViewAccounts || canAccessReports
  const {
    dashboard,
    dashChatMessages,
    loadDashboard,
  } = useErpDashWidgetData({
    activeTab,
    token,
    canLoadDashboard,
    setError,
  })
  const { loadCustomers } = useErpCustomers({
    token,
    canLoadParties,
    setLoading: setCustomersLoading,
    setCustomers,
    setError,
  })
  const { loadMappings } = useErpMappings({
    token,
    canViewMappings,
    canLoadReferenceData,
    setLoading: setMappingsLoading,
    setMappings,
    setMappingSummary,
    setAccounts,
    setError,
  })
  const { loadCurrencies } = useErpCurrencies({
    token,
    canLoadReferenceData,
    setLoading: setCurrenciesLoading,
    setCurrencies,
    setError,
  })
  const patchAccountEnquiryMetalRates = useCallback((rates) => {
    if (!rates) return
    setAccountEnquiryData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        metals: {
          ...prev.metals,
          goldPrice: Number(rates.goldPrice ?? prev.metals?.goldPrice ?? 0),
          silverPrice: Number(rates.silverPrice ?? prev.metals?.silverPrice ?? 0),
          priceCurrency: rates.priceCurrency || prev.metals?.priceCurrency || 'USD',
          updatedAt: rates.updatedAt || prev.metals?.updatedAt || null,
        },
      }
    })
  }, [])
  const onMetalRatesForTabs = useCallback((rates) => {
    startTransition(() => setMetalRates(rates))
  }, [])
  useErpMetalRatesRealtime({
    token,
    tenant: user?.tenant || user?.company,
    canAccessERP,
    activeTabRef,
    showEnquiryModalRef,
    accountEnquiryDataRef,
    metalRatesRef,
    onMetalRatesForTabs,
    onEnquiryMetalRatesPatch: patchAccountEnquiryMetalRates,
  })
  const [liveMetalFetchError, setLiveMetalFetchError] = useState(null)
  const erpLiveMetalSnapshot = useMemo(() => ({
    gold: Number(metalRates.goldPrice || 0),
    silver: Number(metalRates.silverPrice || 0),
    unit: 'G',
    updatedAt: metalRates.updatedAt,
  }), [metalRates.goldPrice, metalRates.silverPrice, metalRates.updatedAt])
  useEffect(() => {
    if (!token || !canAccessERP) return undefined
    let cancelled = false
    erpAccountingAPI.getLiveMetalRates(token)
      .then((data) => {
        if (cancelled) return
        const rates = data?.rates || data?.data?.rates || data
        const synced = liveRatesToMetalRatesState({
          gold: Number(rates?.sourceGoldPrice || rates?.goldPrice || 0),
          silver: Number(rates?.sourceSilverPrice || rates?.silverPrice || 0),
          unit: rates?.sourceUnit || rates?.priceUnit || 'TOZ',
          updatedAt: rates?.updatedAt || null,
        })
        if (synced) {
          metalRatesRef.current = synced
          if (erpTabNeedsLiveMetalRates(activeTabRef.current)) {
            setMetalRates(synced)
          }
        }
        setLiveMetalFetchError(null)
      })
      .catch((err) => {
        if (!cancelled) {
          setLiveMetalFetchError(err?.response?.data?.message || 'Live metal rates unavailable')
        }
      })
    return () => {
      cancelled = true
    }
  }, [token, canAccessERP])
  const selectedUsdConversionCurrency = resolveCurrencyRowByCode(currencies, usdConversion.targetCode, erpBaseCurrencyCode)
  const selectedUsdConversionRate = Number(selectedUsdConversionCurrency?.exchangeRate || 0)
  const usdAmountValue = Number(usdConversion.usdAmount || 0)
  const usdMasterRow = resolveCurrencyRowByCode(currencies, 'USD', erpBaseCurrencyCode)
  const basePerUsd = Number(usdMasterRow?.exchangeRate || 0)
  const usdToTargetAmount = (() => {
    if (!Number.isFinite(usdAmountValue) || usdAmountValue < 0) return 0
    if (!selectedUsdConversionCurrency || selectedUsdConversionRate <= 0) return 0
    const targetCode = String(usdConversion.targetCode || '').toUpperCase()
    if (targetCode === 'USD') return usdAmountValue
    if (erpBaseCurrencyCode === 'USD') {
      return usdAmountValue / selectedUsdConversionRate
    }
    if (!Number.isFinite(basePerUsd) || basePerUsd <= 0) return 0
    const baseAmount = usdAmountValue * basePerUsd
    return baseAmount / selectedUsdConversionRate
  })()
  const inventoryMappingProducts = inventoryProducts.filter((item) => String(item?.category || '').includes('mainStock=') && !String(item?.category || '').includes('recordType=product'))
  const inventoryCatalogProducts = inventoryProducts.filter((item) => String(item?.category || '').includes('recordType=product'))
  const legacyInventoryProducts = inventoryProducts.filter((item) => !String(item?.category || '').includes('mainStock=') && !String(item?.category || '').includes('recordType=product'))
  const inventoryReportProducts = useMemo(() => {
    const catalog = inventoryProducts.filter((item) => String(item?.category || '').includes('recordType=product'))
    const legacy = inventoryProducts.filter((item) => !String(item?.category || '').includes('mainStock=') && !String(item?.category || '').includes('recordType=product'))
    return [...catalog, ...legacy]
  }, [inventoryProducts])
  const inventoryReportRows = useMemo(() => {
    if (activeTab !== 'inventory') return []
    return inventoryReportProducts.map((item) => {
    const categoryMeta = decodeInventoryCategoryMeta(item.category)
    const productMeta = decodeInventoryCategoryPairs(item.category)
    const quantity = Math.max(0, Number(item.quantity || 0))
    const metalName = productMeta.mainStock || productMeta.metalType || categoryMeta.mainStock || categoryMeta.metalType || ''
    const priceUnit = categoryMeta.priceUnit || productMeta.priceUnit || 'OZ'
    const storedUnitCost = Number(item.unitCost || 0)
    const unitCost = resolveInventoryValuationUnitCost(storedUnitCost, metalName, erpLiveMetalSnapshot, priceUnit)
    const usesLivePrice = unitCost !== storedUnitCost && unitCost > 0
    const stockValue = quantity * unitCost
    const minThreshold = Number(item.minThreshold || 0)
    const metal = titleCaseWords(productMeta.mainStock || productMeta.metalType || categoryMeta.mainStock || categoryMeta.metalType || 'Unmapped')
    const categoryName = productMeta.productCategory || titleCaseWords(productMeta.mainStock || productMeta.metalType || categoryMeta.mainStock || categoryMeta.metalType || item.name)
    const weight = Number(productMeta.grossWeight || productMeta.weight || item.weight || 0)
    const purity = productMeta.productPurity || productMeta.purity || categoryMeta.purity || ''
    const purityNumeric = Number(purity || 0)
    const purityFactor = purityNumeric > 1.2 ? purityNumeric / 1000 : purityNumeric
    const purityWeight = Number(productMeta.purityWeight || 0)
    const pureStockQty = Number.isFinite(purityFactor) && purityFactor > 0
      ? quantity * purityFactor
      : quantity
    const isZeroStock = quantity <= 0
    const isBelowMinStock = minThreshold > 0 && quantity <= minThreshold
    return {
      item,
      categoryMeta,
      productMeta,
      quantity,
      unitCost,
      storedUnitCost,
      usesLivePrice,
      stockValue,
      minThreshold,
      metal,
      categoryName,
      weight,
      purity,
      purityWeight,
      pureStockQty,
      stockUnit: item.unit || 'units',
      isZeroStock,
      isLowStock: isZeroStock || isBelowMinStock,
    }
    })
  }, [activeTab, inventoryReportProducts, erpLiveMetalSnapshot])
  const inventoryTotalQuantity = inventoryReportRows.reduce((sum, row) => sum + row.quantity, 0)
  const inventoryTotalValue = inventoryReportRows.reduce((sum, row) => sum + row.stockValue, 0)
  const inventoryLowStockCount = inventoryReportRows.filter((row) => row.isLowStock).length
  const inventoryTopProducts = [...inventoryReportRows]
    .sort((a, b) => b.stockValue - a.stockValue)
    .slice(0, 5)
  const inventoryMetalBreakdown = Object.values(inventoryReportRows.reduce((groups, row) => {
    const key = row.metal || 'Unmapped'
    if (!groups[key]) {
      groups[key] = {
        metal: key,
        productCount: 0,
        totalQty: 0,
        totalValue: 0,
        lowStockCount: 0,
      }
    }
    groups[key].productCount += 1
    groups[key].totalQty += row.quantity
    groups[key].totalValue += row.stockValue
    groups[key].lowStockCount += row.isLowStock ? 1 : 0
    return groups
  }, {})).sort((a, b) => b.totalValue - a.totalValue)
  const inventoryStockTypeOptions = inventoryMappingProducts.map((item) => {
    const meta = decodeInventoryCategoryMeta(item.category)
    return {
      id: item._id,
      label: titleCaseWords(meta.mainStock || meta.metalType || item.name),
      category: item.category,
      mainStock: titleCaseWords(meta.mainStock || meta.metalType || item.name),
      purity: meta.purity || '',
    }
  })
  const fixingRegisterStockTypeOptions = useFixingRegisterStockTypeOptions({
    inventoryMappingProducts,
    inventoryCatalogProducts,
  })
  const selectedInventoryStockType = inventoryStockTypeOptions.find((item) => item.id === inventoryProductForm.stockTypeId) || null
  const inventoryPurityFactorRaw = Number(inventoryProductForm.purity || 0)
  const inventoryPurityFactor = inventoryPurityFactorRaw > 1 ? inventoryPurityFactorRaw / 1000 : inventoryPurityFactorRaw
  const inventoryProductPurityWeight = (Number(inventoryProductForm.weight || 0) || 0) * (Number.isFinite(inventoryPurityFactor) ? inventoryPurityFactor : 0)
  const inventoryProductsByMetal = inventoryReportRows.reduce((groups, row) => {
    const metalKey = row.metal || 'Unmapped'
    if (!groups[metalKey]) groups[metalKey] = []
    groups[metalKey].push({ item: row.item, meta: row.productMeta, row })
    return groups
  }, {})
  const inventoryTableRows = inventoryReportRows.map((row) => {
    const { item, categoryMeta, productMeta } = row
    const rawVatPercent = Number(productMeta.vatPercent)
    const vatPercent = Number.isFinite(rawVatPercent) ? Number(rawVatPercent.toFixed(2)) : null
    return { item, categoryMeta, productMeta, vatPercent, reportRow: row }
  })
  const filteredInventoryTableRows = inventoryTableRows.filter((row) => {
    if (inventoryVatFilter === 'with-vat') return (row.vatPercent ?? 0) > 0
    if (inventoryVatFilter === 'zero-or-blank') return row.vatPercent === null || row.vatPercent === 0
    return true
  })
  const sortedInventoryTableRows = [...filteredInventoryTableRows].sort((a, b) => {
    if (inventoryVatSortDir === 'none') return 0
    const aVat = a.vatPercent ?? -1
    const bVat = b.vatPercent ?? -1
    if (inventoryVatSortDir === 'asc') return aVat - bVat
    return bVat - aVat
  })
  const availableTransactionTypes = getAvailableTransactionTypes(user, user?.company || user?.tenant?.key || user?.tenant?.name)
  const selectedTransaction = transactions.find((tx) => tx._id === selectedTransactionId) || null
  const {
    goldPriceUSD,
    silverPriceUSD,
    rawStatementEntries,
    baseCurrencyCode,
    statementSelectedMetalCode,
    resolvePreferredStatementMetalCode,
    statementDisplayCurrency,
    statementFilterCurrencyOptions,
    statementDisplayCurrencyOptions,
    statementMetalOptions,
    statementReferenceTypes,
    statementDepartments,
    filteredStatementEntries,
    modalPositionRows,
    formatStatementValue,
    formatStatementNullableValue,
    getSignedColor,
    convertStatementDisplayAmount,
    resolveStatementReceiptNo,
    resolveMetalCode,
    pureWeightRunningByEntryKey,
    formatStatementDate,
    recentPaymentReceiptEntry,
    unfixedMetalEntries,
    fixedMetalSummary,
    unfixedMetalSummary,
    unknownFixMetalEntries,
    modalTotalFundsDisplay,
    modalRevaluationDisplay,
    modalNetEquityDisplay,
    modalMarginAmtDisplay,
    modalExcessDisplay,
    modalMarginPctDisplay,
    enquirySuppressMetalSpotMtm,
  } = useAccountEnquiryStatement({
    activeTab,
    showEnquiryModal,
    accountEnquiryData,
    statementFilters,
    statementMetalCommodityEnabled,
    erpLiveMetalSnapshot,
    metalRates,
    erpBaseCurrencyCode,
    currencies,
    inventoryStockTypeOptions,
    convertJvAmount,
  })
  const {
    customerMarginSearch,
    setCustomerMarginSearch,
    customerMarginCompactView,
    setCustomerMarginCompactView,
    customerMarginSort,
    setCustomerMarginSort,
    customerMarginContextMenu,
    setCustomerMarginContextMenu,
    customerMarginRows,
    handleCustomerMarginRowContextMenu,
  } = useErpCustomerMargin({
    activeTab,
    customers,
    goldPriceUSD,
    silverPriceUSD,
    liveRecalcEnabled: activeTab === 'customer-margin' && (goldPriceUSD > 0 || silverPriceUSD > 0),
  })
  const {
    supplierMarginSearch,
    setSupplierMarginSearch,
    supplierMarginCompactView,
    setSupplierMarginCompactView,
    supplierMarginSort,
    setSupplierMarginSort,
    supplierMarginContextMenu,
    setSupplierMarginContextMenu,
    supplierMarginRows,
    handleSupplierMarginRowContextMenu,
  } = useErpSupplierMargin({ activeTab, vendors })
  useErpMarginContextMenuDismissal({
    customerMarginContextMenu,
    setCustomerMarginContextMenu,
    supplierMarginContextMenu,
    setSupplierMarginContextMenu,
  })

  const {
    enquiryModalOffset,
    enquiryModalDrag,
    beginEnquiryModalDrag,
    enquiryBackdropColor,
  } = useAccountEnquiryModalDrag(showEnquiryModal)

  const transactionPageCount = Math.max(1, Math.ceil(Number(transactionMeta.total || 0) / Number(transactionMeta.limit || 25)))
  const allVisibleTransactionsSelected = Boolean(transactions.length) && transactions.every((tx) => selectedTransactionIds.includes(tx._id))
  const {
    fixingRegPanelOffset,
    fixingRegPanelDrag,
    beginFixingRegPanelDrag,
  } = useFixingRegisterPanelDrag(activeTab)
  const { beginJvModalDrag, beginJvModalResize } = useJvModalDragResize({
    showLedgerForm,
    jvModalDrag,
    setJvModalDrag,
    jvModalOffset,
    setJvModalOffset,
    jvModalResize,
    setJvModalResize,
    jvModalSize,
    setJvModalSize,
    jvModalDefaultSize: JV_MODAL_DEFAULT_SIZE,
  })
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ENQUIRY_DETAILS_PANEL_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') return
      setDetailsPanel((prev) => ({
        ...prev,
        pinned: Boolean(parsed.pinned),
        floating: Boolean(parsed.floating),
        x: Number.isFinite(parsed.x) ? parsed.x : prev.x,
        y: Number.isFinite(parsed.y) ? parsed.y : prev.y,
        width: Number.isFinite(parsed.width) ? parsed.width : prev.width,
        height: Number.isFinite(parsed.height) ? parsed.height : prev.height,
      }))
    } catch {
      // ignore malformed local settings
    }
  }, [])
  useEffect(() => {
    localStorage.setItem(ENQUIRY_DETAILS_PANEL_STORAGE_KEY, JSON.stringify(detailsPanel))
  }, [detailsPanel])
  useEffect(() => {
    setStatementAuditPreferenceReady(false)
    try {
      const raw = localStorage.getItem(statementAuditPreferenceKey)
      setShowStatementAuditIds(raw === '1')
    } catch {
      setShowStatementAuditIds(false)
    } finally {
      setStatementAuditPreferenceReady(true)
    }
  }, [statementAuditPreferenceKey])
  useEffect(() => {
    if (!statementAuditPreferenceReady) return
    try {
      localStorage.setItem(statementAuditPreferenceKey, showStatementAuditIds ? '1' : '0')
    } catch {
      // ignore local preference save errors
    }
  }, [statementAuditPreferenceReady, statementAuditPreferenceKey, showStatementAuditIds])
  useEffect(() => {
    try {
      const raw = localStorage.getItem(inventoryStockCodeSettingsKey)
      if (!raw) {
        setInventoryStockCodeSettings(DEFAULT_INVENTORY_STOCK_CODE_SETTINGS)
        return
      }
      const parsed = JSON.parse(raw)
      const format = parsed?.format === 'prefix-metal-purity' ? 'prefix-metal-purity' : 'metal-purity'
      const prefix = String(parsed?.prefix || DEFAULT_INVENTORY_STOCK_CODE_SETTINGS.prefix)
      setInventoryStockCodeSettings({ format, prefix })
    } catch {
      setInventoryStockCodeSettings(DEFAULT_INVENTORY_STOCK_CODE_SETTINGS)
    }
  }, [inventoryStockCodeSettingsKey])
  useEffect(() => {
    try {
      localStorage.setItem(inventoryStockCodeSettingsKey, JSON.stringify(inventoryStockCodeSettings))
    } catch {
      // ignore local preference save errors
    }
  }, [inventoryStockCodeSettingsKey, inventoryStockCodeSettings])
  const loadAccounts = async (params = {}) => {
    const isSummaryScope = params.scope === 'summary'
    if (!canLoadReferenceData && !(isSummaryScope && canViewBalanceEnquiry)) return
    const tenantKey = user?.tenant || user?.company || 'default'
    if (isSummaryScope) {
      const cached = readSummaryAccountsCache(tenantKey)
      if (Array.isArray(cached) && cached.length) {
        const normalized = filterActiveAccounts(cached)
          .filter((item) => item?._id && String(item?.accountCode || '').trim())
          .map((item) => ({ ...item, accountCode: String(item.accountCode).trim() }))
        setSummaryAccounts(normalized)
        setSummaryAccountsLoading(false)
      } else {
        setSummaryAccountsLoading(true)
      }
    } else {
      setAccountsLoading(true)
    }
    try {
      if (isSummaryScope) {
        const data = await erpAccountingAPI.getAccounts(token, { ...params, page: 1, limit: 5000 })
        const rows = filterActiveAccounts(data.accounts || [])
        const uniqueById = new Map()
        rows.forEach((item) => {
          const code = String(item?.accountCode || '').trim()
          if (item?._id && code) uniqueById.set(item._id, { ...item, accountCode: code })
        })
        const next = Array.from(uniqueById.values())
        setSummaryAccounts(next)
        writeSummaryAccountsCache(tenantKey, next)
      } else {
        const pageSize = 500
        let page = 1
        let total = Number.POSITIVE_INFINITY
        let collected = []
        while (collected.length < total) {
          const data = await erpAccountingAPI.getAccounts(token, { ...params, page, limit: pageSize })
          const rows = data.accounts || []
          collected = collected.concat(rows)
          total = Number(data.total || collected.length)
          if (!rows.length) break
          page += 1
        }
        setAccounts(filterActiveAccounts(collected))
      }
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || `Failed to load ${isSummaryScope ? 'account summary options' : 'accounts'}`)
    }
    if (isSummaryScope) setSummaryAccountsLoading(false)
    else setAccountsLoading(false)
  }
  const formatSummaryAccountLabel = (account) => {
    const code = String(account?.accountCode || '').trim()
    const name = String(account?.accountName || '').trim()
    const type = String(account?.accountType || '').trim()
    return [code, name, type].filter(Boolean).join(' - ')
  }
  const resolveAccountEnquiryCodeInput = (input) => {
    const cleanInput = String(input || '').trim()
    if (!cleanInput) return ''
    const exactAccount = safeSummaryAccounts.find((account) => String(account?.accountCode || '').trim().toLowerCase() === cleanInput.toLowerCase())
    if (exactAccount?.accountCode) return String(exactAccount.accountCode).trim()
    const matchedLabel = safeSummaryAccounts.find((account) => formatSummaryAccountLabel(account).toLowerCase() === cleanInput.toLowerCase())
    if (matchedLabel?.accountCode) return String(matchedLabel.accountCode).trim()
    const labelPrefixMatch = cleanInput.match(/^([^\s-][^-]*?)(?:\s*-\s*.*)?$/)
    const candidateCode = String(labelPrefixMatch?.[1] || cleanInput).trim()
    return candidateCode
  }
  const groupedSummaryAccounts = useMemo(() => safeSummaryAccounts
    .slice()
    .sort((a, b) => {
      const aType = String(a.accountType || '').trim()
      const bType = String(b.accountType || '').trim()
      const aTypeIndex = ACCOUNT_TYPE_ORDER.indexOf(aType)
      const bTypeIndex = ACCOUNT_TYPE_ORDER.indexOf(bType)
      const normalizedATypeIndex = aTypeIndex === -1 ? ACCOUNT_TYPE_ORDER.length : aTypeIndex
      const normalizedBTypeIndex = bTypeIndex === -1 ? ACCOUNT_TYPE_ORDER.length : bTypeIndex
      const typeCompare = normalizedATypeIndex - normalizedBTypeIndex
      if (typeCompare !== 0) return typeCompare
      return String(a.accountCode || '').localeCompare(String(b.accountCode || ''))
    })
    .reduce((groups, account) => {
      const type = String(account.accountType || 'Other').trim() || 'Other'
      const existingGroup = groups.find((group) => group.type === type)
      if (existingGroup) existingGroup.accounts.push(account)
      else groups.push({ type, accounts: [account] })
      return groups
    }, []), [safeSummaryAccounts])
  const entryAccountOptions = useMemo(() => buildEntryAccountOptions({
    accounts: safeSummaryAccounts.length ? safeSummaryAccounts : accounts,
    customers,
    vendors,
  }), [safeSummaryAccounts, accounts, customers, vendors])
  const jvComboGroups = useMemo(() => ACCOUNT_TYPE_ORDER
    .map((type) => ({
      label: type,
      options: entryAccountOptions
        .filter((a) => String(a?.accountType || '').trim() === type)
        .map((a) => ({ value: String(a._id), label: `${a.accountCode || ''} - ${a.accountName || ''}` })),
    }))
    .concat([{
      label: 'Other',
      options: entryAccountOptions
        .filter((a) => !ACCOUNT_TYPE_ORDER.includes(String(a?.accountType || '').trim()))
        .map((a) => ({ value: String(a._id), label: `${a.accountCode || ''} - ${a.accountName || ''}` })),
    }])
    .filter((g) => g.options.length > 0), [entryAccountOptions])
  const isBankJvEligibleAccount = (account) => {
    const code = String(account?.accountCode || '').trim().toUpperCase()
    const name = String(account?.accountName || '').trim().toUpperCase()
    const type = String(account?.accountType || '').trim().toUpperCase()
    if (!code && !name) return false
    if (code === '1000' || name.includes('CASH ON HAND')) return true
    if (code === '4190' || name.includes('EXCHANGE GAIN')) return true
    if (code === '5190' || name.includes('EXCHANGE LOSS')) return true
    if (type.includes('BANK')) return true
    if (name.includes('BANK')) return true
    return /^101\d{0,3}$/.test(code)
  }
  const bankJvEntryAccountOptions = entryAccountOptions.filter(isBankJvEligibleAccount)
  const bankJvComboGroups = ACCOUNT_TYPE_ORDER
    .map((type) => ({
      label: type,
      options: bankJvEntryAccountOptions
        .filter((a) => String(a?.accountType || '').trim() === type)
        .map((a) => ({ value: String(a._id), label: `${a.accountCode || ''} - ${a.accountName || ''}` })),
    }))
    .concat([{
      label: 'Other',
      options: bankJvEntryAccountOptions
        .filter((a) => !ACCOUNT_TYPE_ORDER.includes(String(a?.accountType || '').trim()))
        .map((a) => ({ value: String(a._id), label: `${a.accountCode || ''} - ${a.accountName || ''}` })),
    }])
    .filter((g) => g.options.length > 0)
  const inferJvAccountCurrency = (accountId) => {
    const account = entryAccountOptions.find((item) => String(item?._id) === String(accountId || ''))
    if (!account) return erpBaseCurrencyCode
    const explicitCurrency = normalizeJvCurrencyCode(account.currency || account.currencyCode || '')
    if (explicitCurrency) return explicitCurrency
    const hint = `${String(account.accountCode || '').toUpperCase()} ${String(account.accountName || '').toUpperCase()}`
    if (hint.includes('USD')) return 'USD'
    if (hint.includes('UZS') || hint.includes('SOMS') || hint.includes('SOM')) return 'UZS'
    return erpBaseCurrencyCode
  }
  useEffect(() => {
    setJvHeader((prev) => {
      const nextCurrency = prev.currency || baseCurrencyCode
      return prev.currency === nextCurrency ? prev : { ...prev, currency: nextCurrency }
    })
  }, [baseCurrencyCode])
  const filteredGroupedSummaryAccounts = groupedSummaryAccounts
    .map((group) => {
      const lookup = String(accountEnquiryCode || '').trim().toLowerCase()
      if (!lookup) return group
      const filteredAccounts = group.accounts.filter((account) => (
        [account.accountCode, account.accountName, account.accountType]
          .some((value) => String(value || '').toLowerCase().includes(lookup))
      ))
      return { ...group, accounts: filteredAccounts }
    })
    .filter((group) => group.accounts.length > 0)
  const loadLedger = async (options = {}) => {
    if (!canViewLedger) return
    setLedgerLoading(true)
    try {
      const hasCursorOverride = Object.prototype.hasOwnProperty.call(options, 'cursor')
      const cursor = hasCursorOverride ? options.cursor : null
      const cursorHistory = Array.isArray(options.cursorHistory) ? options.cursorHistory : (cursor ? ledgerMeta.cursorHistory || [] : [])
      const ledgerQuery = {
        limit: 100,
        ...ledgerFilters,
        referenceType: ledgerFilters.referenceType || ledgerVoucherTab,
        ...(cursor ? { cursor } : {}),
      }
      const [ledgerData, accountData, currencyData, mappingData] = await Promise.all([
        erpAccountingAPI.getLedger(token, ledgerQuery),
        canLoadReferenceData ? erpAccountingAPI.getAccounts(token) : Promise.resolve(null),
        canLoadReferenceData ? erpAccountingAPI.getCurrencies(token) : Promise.resolve(null),
        canViewMappings ? erpAccountingAPI.getMappings(token) : Promise.resolve(null),
      ])
      setLedger(ledgerData.entries || [])
      setLedgerMeta({
        cursor: ledgerData.cursor || cursor || null,
        nextCursor: ledgerData.nextCursor || null,
        hasMore: Boolean(ledgerData.hasMore),
        cursorHistory,
      })
      if (accountData) setAccounts(filterActiveAccounts(accountData.accounts || []))
      if (currencyData) setCurrencies(currencyData.currencies || [])
      if (mappingData) setMappings(mappingData.mappings || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load ledger')
    }
    setLedgerLoading(false)
  }
  const loadReportBranding = async (brandingKey = selectedBrandingKey || DEFAULT_BRANDING.key) => {
    try {
      const data = await erpAccountingAPI.getReportBranding(token, { key: brandingKey })
      const branding = { ...DEFAULT_BRANDING, ...(data.branding || {}) }
      setBrandingProfiles(data.profiles?.length ? data.profiles : DEFAULT_BRANDING_PROFILES)
      setSelectedBrandingKey(data.selectedKey || branding.key || DEFAULT_BRANDING.key)
      setReportBranding(branding)
      setBrandingForm(branding)
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load report branding')
    }
  }
  const loadAllVendors = async (baseFilters = {}) => {
    const pageSize = 100
    let page = 1
    let total = Number.POSITIVE_INFINITY
    let merged = []
    let permissions = { canManage: false, canUpdateOperational: false }
    while (merged.length < total) {
      const data = await erpAccountingAPI.getVendors(token, { ...baseFilters, page, limit: pageSize })
      const rows = data.vendors || []
      merged = merged.concat(rows)
      total = Number(data.total || merged.length)
      permissions = data.permissions || permissions
      if (!rows.length) break
      page += 1
    }
    const uniqueById = new Map()
    merged.forEach((item) => {
      if (item?._id) uniqueById.set(item._id, item)
    })
    const vendors = Array.from(uniqueById.values())
    const summaryTotals = vendors.reduce((acc, row) => {
      acc.count += 1
      acc.outstanding += Number(row.outstanding || 0)
      acc.overLimit += row.isOverLimit ? 1 : 0
      acc.blacklisted += row.status === 'blacklisted' ? 1 : 0
      acc.onHold += row.status === 'on_hold' ? 1 : 0
      acc.nonCompliant += row.compliance?.compliant ? 0 : 1
      return acc
    }, { count: 0, outstanding: 0, overLimit: 0, blacklisted: 0, onHold: 0, nonCompliant: 0 })
    return {
      vendors,
      permissions,
      summary: {
        totalVendors: summaryTotals.count,
        totalOutstanding: Number(summaryTotals.outstanding.toFixed(2)),
        overLimit: summaryTotals.overLimit,
        blacklisted: summaryTotals.blacklisted,
        onHold: summaryTotals.onHold,
        nonCompliant: summaryTotals.nonCompliant,
      },
    }
  }
  const transactionReferenceLoadedRef = useRef(false)
  const loadTransactionReferenceData = useCallback(async () => {
    if (transactionReferenceLoadedRef.current) return
    transactionReferenceLoadedRef.current = true
    try {
      const [customerData, vendorData, inventoryData, mappingData, accountData, currencyData] = await Promise.all([
        canLoadParties ? erpAccountingAPI.getCustomers(token) : Promise.resolve(null),
        canLoadParties ? loadAllVendors({ includeInactive: false }) : Promise.resolve(null),
        canLoadInventoryData ? erpAccountingAPI.getInventoryProducts(token) : Promise.resolve(null),
        canViewMappings ? erpAccountingAPI.getMappings(token) : Promise.resolve(null),
        canLoadReferenceData ? erpAccountingAPI.getAccounts(token, { page: 1, limit: 5000 }) : Promise.resolve(null),
        canLoadReferenceData ? erpAccountingAPI.getCurrencies(token) : Promise.resolve(null),
      ])
      if (customerData) setCustomers(customerData.customers || [])
      if (vendorData) setVendors(vendorData.vendors || [])
      if (inventoryData) setInventoryProducts(inventoryData.products || [])
      if (mappingData) setMappings(mappingData.mappings || [])
      if (accountData) setAccounts(filterActiveAccounts(accountData.accounts || []))
      if (currencyData) setCurrencies(currencyData.currencies || [])
    } catch {
      transactionReferenceLoadedRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- loadAllVendors is stable enough for reference bootstrap
  }, [token, canLoadParties, canLoadInventoryData, canViewMappings, canLoadReferenceData])
  const loadTransactions = async (overrides = {}) => {
    if (!(canAccessTransactions || canAccessVouchers || canAccessFixingRegister)) return
    setTransactionsLoading(true)
    try {
      const hasCursorOverride = Object.prototype.hasOwnProperty.call(overrides, 'cursor')
      const cursor = hasCursorOverride ? overrides.cursor : null
      const cursorHistory = Array.isArray(overrides.cursorHistory)
        ? overrides.cursorHistory
        : (cursor ? transactionMeta.cursorHistory || [] : [])
      const params = {
        limit: overrides.limit || transactionMeta.limit,
        ...(cursor ? { cursor } : {}),
        ...((overrides.search ?? transactionFilters.search) ? { search: overrides.search ?? transactionFilters.search } : {}),
        ...((overrides.status ?? transactionFilters.status) ? { status: overrides.status ?? transactionFilters.status } : {}),
        ...((overrides.type ?? transactionFilters.type) ? { type: overrides.type ?? transactionFilters.type } : {}),
        ...((overrides.startDate ?? transactionFilters.startDate) ? { startDate: overrides.startDate ?? transactionFilters.startDate } : {}),
        ...((overrides.endDate ?? transactionFilters.endDate) ? { endDate: overrides.endDate ?? transactionFilters.endDate } : {}),
      }
      if (!hasCursorOverride && overrides.page) {
        params.page = overrides.page
      }
      const data = await erpAccountingAPI.getTransactions(token, params)
      setTransactions(data.transactions || [])
      setTransactionSummary(data.summary || { totalCount: 0, totalAmount: 0, draft: 0, submitted: 0, approved: 0, posted: 0, returned: 0, rejected: 0 })
      setTransactionMeta((prev) => ({
        ...prev,
        page: data.page || params.page || prev.page,
        limit: data.limit || params.limit || prev.limit,
        total: Number(data.total || 0),
        cursor: data.cursor || cursor || null,
        nextCursor: data.nextCursor || null,
        hasMore: Boolean(data.hasMore),
        cursorHistory,
      }))
      setError('')
      void loadTransactionReferenceData()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load transactions')
    }
    setTransactionsLoading(false)
  }
  const {
    transactionForm,
    setTransactionForm,
    editingTransactionId,
    setEditingTransactionId: _setEditingTransactionId,
    isTransactionEditMode,
    resetTransactionComposer,
    populateTransactionForm,
    getTransactionValidationMessage: _getTransactionValidationMessage,
    handleCreateTransaction,
  } = useTransactionComposer({
    baseCurrencyCode,
    customers,
    vendors,
    currencies,
    token,
    loadTransactionReferenceData,
    loadTransactions,
    setError,
    setSaving,
    setSelectedTransactionId,
    showNotification,
    erpAccountingAPI,
  })
  const toggleTransactionSelection = (id) => {
    setSelectedTransactionIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id])
  }
  const toggleVisibleTransactionSelection = () => {
    setSelectedTransactionIds((prev) => {
      if (allVisibleTransactionsSelected) {
        return prev.filter((id) => !transactions.some((tx) => tx._id === id))
      }
      return Array.from(new Set([...prev, ...transactions.map((tx) => tx._id)]))
    })
  }
  const loadVendors = async (filters = vendorFilters) => {
    if (!canLoadParties) return
    setVendorsLoading(true)
    try {
      const data = await loadAllVendors(filters)
      setVendors(data.vendors || [])
      setVendorSummary(data.summary || { totalVendors: 0, totalOutstanding: 0, overLimit: 0, blacklisted: 0, onHold: 0, nonCompliant: 0 })
      setVendorPermissions(data.permissions || { canManage: false, canUpdateOperational: false })
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load vendors')
    }
    setVendorsLoading(false)
  }
  const loadVendorDetails = useCallback(async (id) => {
    if (!id) {
      setSelectedVendorDetails(null)
      return
    }
    try {
      const data = await erpAccountingAPI.getVendorDetails(token, id)
      setSelectedVendorDetails(data)
      if (data.permissions) setVendorPermissions(data.permissions)
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load vendor details')
    }
  }, [token])
  const loadVendorPaymentCalendar = async () => {
    try {
      const data = await erpAccountingAPI.getVendorPaymentCalendar(token, { horizonDays: 45 })
      setVendorPaymentCalendar({ rows: data.rows || [], alerts: data.alerts || { overdue: 0, due_soon: 0, upcoming: 0, later: 0, totalDue: 0 } })
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load vendor payment calendar')
    }
  }
  const loadVendorComplianceSummary = async () => {
    try {
      const data = await erpAccountingAPI.getVendorComplianceSummary(token)
      setVendorComplianceSummary({
        summary: data.summary || { total: 0, nonCompliant: 0, avgComplianceScore: 0 },
        expiryBuckets: data.expiryBuckets || { expired: 0, warning30: 0, warning60: 0, warning90: 0 },
        atRisk: data.atRisk || [],
      })
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load vendor compliance summary')
    }
  }
  const loadVendorOverdueQueue = async () => {
    try {
      const data = await erpAccountingAPI.getVendorOverdueAlertQueue(token, { horizonDays: 120 })
      setVendorOverdueQueue({
        summary: data.summary || { total: 0, withRecipient: 0, critical: 0, totalAmountDue: 0 },
        queue: data.queue || [],
      })
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load overdue alert queue')
    }
  }
  const loadInventory = async () => {
    if (!canLoadInventoryData) return
    setInventoryLoading(true)
    try {
      const productsData = await erpAccountingAPI.getInventoryProducts(token)
      setInventoryProducts(productsData.products || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load inventory')
    }
    setInventoryLoading(false)
  }
  const loadStockLedger = async () => {
    if (!canLoadInventoryData) return
    setStockMovementsLoading(true)
    try {
      const data = await erpAccountingAPI.getStockLedger(token)
      setStockMovements(data.movements || [])
    } catch {
      setStockMovements([])
    } finally {
      setStockMovementsLoading(false)
    }
  }
  const buildReportDateRange = () => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    let startDate = ''
    let endDate = ''
    if (reportFilters.period === 'today') {
      startDate = now.toISOString().slice(0, 10)
      endDate = startDate
    } else if (reportFilters.period === 'month') {
      startDate = startOfMonth.toISOString().slice(0, 10)
      endDate = endOfMonth.toISOString().slice(0, 10)
    } else if (reportFilters.period === 'ytd') {
      startDate = startOfYear.toISOString().slice(0, 10)
      endDate = now.toISOString().slice(0, 10)
    } else if (reportFilters.period === 'custom') {
      startDate = reportFilters.startDate || ''
      endDate = reportFilters.endDate || ''
    }
    return {
      startDate,
      endDate,
      commonRange: {
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      },
    }
  }
  const loadReports = async (targetView = reportView) => {
    if (!canAccessReports) return
    setReportsLoading(true)
    try {
      const { endDate, commonRange } = buildReportDateRange()
      const updates = {}

      if (targetView === 'summary' || targetView === 'trial') {
        const includeZero = targetView === 'summary' ? false : reportFilters.includeZeroAccounts
        updates.trialBalance = await erpAccountingAPI.getTrialBalance(token, {
          ...commonRange,
          ...(reportFilters.accountType ? { accountType: reportFilters.accountType } : {}),
          includeZero,
          sortBy: reportFilters.sortBy,
          sortDir: reportFilters.sortDir,
        })
      }
      if (targetView === 'pnl') {
        updates.profitLoss = await erpAccountingAPI.getProfitLossReport(token, {
          ...commonRange,
          includeZero: reportFilters.includeZeroAccounts,
          comparePrevious: reportFilters.comparePrevious,
        })
      }
      if (targetView === 'balanceSheet') {
        updates.balanceSheet = await erpAccountingAPI.getBalanceSheetReport(token, {
          ...(endDate ? { endDate } : {}),
        })
      }
      if (targetView === 'dayBook') {
        updates.dayBook = await erpAccountingAPI.getDayBookReport(token, {
          ...commonRange,
          ...(reportFilters.referenceType ? { referenceType: reportFilters.referenceType } : {}),
          ...(reportFilters.minAmount ? { minAmount: reportFilters.minAmount } : {}),
        })
      }
      if (targetView === 'outstanding') {
        const [custOut, venOut] = await Promise.all([
          erpAccountingAPI.getCustomerOutstandingReport(token),
          erpAccountingAPI.getVendorOutstandingReport(token),
        ])
        updates.customerOutstanding = custOut
        updates.vendorOutstanding = venOut
      }
      if (targetView === 'forex') {
        updates.forex = await erpAccountingAPI.getForexGainLossReport(token, commonRange)
      }

      setReports((prev) => ({ ...prev, ...updates }))
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load reports')
    }
    setReportsLoading(false)
  }
  const loadLedgerReport = async (accountId) => {
    if (!accountId) {
      setLedgerReportRows([])
      return
    }
    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      let startDate = ''
      let endDate = ''
      if (reportFilters.period === 'today') {
        startDate = now.toISOString().slice(0, 10)
        endDate = startDate
      } else if (reportFilters.period === 'month') {
        startDate = startOfMonth.toISOString().slice(0, 10)
        endDate = endOfMonth.toISOString().slice(0, 10)
      } else if (reportFilters.period === 'ytd') {
        startDate = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10)
        endDate = now.toISOString().slice(0, 10)
      } else if (reportFilters.period === 'custom') {
        startDate = reportFilters.startDate || ''
        endDate = reportFilters.endDate || ''
      }
      const data = await erpAccountingAPI.getLedgerReport(token, {
        accountId,
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      })
      setLedgerReportRows(data.report || [])
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load ledger report')
    }
  }
  const handleDeleteTransaction = async (id) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this transaction?')) return
    try {
      setSaving(true)
      await erpAccountingAPI.deleteTransaction(token, id)
      if (selectedTransactionId === id) setSelectedTransactionId('')
      if (editingTransactionId === id) resetTransactionComposer()
      setSelectedTransactionIds((prev) => prev.filter((item) => item !== id))
      await loadTransactions()
      showNotification('✅ Transaction deleted')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete transaction')
    } finally {
      setSaving(false)
    }
  }
  const handleTransactionAction = async (action, id) => {
    try {
      setSaving(true)
      if ((action === 'return' || action === 'reject') && !transactionWorkflowNote.trim()) {
        setError(action === 'return' ? 'Return reason is required' : 'Rejection reason is required')
        setSaving(false)
        return
      }
      const payload = {
        comment: transactionWorkflowNote,
        ...(transactionForm.debitAccountId ? { debitAccountId: transactionForm.debitAccountId } : {}),
        ...(transactionForm.creditAccountId ? { creditAccountId: transactionForm.creditAccountId } : {}),
      }
      if (action === 'submit') await erpAccountingAPI.submitTransaction(token, id, payload)
      if (action === 'approve') await erpAccountingAPI.approveTransaction(token, id, payload)
      if (action === 'return') await erpAccountingAPI.returnTransaction(token, id, payload)
      if (action === 'reject') await erpAccountingAPI.rejectTransaction(token, id, payload)
      if (action === 'post') await erpAccountingAPI.postTransaction(token, id, payload)
      await Promise.all([loadTransactions(), loadDashboard()])
      setTransactionWorkflowNote('')
      showNotification(`✅ Transaction ${action === 'submit' ? 'submitted' : action === 'approve' ? 'approved' : action === 'return' ? 'returned for edit' : action === 'reject' ? 'rejected' : 'posted'}`)
    } catch (e) {
      setError(e.response?.data?.message || `Failed to ${action} transaction`)
    } finally {
      setSaving(false)
    }
  }
  const handleAddTransactionComment = async () => {
    if (!selectedTransactionId) {
      setError('Select a transaction first')
      return
    }
    if (!transactionCommentDraft.trim()) {
      setError('Enter a comment first')
      return
    }
    try {
      setSaving(true)
      await erpAccountingAPI.addTransactionComment(token, selectedTransactionId, { message: transactionCommentDraft })
      await loadTransactions()
      setTransactionCommentDraft('')
      showNotification('✅ Transaction comment added')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to add transaction comment')
    } finally {
      setSaving(false)
    }
  }
  const handleSendTransactionChat = async (transactionId, message, mentionedNames = []) => {
    if (!transactionId) {
      setError('Select a transaction first')
      return false
    }
    if (!String(message || '').trim()) {
      setError('Enter a message first')
      return false
    }
    try {
      setSaving(true)
      const data = await erpAccountingAPI.addTransactionComment(token, transactionId, {
        message,
        mentionedNames,
      })
      if (data.transaction) {
        setTransactions((prev) => prev.map((tx) => (tx._id === transactionId ? data.transaction : tx)))
      }
      const deliveredCount = Array.isArray(data.deliveredTo) ? data.deliveredTo.length : 0
      showNotification(deliveredCount ? `Transaction chat sent to ${deliveredCount} user${deliveredCount === 1 ? '' : 's'}` : 'Transaction note saved; no mentioned user matched')
      return true
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to send transaction chat')
      return false
    } finally {
      setSaving(false)
    }
  }
  const handleUploadTransactionAttachment = async (file, transactionId = selectedTransactionId) => {
    if (!transactionId) {
      setError('Select a transaction first')
      return
    }
    if (!file) return
    try {
      setSaving(true)
      setSelectedTransactionId(transactionId)
      await erpAccountingAPI.uploadTransactionAttachment(token, transactionId, file)
      await loadTransactions()
      setTransactionAttachmentInputKey((prev) => prev + 1)
      showNotification('✅ Attachment uploaded')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to upload attachment')
    } finally {
      setSaving(false)
    }
  }
  const handleDeleteTransactionAttachment = async (attachmentId) => {
    if (!selectedTransactionId || !attachmentId) return
    try {
      setSaving(true)
      await erpAccountingAPI.deleteTransactionAttachment(token, selectedTransactionId, attachmentId)
      await loadTransactions()
      showNotification('✅ Attachment deleted')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete attachment')
    } finally {
      setSaving(false)
    }
  }
  const handleBulkTransactionAction = async (action) => {
    if (!selectedTransactionIds.length) {
      setError('Select at least one transaction')
      return
    }
    try {
      setSaving(true)
      const response = await erpAccountingAPI.bulkTransactionAction(token, {
        ids: selectedTransactionIds,
        action,
        comment: transactionWorkflowNote,
        mappingOverride: {
          ...(transactionForm.debitAccountId ? { debitAccountId: transactionForm.debitAccountId } : {}),
          ...(transactionForm.creditAccountId ? { creditAccountId: transactionForm.creditAccountId } : {}),
        },
      })
      await Promise.all([loadTransactions(), loadDashboard()])
      setTransactionWorkflowNote('')
      setSelectedTransactionIds([])
      if (!response.failureCount) {
        const label = action === 'submit' ? 'submitted' : action === 'approve' ? 'approved' : 'posted'
        showNotification(`✅ ${response.successCount} transactions ${label}`)
      } else {
        setError(`${response.successCount} succeeded, ${response.failureCount} failed`)
      }
    } catch (e) {
      setError(e.response?.data?.message || `Failed to ${action} selected transactions`)
    } finally {
      setSaving(false)
    }
  }
  const handleCreateVendor = async (e) => {
    e.preventDefault()
    if (!canManageVendors && !editingVendorId) {
      setError('Only Admin/Finance can create vendors')
      return
    }
    if (!vendorForm.name) {
      setError('Vendor name is required')
      return
    }
    try {
      setSaving(true)
      const payload = {
        ...vendorForm,
        openingBalance: Number(vendorForm.openingBalance || 0),
        paymentTermsDays: Number(vendorForm.paymentTermsDays || 30),
        creditLimit: Number(vendorForm.creditLimit || 0),
        rating: Number(vendorForm.rating || 3),
        tags: String(vendorForm.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
      }
      if (editingVendorId) {
        await erpAccountingAPI.updateVendor(token, editingVendorId, payload)
        showNotification('✅ Vendor updated')
      } else {
        await erpAccountingAPI.createVendor(token, payload)
        showNotification('✅ Vendor created')
      }
      setVendorForm({
        vendorCode: '',
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        country: '',
        postalCode: '',
        gstVat: '',
        taxRegistrationNo: '',
        openingBalance: '',
        paymentTermsDays: '30',
        creditLimit: '',
        category: 'general',
        rating: '3',
        riskLevel: 'medium',
        status: 'active',
        notes: '',
        tags: '',
        preferredCurrency: 'USD',
        bankName: '',
        bankAccountNumber: '',
        iban: '',
        swiftCode: '',
        currency: 'USD',
      })
      setShowVendorForm(false)
      setEditingVendorId('')
      await Promise.all([
        loadVendors(vendorFilters),
        loadVendorComplianceSummary(),
      ])
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save vendor')
    } finally {
      setSaving(false)
    }
  }
  const handleVendorFilterSearch = async () => {
    await loadVendors(vendorFilters)
  }
  const handleVendorSelect = async (vendorId) => {
    setSelectedVendorId(vendorId)
    await loadVendorDetails(vendorId)
  }
  const handleEditVendor = (vendor) => {
    if (!vendorPermissions.canUpdateOperational) {
      setError('You are not allowed to edit vendors')
      return
    }
    setEditingVendorId(vendor._id)
    setShowVendorForm(true)
    setVendorForm({
      vendorCode: vendor.vendorCode || '',
      name: vendor.name || '',
      contactPerson: vendor.contactPerson || '',
      phone: vendor.phone || '',
      email: vendor.email || '',
      address: vendor.address || '',
      city: vendor.city || '',
      country: vendor.country || '',
      postalCode: vendor.postalCode || '',
      gstVat: vendor.gstVat || '',
      taxRegistrationNo: vendor.taxRegistrationNo || '',
      openingBalance: String(vendor.openingBalance || ''),
      paymentTermsDays: String(vendor.paymentTermsDays || 30),
      creditLimit: String(vendor.creditLimit || ''),
      category: vendor.category || 'general',
      rating: String(vendor.rating || 3),
      riskLevel: vendor.riskLevel || 'medium',
      status: vendor.status || 'active',
      notes: vendor.notes || '',
      tags: Array.isArray(vendor.tags) ? vendor.tags.join(', ') : '',
      preferredCurrency: vendor.preferredCurrency || vendor.currency || 'USD',
      bankName: vendor.bankName || '',
      bankAccountNumber: vendor.bankAccountNumber || '',
      iban: vendor.iban || '',
      swiftCode: vendor.swiftCode || '',
      currency: vendor.currency || 'USD',
    })
  }
  const handleDeleteVendor = async (vendor) => {
    if (!vendorPermissions.canManage) {
      setError('Only Admin/Finance can deactivate vendors')
      return
    }
    if (!window.confirm(`Deactivate vendor ${vendor.name}?`)) return
    try {
      setSaving(true)
      await erpAccountingAPI.deleteVendor(token, vendor._id)
      if (selectedVendorId === vendor._id) {
        setSelectedVendorId('')
        setSelectedVendorDetails(null)
      }
      await Promise.all([
        loadVendors(vendorFilters),
        loadVendorComplianceSummary(),
        loadVendorOverdueQueue(),
      ])
      showNotification('✅ Vendor deactivated')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to deactivate vendor')
    } finally {
      setSaving(false)
    }
  }
  const handleVendorWorkflowStatus = async (status) => {
    if (!selectedVendorId) return
    try {
      setSaving(true)
      await erpAccountingAPI.updateVendorWorkflow(token, selectedVendorId, {
        status,
        reason: vendorWorkflowReason,
      })
      setVendorWorkflowReason('')
      await Promise.all([
        loadVendors(vendorFilters),
        loadVendorDetails(selectedVendorId),
        loadVendorPaymentCalendar(),
        loadVendorComplianceSummary(),
        loadVendorOverdueQueue(),
      ])
      showNotification(`✅ Vendor moved to ${status}`)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update vendor workflow')
    } finally {
      setSaving(false)
    }
  }
  const handleAddVendorDocument = async (e) => {
    e.preventDefault()
    if (!selectedVendorId) {
      setError('Select a vendor first')
      return
    }
    if (!vendorDocumentForm.title && !vendorDocumentForm.file) {
      setError('Document title is required')
      return
    }
    try {
      setSaving(true)
      if (vendorDocumentForm.file) {
        const { file, ...payload } = vendorDocumentForm
        await erpAccountingAPI.uploadVendorDocument(token, selectedVendorId, {
          ...payload,
          title: payload.title || file.name || 'Vendor attachment',
        }, file)
      } else {
        const { file: _omitFile, ...payload } = vendorDocumentForm
        await erpAccountingAPI.addVendorDocument(token, selectedVendorId, payload)
      }
      setVendorDocumentForm({ docType: 'contract', title: '', documentNo: '', fileUrl: '', file: null, issueDate: '', expiryDate: '', status: 'active', verified: false, notes: '' })
      await Promise.all([
        loadVendorDetails(selectedVendorId),
        loadVendorComplianceSummary(),
      ])
      showNotification('✅ Vendor document added')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to add vendor document')
    } finally {
      setSaving(false)
    }
  }
  const handleVendorTableDocumentUpload = async (vendor, file) => {
    if (!vendor?._id || !file) return
    if (!vendorPermissions.canUpdateOperational) {
      setError('You are not allowed to upload vendor documents')
      return
    }
    try {
      setSaving(true)
      await erpAccountingAPI.uploadVendorDocument(token, vendor._id, {
        docType: 'other',
        title: file.name || 'Vendor attachment',
        status: 'active',
        verified: false,
      }, file)
      await Promise.all([
        loadVendors(vendorFilters),
        loadVendorComplianceSummary(),
        selectedVendorId === vendor._id ? loadVendorDetails(vendor._id) : Promise.resolve(),
      ])
      showNotification('✅ Vendor attachment uploaded')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to upload vendor attachment')
    } finally {
      setSaving(false)
    }
  }
  const handleDeleteVendorDocument = async (documentId) => {
    if (!selectedVendorId) return
    if (!window.confirm('Delete this vendor document?')) return
    try {
      setSaving(true)
      await erpAccountingAPI.deleteVendorDocument(token, selectedVendorId, documentId)
      await Promise.all([
        loadVendorDetails(selectedVendorId),
        loadVendorComplianceSummary(),
      ])
      showNotification('✅ Vendor document deleted')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete vendor document')
    } finally {
      setSaving(false)
    }
  }
  const resetInventoryMappingForm = () => {
    setEditingProductId('')
    setInventoryMappingForm(createInventoryMappingForm())
    setInventoryStockCodeManualOverride(false)
    setInventoryModalOffset({ x: 0, y: 0 })
    setInventoryModalDragging(false)
    setShowInventoryMappingModal(false)
  }
  const resetInventoryProductForm = () => {
    setEditingInventoryProductId('')
    setInventoryProductForm(createInventoryProductForm())
    setInventoryProductModalOffset({ x: 0, y: 0 })
    setInventoryProductModalDragging(false)
    setShowInventoryProductModal(false)
  }
  const stopInventoryModalDrag = () => {
    const { moveHandler, upHandler } = inventoryModalDragRef.current
    if (moveHandler) {
      window.removeEventListener('mousemove', moveHandler)
    }
    if (upHandler) {
      window.removeEventListener('mouseup', upHandler)
    }
    inventoryModalDragRef.current = { moveHandler: null, upHandler: null }
    setInventoryModalDragging(false)
  }
  const handleInventoryModalDragStart = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const originX = inventoryModalOffset.x
    const originY = inventoryModalOffset.y
    const moveHandler = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      setInventoryModalOffset({ x: originX + deltaX, y: originY + deltaY })
    }
    const upHandler = () => {
      stopInventoryModalDrag()
    }
    stopInventoryModalDrag()
    setInventoryModalDragging(true)
    inventoryModalDragRef.current = { moveHandler, upHandler }
    window.addEventListener('mousemove', moveHandler)
    window.addEventListener('mouseup', upHandler)
  }
  const stopInventoryProductModalDrag = () => {
    const { moveHandler, upHandler } = inventoryProductModalDragRef.current
    if (moveHandler) {
      window.removeEventListener('mousemove', moveHandler)
    }
    if (upHandler) {
      window.removeEventListener('mouseup', upHandler)
    }
    inventoryProductModalDragRef.current = { moveHandler: null, upHandler: null }
    setInventoryProductModalDragging(false)
  }
  const handleInventoryProductModalDragStart = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const originX = inventoryProductModalOffset.x
    const originY = inventoryProductModalOffset.y
    const moveHandler = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      setInventoryProductModalOffset({ x: originX + deltaX, y: originY + deltaY })
    }
    const upHandler = () => {
      stopInventoryProductModalDrag()
    }
    stopInventoryProductModalDrag()
    setInventoryProductModalDragging(true)
    inventoryProductModalDragRef.current = { moveHandler, upHandler }
    window.addEventListener('mousemove', moveHandler)
    window.addEventListener('mouseup', upHandler)
  }
  useEffect(() => () => {
    stopInventoryModalDrag()
    stopInventoryProductModalDrag()
  }, [])
  useEffect(() => {
    if (!showInventoryMappingModal) return
    if (isSuperAdmin && inventoryStockCodeManualOverride) return
    const baseCode = buildAutoStockCode(inventoryMappingForm, inventoryStockCodeSettings)
    const nextCode = buildUniqueStockCode(baseCode, inventoryMappingProducts, editingProductId)
    setInventoryMappingForm((prev) => (prev.stockCode === nextCode ? prev : { ...prev, stockCode: nextCode }))
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to stock-driving fields, not whole form object
  }, [showInventoryMappingModal, inventoryMappingForm.mainStock, inventoryMappingForm.customMainStock, inventoryMappingForm.metalType, inventoryMappingProducts, editingProductId, inventoryStockCodeSettings, isSuperAdmin, inventoryStockCodeManualOverride])
  const buildInventoryPayloadFromForm = (form, includeOpeningQty = true) => {
    const mainStockValue = resolveMainStockValueFromForm(form)
    const normalizedMetalType = String(form.metalType || '').trim().toLowerCase()
    const categoryMeta = encodeInventoryCategoryMeta({
      mainStock: mainStockValue,
      metalType: normalizedMetalType,
      priceUnit: form.priceUnit || 'OZ',
      priceCurrency: form.priceCurrency || 'USD',
    })
    const label = titleCaseWords(mainStockValue || normalizedMetalType || 'Main Stock')
    const autoSku = buildUniqueStockCode(buildAutoStockCode(form, inventoryStockCodeSettings), inventoryMappingProducts, editingProductId)
    const resolvedSku = isSuperAdmin
      ? (String(form.stockCode || '').trim().toUpperCase() || autoSku)
      : autoSku
    const priceValue = parseFloat(form.currentPrice) || 0
    const payload = {
      sku: resolvedSku,
      name: `${label} Main Stock`,
      category: categoryMeta,
      unit: 'grams',
      unitCost: priceValue,
      sellingPrice: priceValue,
      currency: form.priceCurrency || 'USD',
      description: priceValue > 0 ? `${priceValue} ${form.priceCurrency || 'USD'}/${form.priceUnit || 'OZ'}` : undefined,
    }
    if (includeOpeningQty) {
      payload.quantity = Number(form.openingQty || 0)
    }
    return payload
  }
  const handleCreateProduct = async (e) => {
    e.preventDefault()
    const mainStockValue = resolveMainStockValueFromForm(inventoryMappingForm)
    if (!mainStockValue) {
      setError('Main stock is required')
      return
    }
    if (!inventoryMappingForm.stockCode.trim()) {
      setError('Stock code is required')
      return
    }
    const duplicateStockCode = inventoryMappingProducts.find((item) => (
      String(item.sku || '').trim().toLowerCase() === String(inventoryMappingForm.stockCode || '').trim().toLowerCase()
      && item._id !== editingProductId
    ))
    if (duplicateStockCode) {
      setError('Stock code already exists. Use a unique stock code.')
      return
    }
    try {
      setSaving(true)
      const payload = buildInventoryPayloadFromForm(inventoryMappingForm, !editingProductId)
      if (editingProductId) {
        await erpAccountingAPI.updateInventoryProduct(token, editingProductId, payload)
        showNotification('✅ Stock mapping updated')
      } else {
        await erpAccountingAPI.createInventoryProduct(token, payload)
        showNotification('✅ Stock mapping created')
      }
      resetInventoryMappingForm()
      await loadInventory()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save stock mapping')
    } finally {
      setSaving(false)
    }
  }
  const handleEditProduct = (p) => {
    const meta = decodeInventoryCategoryMeta(p.category)
    const resolvedMainStock = meta.mainStock || meta.metalType || ''
    const priceValue = Number(p.unitCost || p.sellingPrice || 0)
    setEditingProductId(p._id)
    setInventoryMappingForm({
      mainStock: resolvedMainStock || 'gold',
      customMainStock: '',
      metalType: meta.metalType || resolvedMainStock || 'gold',
      stockCode: p.sku || '',
      unit: 'grams',
      currency: p.currency || 'USD',
      currentPrice: priceValue > 0 ? String(priceValue) : '',
      priceUnit: meta.priceUnit || 'OZ',
      priceCurrency: meta.priceCurrency || p.currency || 'USD',
    })
    setInventoryStockCodeManualOverride(false)
    setInventoryModalOffset({ x: 0, y: 0 })
    setShowInventoryMappingModal(true)
  }
  const handleDeleteProduct = async (p) => {
    if (!window.confirm(`Delete product "${p.name}"? This cannot be undone.`)) return
    try {
      setSaving(true)
      await erpAccountingAPI.deleteInventoryProduct(token, p._id)
      await loadInventory()
      showNotification('✅ Stock mapping deleted')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete stock mapping')
    } finally {
      setSaving(false)
    }
  }
  const handleCreateInventoryCatalogProduct = async (e) => {
    e.preventDefault()
    if (!inventoryProductForm.name.trim()) {
      setError('Product name is required')
      return
    }
    // For new products, stock type is required. For editing, allow if category is already set
    if (!inventoryProductForm.stockTypeId && !editingInventoryProductId) {
      setError('Product category is required')
      return
    }
    const selectedStockType = inventoryMappingProducts.find((item) => item._id === inventoryProductForm.stockTypeId)
    // For new products, selectedStockType is required. For editing, use existing or matched
    if (!selectedStockType && !editingInventoryProductId) {
      setError('Product category is required')
      return
    }
    // For editing, extract baseCategory from existing product if selectedStockType not found
    let baseCategory = ''
    if (selectedStockType) {
      baseCategory = String(selectedStockType.category || '').replace(/;?recordType=product/gi, '')
    } else if (editingInventoryProductId) {
      // Extract from existing product's category string
      const existingProduct = inventoryCatalogProducts.find((p) => p._id === editingInventoryProductId)
      if (existingProduct) {
        baseCategory = String(existingProduct.category || '').replace(/;recordType=product.*$/gi, '')
      }
    }
    const sanitizeMetaText = (value) => String(value || '').replace(/[;\n\r]/g, ' ').trim()
    const categoryName = sanitizeMetaText(inventoryProductForm.categoryName || selectedInventoryStockType?.mainStock || '')
    const productDescription = sanitizeMetaText(inventoryProductForm.description)
    const productWeight = Number(inventoryProductForm.weight || 0)
    const productGrossWeight = Number(inventoryProductForm.grossWeight || inventoryProductForm.weight || 0)
    const productPurity = String(inventoryProductForm.purity || '').trim()
    const productTaxType = sanitizeMetaText(inventoryProductForm.taxType || 'VAT')
    const vatPercentRaw = Number(inventoryProductForm.vatPercent || 0)
    const productVatPercent = Number.isFinite(vatPercentRaw) && vatPercentRaw >= 0
      ? Number(vatPercentRaw.toFixed(2))
      : 0
    const productPurityWeight = Number(inventoryProductPurityWeight || 0)
    try {
      setSaving(true)
      const payload = {
        name: inventoryProductForm.name.trim(),
        category: `${baseCategory};recordType=product;productCategory=${categoryName};productDescription=${productDescription};weight=${productWeight};grossWeight=${productGrossWeight};productPurity=${productPurity};taxType=${productTaxType};vatPercent=${productVatPercent};purityWeight=${productPurityWeight}`,
        unit: 'grams',
        quantity: productWeight,
        unitCost: 0,
        sellingPrice: 0,
        currency: 'USD',
      }
      if (editingInventoryProductId) {
        await erpAccountingAPI.updateInventoryProduct(token, editingInventoryProductId, payload)
        showNotification('✅ Product updated')
      } else {
        await erpAccountingAPI.createInventoryProduct(token, payload)
        showNotification('✅ Product created')
      }
      resetInventoryProductForm()
      await loadInventory()
    } catch (e) {
      setError(e.response?.data?.message || `Failed to ${editingInventoryProductId ? 'update' : 'create'} product`)
    } finally {
      setSaving(false)
    }
  }
  const handleEditInventoryCatalogProduct = (productItem, productMeta) => {
    // Try to match stock type - first by category string, then by product metadata
    let matchedStockType = inventoryMappingProducts.find((stockTypeItem) => String(productItem.category || '').startsWith(`${String(stockTypeItem.category || '')};recordType=product`))
    // Fallback: try matching by main stock name from product metadata
    if (!matchedStockType && productMeta?.mainStock) {
      const mainStockLower = String(productMeta.mainStock).toLowerCase().trim()
      matchedStockType = inventoryMappingProducts.find((stockTypeItem) => {
        const stockName = String(stockTypeItem.name || '').toLowerCase().trim()
        const stockMeta = decodeInventoryCategoryMeta(stockTypeItem.category)
        const stockMainLower = String(stockMeta.mainStock || stockMeta.metalType || '').toLowerCase().trim()
        return stockName === mainStockLower || stockMainLower === mainStockLower
      })
    }
    setEditingInventoryProductId(productItem._id)
    setInventoryProductForm({
      stockTypeId: matchedStockType?._id || '',
      categoryName: productMeta?.productCategory || titleCaseWords(productMeta?.mainStock || productMeta?.metalType || matchedStockType?.name || ''),
      name: productItem.name || '',
      description: productMeta?.productDescription || '',
      weight: String(productMeta?.weight ?? productItem.quantity ?? ''),
      grossWeight: String(productMeta?.grossWeight ?? productMeta?.weight ?? productItem.quantity ?? ''),
      purity: productMeta?.productPurity || productMeta?.purity || '',
      taxType: productMeta?.taxType || 'VAT',
      vatPercent: String(productMeta?.vatPercent ?? ''),
    })
    setInventoryProductModalOffset({ x: 0, y: 0 })
    setShowInventoryProductModal(true)
  }
  const handleDeleteInventoryCatalogProduct = async (productItem) => {
    if (!window.confirm(`Delete product "${productItem?.name || 'Unnamed'}"? This cannot be undone.`)) return
    try {
      setSaving(true)
      await erpAccountingAPI.deleteInventoryProduct(token, productItem._id)
      if (editingInventoryProductId && String(editingInventoryProductId) === String(productItem._id)) {
        resetInventoryProductForm()
      }
      await loadInventory()
      showNotification('✅ Product deleted')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete product')
    } finally {
      setSaving(false)
    }
  }
  const loadEnquiryHistory = () => {
    try {
      const raw = localStorage.getItem(ENQUIRY_HISTORY_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        setEnquiryHistory(parsed.slice(0, 10))
      }
    } catch {
      setEnquiryHistory([])
    }
  }
  const persistEnquiryHistory = (nextHistory) => {
    setEnquiryHistory(nextHistory)
    localStorage.setItem(ENQUIRY_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory))
  }
  const pushEnquiryHistory = (account) => {
    if (!account?.accountCode) return
    const nextItem = {
      accountCode: account.accountCode,
      accountName: account.accountName || '',
      searchedAt: new Date().toISOString(),
    }
    const deduped = enquiryHistory.filter((item) => item.accountCode !== nextItem.accountCode)
    const nextHistory = [nextItem, ...deduped].slice(0, 10)
    persistEnquiryHistory(nextHistory)
  }
  const fetchAccountEnquiryByCode = async (accountCode, options = {}) => {
    const cleanCode = resolveAccountEnquiryCodeInput(accountCode)
    const shouldOpenModal = Boolean(options.openModal)
    const forceRefresh = Boolean(options.forceRefresh)
    if (!cleanCode) {
      setError('Please enter account number')
      setEnquiryStatus({ type: 'error', message: 'Please enter account number' })
      return
    }
    const tenantKey = user?.tenant || user?.company || 'default'
    const deepLinkKey = enquiryDeepLinkKey({
      account: cleanCode,
      view: options.openStatementPreview ? 'statement' : null,
    })
    const cached = !forceRefresh ? readAccountEnquiryCache(tenantKey, cleanCode) : null
    if (cached) {
      setAccountEnquiryCode(cleanCode)
      setAccountEnquiryData(cached)
      setEnquiryLoading(false)
      lastEnquiryDeepLinkKeyRef.current = deepLinkKey
      syncEnquiryUrl({
        account: cleanCode,
        view: options.openStatementPreview ? 'statement' : null,
      })
      if (shouldOpenModal) setShowEnquiryModal(true)
      if (options.openStatementPreview) setPendingStatementPreview(true)
      setEnquiryStatus({ type: 'success', message: `Account ${cached.account?.accountCode || cleanCode} summary loaded from cache` })
      return
    }
    try {
      if (shouldOpenModal) setShowEnquiryModal(true)
      setEnquiryLoading(true)
      setShowEnquiryLookupMenu(false)
      setEnquiryStatus({ type: '', message: '' })
      const enquiryParams = { statementLimit: 80 }
      if (forceRefresh) enquiryParams.refresh = '1'
      const data = await erpAccountingAPI.getAccountEnquiry(token, cleanCode, enquiryParams)
      setAccountEnquiryCode(cleanCode)
      setAccountEnquiryData(data)
      writeAccountEnquiryCache(tenantKey, cleanCode, data)
      setStatementFilters({
        startDate: '',
        endDate: '',
        referenceType: '',
        department: '',
        fixStatus: '',
        foreignCurrency: '',
        metalCommodity: '',
        showAmountIn: '',
      })
      setStatementMetalCommodityEnabled(false)
      pushEnquiryHistory(data.account)
      setError('')
      setEnquiryStatus({ type: 'success', message: `Account ${data.account.accountCode} summary loaded successfully` })
      lastEnquiryDeepLinkKeyRef.current = deepLinkKey
      syncEnquiryUrl({
        account: data.account.accountCode,
        view: options.openStatementPreview ? 'statement' : null,
      })
      if (options.openStatementPreview) setPendingStatementPreview(true)
      showNotification('✅ Account summary loaded')
    } catch (e) {
      if (lastEnquiryDeepLinkKeyRef.current === deepLinkKey) {
        lastEnquiryDeepLinkKeyRef.current = ''
      }
      setAccountEnquiryData(null)
      const msg = e.response?.data?.message || 'Failed to fetch account summary'
      setError(msg)
      setEnquiryStatus({ type: 'error', message: msg })
    } finally {
      setEnquiryLoading(false)
    }
  }
  const handleOpenAccountSummaryFromTree = async (account) => {
    if (!account?.accountCode) return
    setActiveTabGuarded('enquiry')
    setAccountEnquiryCode(account.accountCode)
    await fetchAccountEnquiryByCode(account.accountCode)
  }
  const handleAccountEnquiry = async (e) => {
    e.preventDefault()
    const cleanCode = resolveAccountEnquiryCodeInput(accountEnquiryCode)
    const alreadyLoaded = String(accountEnquiryData?.account?.accountCode || '').trim() === cleanCode
    await fetchAccountEnquiryByCode(accountEnquiryCode, { openModal: true, forceRefresh: alreadyLoaded })
  }
  useEffect(() => {
    loadEnquiryHistory()
  }, [])
  useEffect(() => {
    setSelectedTransactionIds((prev) => {
      const next = prev.filter((id) => transactions.some((tx) => tx._id === id))
      if (next.length === prev.length && next.every((id, idx) => id === prev[idx])) {
        return prev
      }
      return next
    })
    if (selectedTransactionId && !transactions.some((tx) => tx._id === selectedTransactionId)) {
      setSelectedTransactionId('')
    }
  }, [transactions, selectedTransactionId])
  useEffect(() => {
    let cancelled = false
    const updatePreviewLogo = async () => {
      if (!brandingForm.logoUrl) {
        setBrandingPreviewLogo('')
        return
      }
      const nextLogo = await createLogoRenderAsset(
        brandingForm.logoUrl,
        brandingForm.logoWidth,
        brandingForm.logoHeight,
        brandingForm.logoFit
      )
      if (!cancelled) {
        setBrandingPreviewLogo(nextLogo)
      }
    }
    updatePreviewLogo()
    return () => {
      cancelled = true
    }
  }, [brandingForm.logoFit, brandingForm.logoHeight, brandingForm.logoUrl, brandingForm.logoWidth])
  useEffect(() => {
    if (activeTab !== 'transactions' || !selectedTransactionId || !transactions.length) return
    const target = document.getElementById(`erp-transaction-row-${selectedTransactionId}`)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeTab, selectedTransactionId, transactions])
  useEffect(() => {
    if (activeTab !== 'vendors' || !selectedVendorId) return
    loadVendorDetails(selectedVendorId)
  }, [activeTab, selectedVendorId, loadVendorDetails])
  useEffect(() => {
    // Prevent stale error banners from one ERP section leaking into another.
    setError((prev) => (prev ? '' : prev))
  }, [activeTab])
  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])
  useEffect(() => {
    if (erpTabNeedsLiveMetalRates(activeTab)) {
      setMetalRates(metalRatesRef.current)
    }
  }, [activeTab])
  useEffect(() => {
    accountEnquiryDataRef.current = accountEnquiryData
  }, [accountEnquiryData])
  useEffect(() => {
    showEnquiryModalRef.current = showEnquiryModal
  }, [showEnquiryModal])
  useEffect(() => {
    if (!canAccessERP || !token) {
      setError('You do not have access to the ERP Accounting module.')
      return
    }
    if (!canViewErpSubTab(user, activeTab)) return
    if (activeTab === 'accounts') loadAccounts()
    else if (activeTab === 'customer-margin') loadCustomers({ limit: 200 })
    else if (activeTab === 'customers') loadCustomers()
    else if (activeTab === 'supplier-margin') loadVendors()
    else if (activeTab === 'transactions' && (canAccessTransactions || canAccessVouchers || canAccessFixingRegister)) loadTransactions()
    else if (activeTab === 'vouchers') loadReportBranding()
    else if (activeTab === 'vendors') {
      Promise.all([
        loadVendors(),
        loadVendorPaymentCalendar(),
        loadVendorComplianceSummary(),
        loadVendorOverdueQueue(),
      ]).catch(() => {})
    }
    else if (activeTab === 'inventory') {
      loadInventory()
      loadStockLedger()
      loadVendors()
    }
    else if (activeTab === 'settings') {
      loadCurrencies()
      loadReportBranding()
    }
    else if (activeTab === 'currencies') {
      loadCurrencies()
      if (!accounts.length) loadAccounts()
    }
    else if (activeTab === 'enquiry') loadAccounts({ scope: 'summary' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, token])
  useEffect(() => {
    if (!canAccessERP || !token || activeTab !== 'ledger') return
    loadLedger()
    loadAccounts({ scope: 'summary' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    token,
    ledgerFilters.startDate,
    ledgerFilters.endDate,
    ledgerFilters.department,
    ledgerFilters.referenceType,
    ledgerFilters.accountId,
    ledgerVoucherTab,
  ])
  useEffect(() => {
    if (!canAccessERP || !token || activeTab !== 'reports') return
    loadReportBranding()
    loadReports(reportView)
    if (!accounts.length) loadAccounts()
    if (selectedReportAccountId) loadLedgerReport(selectedReportAccountId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    token,
    reportView,
    reportFilters.period,
    reportFilters.startDate,
    reportFilters.endDate,
    reportFilters.accountType,
    reportFilters.includeZeroAccounts,
    reportFilters.sortBy,
    reportFilters.sortDir,
    reportFilters.comparePrevious,
    reportFilters.referenceType,
    reportFilters.minAmount,
    selectedReportAccountId,
  ])
  useEffect(() => {
    if (!canAccessERP || !token || activeTab !== 'mappings') return
    loadMappings(mappingFilters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, token, mappingFilters.department])
  useEffect(() => {
    if (!token || !canAccessERP) return undefined

    let stopRealtime = () => {}
    const tenantKey = user?.tenant || user?.company

    const timer = window.setTimeout(() => {
      stopRealtime = startERPRealtimeFeeds({
        token,
        tenant: tenantKey,
        onLedgerUpdate: () => {
          if (activeTabRef.current === 'ledger') {
            loadLedger({ cursor: null, cursorHistory: [] })
          }
        },
        onTransactionUpdate: () => {
          if (activeTabRef.current === 'transactions') {
            loadTransactions({ cursor: null, cursorHistory: [] })
          }
        },
      })
    }, 300)

    return () => {
      window.clearTimeout(timer)
      stopRealtime()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- realtime handlers intentionally use refs + stable loaders
  }, [token, user?.tenant, user?.company, canAccessERP])
  useEffect(() => {
    if (activeTab !== 'vouchers' || !token) return
    loadCustomers({ limit: 500 })
    loadVendors()
    if (!currencies.length) loadCurrencies()
    loadAccounts()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tab bootstrap: refresh reference data when entering vouchers
  }, [activeTab, token])
  useEffect(() => {
    if (activeTab !== 'direct-deals' || !token) return
    if (!customers.length) loadCustomers({ limit: 200 })
    if (!currencies.length) loadCurrencies()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tab bootstrap: loaders intentionally omitted from deps
  }, [activeTab, token, customers.length, currencies.length])
  useEffect(() => {
    if (activeTab !== 'fixing-register' || !token) return
    if (!customers.length) loadCustomers({ limit: 200 })
    if (!inventoryProducts.length) loadInventory()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tab bootstrap: loaders intentionally omitted from deps
  }, [activeTab, token, customers.length, inventoryProducts.length])
  useEffect(() => {
    if (!fixingRegisterStockTypeOptions.length) return
    const fallbackMetalType = fixingRegisterStockTypeOptions[0]?.value || ''
    const hasSelected = fixingRegisterStockTypeOptions.some((option) => option.value === fixingRegFilter.metalType)
    if (!hasSelected) {
      setFixingRegFilter((prev) => (prev.metalType === fallbackMetalType ? prev : { ...prev, metalType: fallbackMetalType }))
    }
  }, [fixingRegisterStockTypeOptions, fixingRegFilter.metalType, setFixingRegFilter])
  const formatMoney = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
  const formatMoneyAbs = (value) => Math.abs(Number(value || 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })
  const formatReportDirectionalBalance = (row, fallbackDirection = '') => (
    formatDirectionalBalance(row?.balance, { preferredDirection: row?.direction || fallbackDirection })
  )
  const getReportPeriodLabel = () => {
    const now = new Date()
    const formatDate = (value) => {
      if (!value) return ''
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) return String(value)
      return d.toLocaleDateString()
    }
    if (reportFilters.period === 'today') {
      const today = now.toISOString().slice(0, 10)
      return `Today (${formatDate(today)})`
    }
    if (reportFilters.period === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return `This Month (${formatDate(start)} - ${formatDate(end)})`
    }
    if (reportFilters.period === 'ytd') {
      const start = new Date(now.getFullYear(), 0, 1)
      return `Year To Date (${formatDate(start)} - ${formatDate(now)})`
    }
    if (reportFilters.period === 'custom') {
      const start = reportFilters.startDate || '-'
      const end = reportFilters.endDate || '-'
      return `Custom Range (${formatDate(start)} - ${formatDate(end)})`
    }
    return 'Period: Not set'
  }
  const normalizeBalanceDirection = (direction) => {
    const raw = String(direction || '').trim().toLowerCase()
    if (raw === 'debit' || raw === 'dr') return 'Dr'
    if (raw === 'credit' || raw === 'cr') return 'Cr'
    return ''
  }
  const formatDirectionalBalance = (value, options = {}) => {
    const amount = Number(value || 0)
    const preferredDirection = normalizeBalanceDirection(options.preferredDirection)
    const direction = preferredDirection || (amount < 0 ? 'Cr' : 'Dr')
    const absAmount = Math.abs(amount)
    const formatted = absAmount.toLocaleString(undefined, {
      minimumFractionDigits: options.minDigits ?? 2,
      maximumFractionDigits: options.maxDigits ?? 2,
    })
    if (absAmount === 0) return formatted
    return `${formatted} ${direction}`
  }
  const getDepartmentBadgeStyle = (department) => {
    const deptValue = String(department || '').trim().toLowerCase()
    if (deptValue === 'finance') return { background: '#DBEAFE', color: '#1D4ED8' }
    if (deptValue === 'sales') return { background: '#FCE7F3', color: '#BE185D' }
    if (deptValue === 'operations') return { background: '#DCFCE7', color: '#166534' }
    if (deptValue === 'production') return { background: '#FEF3C7', color: '#92400E' }
    if (deptValue === 'hr') return { background: '#EDE9FE', color: '#6D28D9' }
    return { background: '#E5E7EB', color: '#374151' }
  }
  const tenantBranding = getTenantBranding(user?.company || user?.tenant?.key || user?.tenant?.name)
  const branding = resolveDocumentBranding({ reportBranding, user, tenantBranding })
  const brandingPreview = { ...DEFAULT_BRANDING, ...brandingForm }
  const buildBrandingLogoTag = async (brandingConfig, extraStyle = '') => {
    const logoAsset = await createLogoRenderAsset(
      brandingConfig.logoUrl,
      brandingConfig.logoWidth,
      brandingConfig.logoHeight,
      brandingConfig.logoFit
    )
    if (!logoAsset) return ''
    const width = clampBrandingDimension(brandingConfig.logoWidth, DEFAULT_BRANDING.logoWidth, 80, 260)
    const height = clampBrandingDimension(brandingConfig.logoHeight, DEFAULT_BRANDING.logoHeight, 32, 120)
    return `<img src="${logoAsset}" alt="Company Logo" style="width:${width}px;height:${height}px;object-fit:contain;display:block;${extraStyle}" />`
  }
  const openPrintWindow = (title, bodyHtml) => {
    const w = window.open('', '_blank')
    if (!w) {
      setError('Popup blocked. Please allow popups for statement printing')
      return
    }
    w.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Georgia, 'Times New Roman', serif; color: #111827; margin: 0; padding: 32px; }
            .sheet { max-width: 980px; margin: 0 auto; }
            .brandbar { height: 10px; background: var(--grad-brand); border-radius: 999px; margin-bottom: 14px; }
            .head { border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 20px; }
            .doc-head { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 14px; }
            .company { font-size: 18px; font-weight: 800; margin-bottom: 5px; }
            h1 { font-size: 22px; text-align: center; text-transform: uppercase; letter-spacing: 0.04em; margin: 12px 0; }
            .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; font-size: 12px; }
            .note { border: 1px solid #D1D5DB; min-height: 34px; padding: 8px; margin-top: 12px; font-size: 12px; }
            .title { font-size: 24px; font-weight: 700; margin: 0 0 4px; }
            .subtitle { color: #065F46; font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; margin: 0 0 8px; }
            .meta { color: #4B5563; font-size: 12px; margin: 2px 0; }
            .section { margin-bottom: 20px; }
            .section-title { font-size: 16px; font-weight: 700; margin: 0 0 8px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #D1D5DB; padding: 7px 8px; text-align: left; }
            th { background: #F3F4F6; }
            .num { text-align: right; }
            .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
            .card { border: 1px solid #D1D5DB; padding: 10px; }
            .card-label { color: #334155; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
            .card-value { font-size: 18px; font-weight: 700; margin-top: 4px; }
            .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 36px; }
            .sign-box { padding-top: 18px; border-top: 1px solid #475569; font-size: 12px; color: #374151; }
            .footer { margin-top: 18px; font-size: 11px; color: #334155; display: flex; justify-content: space-between; }
            @media print { body { padding: 0; } .sheet { max-width: none; } }
          </style>
        </head>
        <body>
          <div class="sheet">${bodyHtml}</div>
        </body>
      </html>
    `)
    w.document.close()
    w.focus()
    w.print()
  }
  const {
    updateJvLine,
    resolveJvLineAccount,
    getJvValidation,
    addJvLine,
    removeJvLine,
    handleJvLineKeyDown,
    handleJvAccountKeyDown,
    resetJvForm: _resetJvForm,
    handleOpenJv,
    handleEditJv,
    closeJvModal,
    openJvModal,
    switchJvMode,
    handleRepairJvFxPreview,
    handleRepairJvFxApply,
    handleSaveMultiLineJV,
    handlePrintJvVoucher,
    getJvAccountById: _getJvAccountById,
    isExchangeLine: _isExchangeLine,
  } = useJournalVoucher({
    jvMode,
    setJvMode,
    jvLines,
    setJvLines,
    jvHeader,
    setJvHeader,
    nextJvLineId,
    setNextJvLineId,
    jvEditEntryIds,
    setJvEditEntryIds,
    jvReadOnly,
    setJvReadOnly,
    entryAccountOptions,
    baseCurrencyCode,
    inventoryTenantKey,
    convertJvAmount,
    inferJvAccountCurrency,
    token,
    erpAccountingAPI,
    currencies,
    setError,
    setSaving,
    loadLedger,
    loadDashboard,
    showNotification,
    branding,
    buildBrandingLogoTag,
    openPrintWindow,
    defaultCompanyName: DEFAULT_BRANDING.companyName,
    user,
    JV_MODAL_DEFAULT_SIZE,
    setJvModalOffset,
    setJvModalDrag,
    setJvModalResize,
    setJvModalSize,
    setShowLedgerForm,
    buildJvDocNo,
    ledgerVoucherTab,
    canCloseLedgerPeriod,
  })
  const _escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
  const handleBrandingLogoFile = async (file) => {
    if (!file) return
    if (!isSupportedLogoUpload(file)) {
      setError('Logo upload supports PNG and SVG files only.')
      return
    }
    if (Number(file.size || 0) > LOGO_UPLOAD_MAX_BYTES) {
      setError('Logo file is too large. Please upload a PNG or SVG up to 3 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setBrandingForm((prev) => ({ ...prev, logoUrl: String(reader.result || '') }))
      setError('')
    }
    reader.readAsDataURL(file)
  }
  const handleSaveBranding = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      const payload = {
        ...brandingForm,
        key: normalizeBrandingKey(brandingForm.key || selectedBrandingKey || DEFAULT_BRANDING.key),
        logoWidth: clampBrandingDimension(brandingForm.logoWidth, DEFAULT_BRANDING.logoWidth, 80, 260),
        logoHeight: clampBrandingDimension(brandingForm.logoHeight, DEFAULT_BRANDING.logoHeight, 32, 120),
      }
      const data = await erpAccountingAPI.updateReportBranding(token, payload)
      const nextBranding = { ...DEFAULT_BRANDING, ...(data.branding || {}) }
      setBrandingProfiles(data.profiles?.length ? data.profiles : DEFAULT_BRANDING_PROFILES)
      setSelectedBrandingKey(data.selectedKey || nextBranding.key || DEFAULT_BRANDING.key)
      setReportBranding(nextBranding)
      setBrandingForm(nextBranding)
      setError('')
      showNotification('✅ Report branding saved')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save report branding')
    } finally {
      setSaving(false)
    }
  }
  const handleSelectBrandingProfile = async (key) => {
    const nextKey = normalizeBrandingKey(key)
    setSelectedBrandingKey(nextKey)
    await loadReportBranding(nextKey)
  }
  const handleCreateBrandingDraft = () => {
    const timestamp = Date.now().toString().slice(-6)
    const nextDraft = {
      ...DEFAULT_BRANDING,
      key: `entity-${timestamp}`,
      entityName: 'New Entity',
      branchName: '',
      isDefault: false,
    }
    setBrandingProfiles((prev) => [
      ...prev.filter((profile) => profile.key !== nextDraft.key),
      { key: nextDraft.key, entityName: nextDraft.entityName, branchName: nextDraft.branchName, companyName: nextDraft.companyName, isDefault: false },
    ])
    setSelectedBrandingKey(nextDraft.key)
    setBrandingForm(nextDraft)
  }
  const generateStatementHtml = () => buildStatementHtml({
    accountEnquiryData,
    filteredStatementEntries,
    resolveStatementReceiptNo,
    statementSelectedMetalCode,
    resolvePreferredStatementMetalCode,
    statementDisplayCurrency,
    rawStatementEntries,
    formatStatementDate,
    convertStatementDisplayAmount,
    tenantBranding,
    user,
    branding,
    defaultBranding: DEFAULT_BRANDING,
    statementFilters,
  })
  const handleViewStatement = async () => {
    const code = accountEnquiryData?.account?.accountCode || accountEnquiryCode
    if (code) syncEnquiryUrl({ account: code, view: 'statement' })
    setStatementPreviewHtml('')
    setStatementPreviewTitle('Statement of Account')
    setStatementPreviewLoading(true)
    setShowStatementPreview(true)
    try {
      const htmlData = await generateStatementHtml()
      if (!htmlData) {
        setShowStatementPreview(false)
        return
      }
      setStatementPreviewHtml(htmlData.html)
      setStatementPreviewTitle(`Statement of Account — ${htmlData.accountCode || 'Account'}`)
      showNotification('Statement preview opened')
    } catch (err) {
      console.error('Statement preview error:', err)
      setShowStatementPreview(false)
      setError('Failed to open statement preview.')
    } finally {
      setStatementPreviewLoading(false)
    }
  }
  const handlePrintStatement = async () => {
    try {
      const htmlData = await generateStatementHtml()
      if (!htmlData) return
      await printStatementHtml(htmlData.html)
      setExportOptionsOpen(false)
      showNotification('✅ Statement opened for printing')
    } catch (err) {
      console.error('Statement print error:', err)
      if (String(err?.message || '').includes('Popup blocked')) {
        setError('Popup blocked. Please allow popups for statement printing.')
      } else {
        setError('Failed to prepare statement for printing.')
      }
    }
  }
  const handleDownloadStatementPdf = async () => {
    try {
      const htmlData = await generateStatementHtml()
      if (!htmlData) return
      await printStatementHtml(htmlData.html)
      setExportOptionsOpen(false)
      showNotification('Choose Save as PDF in the print dialog to download')
    } catch (err) {
      console.error('PDF generation error:', err)
      if (String(err?.message || '').includes('Popup blocked')) {
        setError('Popup blocked. Please allow popups for statement export.')
      } else {
        setError('Failed to open statement for PDF export.')
      }
    }
  }
  const handleExportEnquiryPdf = () => {
    if (!accountEnquiryData) {
      setError('Load an account summary first to export')
      return
    }
    setExportOptionsOpen(true)
  }
  const downloadXlsx = async (rows, fileName, sheetName = 'Report') => {
    const ExcelJS = await loadExcel()
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(sheetName)
    ;(rows || []).forEach((row) => {
      worksheet.addRow(Array.isArray(row) ? row : [row])
    })
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    downloadBlob(blob, fileName)
  }
  const buildTransactionExportPayload = () => {
    const scope = selectedTransactionIds.length
      ? transactions.filter((tx) => selectedTransactionIds.includes(tx._id))
      : transactions
    if (!scope.length) return null
    const stamp = new Date().toISOString().slice(0, 10)
    const rows = [
      ['Ops Dashboard ERP Transactions'],
      [`Generated`, new Date().toLocaleString()],
      [`Scope`, selectedTransactionIds.length ? 'Selected transactions' : 'Current visible transactions'],
      [],
      ['Date', 'Type', 'Party', 'Amount', 'Currency', 'Status', 'Description', 'Debit Account', 'Credit Account', 'Created By', 'Approved By', 'Posted By', 'Comments', 'Audit Events'],
    ]
    scope.forEach((tx) => {
      rows.push([
        tx.date ? new Date(tx.date).toLocaleString() : '',
        TRANSACTION_TYPE_LABELS[tx.type] || tx.type,
        tx.customerId?.name || tx.vendorId?.name || tx.inventoryItemId?.sku || '',
        Number(tx.amount || 0),
        tx.currency || 'USD',
        tx.status || '',
        tx.description || '',
        tx.debitAccountId ? `${tx.debitAccountId.accountCode} - ${tx.debitAccountId.accountName}` : '',
        tx.creditAccountId ? `${tx.creditAccountId.accountCode} - ${tx.creditAccountId.accountName}` : '',
        tx.createdBy?.name || '',
        tx.approvedBy?.name || '',
        tx.postedBy?.name || '',
        Number(tx.comments?.length || 0),
        Number(tx.auditTrail?.length || 0),
      ])
    })
    return { rows, fileBase: `transactions-${stamp}`, sheetName: 'Transactions' }
  }
  const handleExportTransactionsCsv = () => {
    const payload = buildTransactionExportPayload()
    if (!payload) {
      setError('No transactions available to export')
      return
    }
    downloadCsv(payload.rows, `${payload.fileBase}.csv`)
    showNotification('✅ Transactions CSV exported')
  }
  const handleExportTransactionsXlsx = async () => {
    const payload = buildTransactionExportPayload()
    if (!payload) {
      setError('No transactions available to export')
      return
    }
    await downloadXlsx(payload.rows, `${payload.fileBase}.xlsx`, payload.sheetName)
    showNotification('✅ Transactions XLSX exported')
  }
  const handleExportTransactionsPdf = async () => {
    const scope = selectedTransactionIds.length
      ? transactions.filter((tx) => selectedTransactionIds.includes(tx._id))
      : transactions
    if (!scope.length) {
      setError('No transactions available to export')
      return
    }
    const { jsPDF, autoTable } = await loadPdfTools()
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('ERP Transactions Register', 36, 36)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 36, 54)
    doc.text(`Scope: ${selectedTransactionIds.length ? 'Selected transactions' : 'Current visible transactions'}`, 36, 68)
    autoTable(doc, {
      head: [['Date', 'Type', 'Party', 'Amount', 'Status', 'Description', 'Comments', 'Audit']],
      body: scope.map((tx) => [
        tx.date ? new Date(tx.date).toLocaleDateString() : '',
        TRANSACTION_TYPE_LABELS[tx.type] || tx.type,
        tx.customerId?.name || tx.vendorId?.name || tx.inventoryItemId?.sku || '',
        `${tx.currency || 'USD'} ${Number(tx.amount || 0).toLocaleString()}`,
        tx.status || '',
        tx.description || '',
        String(tx.comments?.length || 0),
        String(tx.auditTrail?.length || 0),
      ]),
      startY: 84,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [17, 24, 39] },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 24, right: 24 },
    })
    doc.save(`transactions-${new Date().toISOString().slice(0, 10)}.pdf`)
    showNotification('✅ Transactions PDF exported')
  }
  const buildReportExportPayload = () => {
    if (!reports.trialBalance) return null
    const stamp = new Date().toISOString().slice(0, 10)
    const brandingRows = [
      [branding.entityName || DEFAULT_BRANDING.entityName, branding.branchName || ''],
      [branding.companyName || DEFAULT_BRANDING.companyName],
      [branding.legalName || ''],
      [branding.reportSubtitle || DEFAULT_BRANDING.reportSubtitle],
      [branding.reportFooter || DEFAULT_BRANDING.reportFooter],
      [],
    ]
    if (reportView === 'trial' || reportView === 'summary') {
      const trialRows = trialBalanceRowsForView(reportView, reports.trialBalance?.trialBalance || [])
      const rows = [...brandingRows, ['Account Code', 'Account Name', 'Type', 'Debit', 'Credit', 'Net']]
      trialRows.forEach((row) => {
        rows.push([row.accountCode, row.accountName, row.accountType, row.debit, row.credit, row.net])
      })
      const isSummary = reportView === 'summary'
      return {
        rows,
        fileBase: isSummary ? `summary-${stamp}` : `trial-balance-${stamp}`,
        sheetName: isSummary ? 'Summary' : 'Trial Balance',
        successLabel: isSummary ? 'Summary' : 'Trial balance',
      }
    }
    if (reportView === 'pnl') {
      const rows = [...brandingRows, ['Section', 'Account Code', 'Account Name', 'Amount']]
      ;(reports.profitLoss?.incomeBreakdown || []).forEach((row) => rows.push(['Income', row.accountCode, row.accountName, row.amount]))
      ;(reports.profitLoss?.expenseBreakdown || []).forEach((row) => rows.push(['Expense', row.accountCode, row.accountName, row.amount]))
      ;(reports.profitLoss?.monthlyComparison || []).forEach((row) => rows.push(['Monthly', row.label, 'Net Profit', row.netProfit]))
      return { rows, fileBase: `profit-loss-${stamp}`, sheetName: 'Profit Loss', successLabel: 'Profit & loss' }
    }
    if (reportView === 'balanceSheet') {
      const rows = [...brandingRows, ['Section', 'Account Code', 'Account Name', 'Balance', 'Direction', 'Reclassified']]
      ;(reports.balanceSheet?.assets || []).forEach((row) => rows.push(['Asset', row.accountCode, row.accountName, row.balance, row.direction || 'Dr', row.isReclassified ? 'Yes' : 'No']))
      ;(reports.balanceSheet?.liabilities || []).forEach((row) => rows.push(['Liability', row.accountCode, row.accountName, row.balance, row.direction || 'Cr', row.isReclassified ? 'Yes' : 'No']))
      ;(reports.balanceSheet?.equity || []).forEach((row) => rows.push(['Equity', row.accountCode, row.accountName, row.balance, row.direction || 'Cr', row.isReclassified ? 'Yes' : 'No']))
      ;(reports.balanceSheet?.monthlyComparison || []).forEach((row) => rows.push(['Monthly', row.label, 'Working Capital', row.workingCapital]))
      return { rows, fileBase: `balance-sheet-${stamp}`, sheetName: 'Balance Sheet', successLabel: 'Balance sheet' }
    }
    if (reportView === 'dayBook') {
      const rows = [...brandingRows, ['Date', 'Type', 'Description', 'Debit Account', 'Credit Account', 'Amount', 'Currency']]
      ;(reports.dayBook?.entries || []).forEach((row) => {
        rows.push([
          new Date(row.date).toLocaleString(),
          row.referenceType,
          row.description || '',
          row.debitAccountId?.accountCode || '',
          row.creditAccountId?.accountCode || '',
          row.amount,
          row.currency || 'USD',
        ])
      })
      return { rows, fileBase: `day-book-${stamp}`, sheetName: 'Day Book', successLabel: 'Day book' }
    }
    if (reportView === 'outstanding') {
      const rows = [...brandingRows, ['Category', 'Name', 'Ledger Code', 'Outstanding', '0-30', '31-60', '61-90', '90+', 'Limit Exceeded']]
      ;(reports.customerOutstanding?.rows || []).forEach((row) => {
        rows.push(['Customer', row.customerName, row.ledgerAccount?.accountCode || '', row.outstanding, row.aging?.bucket0to30 || 0, row.aging?.bucket31to60 || 0, row.aging?.bucket61to90 || 0, row.aging?.bucket90Plus || 0, row.limitExceeded ? 'Yes' : 'No'])
      })
      ;(reports.vendorOutstanding?.rows || []).forEach((row) => {
        rows.push(['Vendor', row.vendorName, row.ledgerAccount?.accountCode || '', row.outstanding, '', '', '', '', row.outstandingType || ''])
      })
      return { rows, fileBase: `outstanding-${stamp}`, sheetName: 'Outstanding', successLabel: 'Outstanding' }
    }
    if (reportView === 'ledger') {
      const rows = [...brandingRows, ['Voucher', 'Date', 'Type', 'Description', 'Debit', 'Credit', 'Running Balance']]
      ledgerReportRows.forEach((row) => {
        rows.push([String(row.entryId || '').slice(-6).toUpperCase(), new Date(row.date).toLocaleString(), row.referenceType, row.description || '', row.debit || 0, row.credit || 0, row.runningBalance || 0])
      })
      return { rows, fileBase: `account-ledger-${stamp}`, sheetName: 'Ledger', successLabel: 'Ledger drilldown' }
    }
    if (reportView === 'forex') {
      const rows = [...brandingRows, ['Currency', 'Entries', 'Impact']]
      Object.entries(reports.forex?.byCurrency || {}).forEach(([currency, row]) => rows.push([currency, row.count || 0, row.impact || 0]))
      return { rows, fileBase: `forex-impact-${stamp}`, sheetName: 'Forex', successLabel: 'Forex report' }
    }
    return null
  }
  const handleExportReportCsv = () => {
    const payload = buildReportExportPayload()
    if (!payload) {
      setError('Load reports first before exporting')
      return
    }
    downloadCsv(payload.rows, `${payload.fileBase}.csv`)
    showNotification(`✅ ${payload.successLabel} CSV exported`)
  }
  const handleExportReportXlsx = async () => {
    const payload = buildReportExportPayload()
    if (!payload) {
      setError('Load reports first before exporting')
      return
    }
    await downloadXlsx(payload.rows, `${payload.fileBase}.xlsx`, payload.sheetName)
    showNotification(`✅ ${payload.successLabel} XLSX exported`)
  }
  const handlePrintCurrentReport = async () => {
    if (!reports.trialBalance) {
      setError('Load reports first before printing')
      return
    }
    const periodText = reports.trialBalance?.period?.startDate
      ? `${reports.trialBalance.period.startDate} to ${reports.trialBalance.period.endDate || reports.trialBalance.period.startDate}`
      : `As on ${new Date().toLocaleDateString()}`
    const logoMarkup = await buildBrandingLogoTag(branding, 'margin-bottom:10px;')
    const head = `
      <div class="brandbar"></div>
      <div class="head">
        ${logoMarkup}
        <p class="subtitle">${branding.companyName || DEFAULT_BRANDING.companyName}</p>
        <p class="title">ERP Financial Statement</p>
        <p class="meta">${branding.entityName || DEFAULT_BRANDING.entityName}${branding.branchName ? ` / ${branding.branchName}` : ''}</p>
        ${branding.legalName ? `<p class="meta">${branding.legalName}</p>` : ''}
        <p class="meta">${branding.reportSubtitle || DEFAULT_BRANDING.reportSubtitle} | Prepared for statutory / CA-style review</p>
        <p class="meta">Period: ${periodText}</p>
        <p class="meta">Generated: ${new Date().toLocaleString()}</p>
      </div>
    `
    const signatureBlock = `
      <div class="signatures">
        <div class="sign-box">${branding.preparedByTitle || DEFAULT_BRANDING.preparedByTitle}<br />${branding.preparedByName || user?.name || DEFAULT_BRANDING.preparedByName}</div>
        <div class="sign-box">${branding.reviewedByTitle || DEFAULT_BRANDING.reviewedByTitle}<br />${branding.reviewedByName || DEFAULT_BRANDING.reviewedByName}</div>
        <div class="sign-box">${branding.approvedByTitle || DEFAULT_BRANDING.approvedByTitle}<br />${branding.approvedByName || DEFAULT_BRANDING.approvedByName}</div>
      </div>
      <div class="footer">
        <span>${branding.companyName || DEFAULT_BRANDING.companyName} Reporting Suite</span>
        <span>${branding.reportFooter || DEFAULT_BRANDING.reportFooter}</span>
      </div>
    `
    let body = ''
    if (reportView === 'pnl') {
      body = `
        ${head}
        <div class="summary">
          <div class="card"><div class="card-label">Income</div><div class="card-value">${formatMoney(reports.profitLoss?.totalIncome)}</div></div>
          <div class="card"><div class="card-label">Expense</div><div class="card-value">${formatMoney(reports.profitLoss?.totalExpense)}</div></div>
          <div class="card"><div class="card-label">Net Profit</div><div class="card-value">${formatMoney(reports.profitLoss?.netProfit)}</div></div>
        </div>
        <div class="section"><p class="section-title">Income Breakdown</p><table><thead><tr><th>Code</th><th>Account</th><th class="num">Amount</th></tr></thead><tbody>${(reports.profitLoss?.incomeBreakdown || []).map((row) => `<tr><td>${row.accountCode}</td><td>${row.accountName}</td><td class="num">${formatMoney(row.amount)}</td></tr>`).join('')}</tbody></table></div>
        <div class="section"><p class="section-title">Expense Breakdown</p><table><thead><tr><th>Code</th><th>Account</th><th class="num">Amount</th></tr></thead><tbody>${(reports.profitLoss?.expenseBreakdown || []).map((row) => `<tr><td>${row.accountCode}</td><td>${row.accountName}</td><td class="num">${formatMoney(row.amount)}</td></tr>`).join('')}</tbody></table></div>
        ${signatureBlock}
      `
    } else if (reportView === 'balanceSheet') {
      const section = (title, rows, fallbackDirection) => `<div class="section"><p class="section-title">${title}</p><table><thead><tr><th>Code</th><th>Account</th><th class="num">Balance</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${row.accountCode}</td><td>${row.accountName}${row.isReclassified ? ' (reclassified)' : ''}</td><td class="num">${formatReportDirectionalBalance(row, fallbackDirection)}</td></tr>`).join('')}</tbody></table></div>`
      body = `
        ${head}
        <div class="summary">
          <div class="card"><div class="card-label">Assets</div><div class="card-value">${formatMoneyAbs(reports.balanceSheet?.totalAssets)}</div></div>
          <div class="card"><div class="card-label">Liabilities + Equity</div><div class="card-value">${formatMoneyAbs(reports.balanceSheet?.liabilitiesPlusEquity)}</div></div>
          <div class="card"><div class="card-label">Working Capital</div><div class="card-value">${formatMoney(reports.balanceSheet?.workingCapital)}</div></div>
        </div>
        ${section('Assets', reports.balanceSheet?.assets || [], 'Dr')}
        ${section('Liabilities', reports.balanceSheet?.liabilities || [], 'Cr')}
        ${section('Equity', reports.balanceSheet?.equity || [], 'Cr')}
        ${signatureBlock}
      `
    } else {
      body = `
        ${head}
        <div class="summary">
          <div class="card"><div class="card-label">Trial Debit</div><div class="card-value">${formatMoney(reports.trialBalance?.totalDebit)}</div></div>
          <div class="card"><div class="card-label">Trial Credit</div><div class="card-value">${formatMoney(reports.trialBalance?.totalCredit)}</div></div>
          <div class="card"><div class="card-label">Difference</div><div class="card-value">${formatMoney(reports.trialBalance?.difference)}</div></div>
        </div>
        <div class="section"><p class="section-title">${reportView === 'summary' ? 'Summary' : 'Trial Balance'}</p><table><thead><tr><th>Code</th><th>Account</th><th>Type</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Net</th></tr></thead><tbody>${trialBalanceRowsForView(reportView, reports.trialBalance?.trialBalance || []).map((row) => `<tr><td>${row.accountCode}</td><td>${row.accountName}</td><td>${row.accountType}</td><td class="num">${formatMoney(row.debit)}</td><td class="num">${formatMoney(row.credit)}</td><td class="num">${formatMoney(row.net)}</td></tr>`).join('')}</tbody></table></div>
        ${signatureBlock}
      `
    }
    openPrintWindow('ERP Financial Statement', body)
    showNotification('✅ Statement print layout opened')
  }
  const handleExportReportPdf = async () => {
    if (!reports.trialBalance) {
      setError('Load reports first before exporting PDF')
      return
    }
    const { jsPDF, autoTable } = await loadPdfTools()
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const titleMap = {
      summary: 'Summary',
      trial: 'Trial Balance',
      pnl: 'Profit & Loss Statement',
      balanceSheet: 'Balance Sheet',
      dayBook: 'Day Book',
      outstanding: 'Outstanding Statement',
      forex: 'Forex Gain/Loss',
      ledger: `Ledger Drilldown ${selectedReportAccountCode ? `- ${selectedReportAccountCode}` : ''}`,
    }
    const title = titleMap[reportView] || 'ERP Report'
    const generatedAt = new Date().toLocaleString()
    const logoWidth = clampBrandingDimension(branding.logoWidth, DEFAULT_BRANDING.logoWidth, 80, 260)
    const logoHeight = clampBrandingDimension(branding.logoHeight, DEFAULT_BRANDING.logoHeight, 32, 120)
    const processedLogo = await createLogoRenderAsset(branding.logoUrl, logoWidth, logoHeight, branding.logoFit)
    doc.setFillColor(0, 104, 74)
    doc.rect(28, 24, 539, 10, 'F')
    if (processedLogo && String(processedLogo).startsWith('data:image/')) {
      try {
        doc.addImage(processedLogo, 'PNG', 540 - logoWidth, 36, logoWidth, logoHeight, undefined, 'FAST')
      } catch {
        // Ignore invalid embedded image data and continue with text branding.
      }
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(6, 95, 70)
    doc.text(String(branding.companyName || DEFAULT_BRANDING.companyName).toUpperCase(), 40, 52)
    doc.setFontSize(16)
    doc.setTextColor(17, 24, 39)
    doc.text(title, 40, 42)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    if (branding.legalName) doc.text(String(branding.legalName), 40, 64)
    doc.text(`${branding.entityName || DEFAULT_BRANDING.entityName}${branding.branchName ? ` / ${branding.branchName}` : ''}`, 40, branding.legalName ? 78 : 64)
    doc.text(String(branding.reportSubtitle || DEFAULT_BRANDING.reportSubtitle), 40, branding.legalName ? 92 : 78)
    doc.text(`Generated: ${generatedAt}`, 40, branding.legalName ? 106 : 92)
    let head = []
    let body = []
    if (reportView === 'trial' || reportView === 'summary') {
      head = [['Code', 'Account', 'Type', 'Debit', 'Credit', 'Net']]
      body = trialBalanceRowsForView(reportView, reports.trialBalance?.trialBalance || []).map((row) => [
        row.accountCode,
        row.accountName,
        row.accountType,
        formatMoney(row.debit),
        formatMoney(row.credit),
        formatMoney(row.net),
      ])
    } else if (reportView === 'pnl') {
      head = [['Section', 'Code', 'Account', 'Amount']]
      body = [
        ...(reports.profitLoss?.incomeBreakdown || []).map((row) => ['Income', row.accountCode, row.accountName, formatMoney(row.amount)]),
        ...(reports.profitLoss?.expenseBreakdown || []).map((row) => ['Expense', row.accountCode, row.accountName, formatMoney(row.amount)]),
        ['Total', 'NET', 'Net Profit', formatMoney(reports.profitLoss?.netProfit)],
      ]
    } else if (reportView === 'balanceSheet') {
      head = [['Section', 'Code', 'Account', 'Balance']]
      body = [
        ...(reports.balanceSheet?.assets || []).map((row) => ['Asset', row.accountCode, `${row.accountName}${row.isReclassified ? ' (reclassified)' : ''}`, formatReportDirectionalBalance(row, 'Dr')]),
        ...(reports.balanceSheet?.liabilities || []).map((row) => ['Liability', row.accountCode, `${row.accountName}${row.isReclassified ? ' (reclassified)' : ''}`, formatReportDirectionalBalance(row, 'Cr')]),
        ...(reports.balanceSheet?.equity || []).map((row) => ['Equity', row.accountCode, `${row.accountName}${row.isReclassified ? ' (reclassified)' : ''}`, formatReportDirectionalBalance(row, 'Cr')]),
      ]
    } else if (reportView === 'dayBook') {
      head = [['Date', 'Type', 'Description', 'Debit A/C', 'Credit A/C', 'Amount']]
      body = (reports.dayBook?.entries || []).map((row) => [
        new Date(row.date).toLocaleString(),
        row.referenceType,
        row.description || '',
        row.debitAccountId?.accountCode || '',
        row.creditAccountId?.accountCode || '',
        formatMoney(row.amount),
      ])
    } else if (reportView === 'outstanding') {
      head = [['Party', 'Name', 'Ledger', 'Outstanding', 'Age/Type']]
      body = [
        ...(reports.customerOutstanding?.rows || []).map((row) => ['Customer', row.customerName, row.ledgerAccount?.accountCode || '', formatMoney(row.outstanding), `90+: ${formatMoney(row.aging?.bucket90Plus || 0)}`]),
        ...(reports.vendorOutstanding?.rows || []).map((row) => ['Vendor', row.vendorName, row.ledgerAccount?.accountCode || '', formatMoney(row.outstanding), row.outstandingType || '']),
      ]
    } else if (reportView === 'forex') {
      head = [['Currency', 'Entries', 'Impact']]
      body = Object.entries(reports.forex?.byCurrency || {}).map(([currency, row]) => [currency, String(row.count || 0), formatMoney(row.impact)])
    } else if (reportView === 'ledger') {
      head = [['Voucher', 'Date', 'Type', 'Description', 'Debit', 'Credit', 'Running']]
      body = (ledgerReportRows || []).map((row) => [
        String(row.entryId || '').slice(-6).toUpperCase(),
        new Date(row.date).toLocaleString(),
        row.referenceType,
        row.description || '',
        formatMoney(row.debit),
        formatMoney(row.credit),
        formatMoney(row.runningBalance),
      ])
    }
    autoTable(doc, {
      head,
      body,
      startY: branding.legalName ? 122 : 108,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [17, 24, 39] },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 28, right: 28 },
    })
    const finalY = doc.lastAutoTable?.finalY || 110
    const signatureY = Math.min(Math.max(finalY + 36, 680), 740)
    doc.setDrawColor(156, 163, 175)
    doc.line(40, signatureY, 180, signatureY)
    doc.line(220, signatureY, 360, signatureY)
    doc.line(400, signatureY, 540, signatureY)
    doc.setFontSize(9)
    doc.text(String(branding.preparedByTitle || DEFAULT_BRANDING.preparedByTitle), 40, signatureY + 14)
    doc.text(String(branding.preparedByName || user?.name || DEFAULT_BRANDING.preparedByName), 40, signatureY + 28)
    doc.text(String(branding.reviewedByTitle || DEFAULT_BRANDING.reviewedByTitle), 220, signatureY + 14)
    doc.text(String(branding.reviewedByName || DEFAULT_BRANDING.reviewedByName), 220, signatureY + 28)
    doc.text(String(branding.approvedByTitle || DEFAULT_BRANDING.approvedByTitle), 400, signatureY + 14)
    doc.text(String(branding.approvedByName || DEFAULT_BRANDING.approvedByName), 400, signatureY + 28)
    doc.setFontSize(8)
    doc.setTextColor(107, 114, 128)
    doc.text(`${branding.companyName || DEFAULT_BRANDING.companyName} Reporting Suite`, 40, signatureY + 52)
    doc.text(String(branding.reportFooter || DEFAULT_BRANDING.reportFooter), 420, signatureY + 52)
    const stamp = new Date().toISOString().slice(0, 10)
    doc.save(`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stamp}.pdf`)
    showNotification('✅ PDF exported')
  }
  const handleTrialAccountDrilldown = async (accountCode) => {
    const match = accounts.find((acc) => acc.accountCode === accountCode)
    if (!match?._id) return
    setSelectedReportAccountId(match._id)
    setSelectedReportAccountCode(match.accountCode)
    setReportView('ledger')
    await loadLedgerReport(match._id)
  }
  const handleReportAccountDrilldown = async (accountId, accountCode) => {
    if (!accountId) return
    setSelectedReportAccountId(String(accountId))
    setSelectedReportAccountCode(accountCode || '')
    setReportView('ledger')
    await loadLedgerReport(String(accountId))
  }
  const handleOpenVoucherSource = async (ledgerId) => {
    if (!ledgerId) return
    try {
      setVoucherSourceLoading(true)
      const data = await erpAccountingAPI.getTransactionSourceByLedger(token, ledgerId)
      setVoucherSource(data)
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load voucher source')
    } finally {
      setVoucherSourceLoading(false)
    }
  }
  const handleJumpToTransaction = async (transactionId) => {
    if (!transactionId) return
    setSelectedTransactionId(transactionId)
    setVoucherSource(null)
    setActiveTabGuarded('transactions')
    try {
      await loadTransactions()
    } catch {
      // Errors are handled by loadTransactions state updates.
    }
    showNotification('✅ Jumped to linked transaction')
  }

  useEffect(() => {
    if (!jumpToTransactionId || typeof onJumpToTransactionConsumed !== 'function') return undefined
    let cancelled = false
    ;(async () => {
      try {
        await handleJumpToTransaction(jumpToTransactionId)
      } finally {
        if (!cancelled) onJumpToTransactionConsumed()
      }
    })()
    return () => {
      cancelled = true
    }
    // handleJumpToTransaction is stable enough for this one-shot deep link; omit to avoid re-running on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpToTransactionId, onJumpToTransactionConsumed])
  useEnquiryDeepLinkEffects({
    activeTab,
    searchParams,
    lastEnquiryDeepLinkKeyRef,
    fetchAccountEnquiryByCode,
    jumpToEnquiryAccountCode,
    onJumpToEnquiryConsumed,
    setActiveTabGuarded,
  })

  useEffect(() => {
    if (!pendingStatementPreview || !accountEnquiryData) return undefined
    setPendingStatementPreview(false)
    let cancelled = false
    ;(async () => {
      setStatementPreviewHtml('')
      setStatementPreviewTitle('Statement of Account')
      setStatementPreviewLoading(true)
      setShowStatementPreview(true)
      try {
        const htmlData = await generateStatementHtml()
        if (cancelled) return
        if (!htmlData) {
          setShowStatementPreview(false)
          return
        }
        setStatementPreviewHtml(htmlData.html)
        setStatementPreviewTitle(`Statement of Account — ${htmlData.accountCode || 'Account'}`)
        showNotification('Statement preview opened')
      } catch (err) {
        if (cancelled) return
        console.error('Statement preview error:', err)
        setShowStatementPreview(false)
        setError('Failed to open statement preview.')
      } finally {
        if (!cancelled) setStatementPreviewLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // generateStatementHtml reads live enquiry filters; run once when preview is requested.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingStatementPreview, accountEnquiryData])

  if (!canAccessERP) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: C.t2 }}>
        <p>⛔ ERP access restricted for your role.</p>
      </div>
    )
  }
  if (!canViewCurrentErpSubTab) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: C.t2 }}>
        <p>⛔ This ERP page is not enabled in your permissions.</p>
      </div>
    )
  }
  // ─────────────────────────────────────────────────────────────────────────────
  const handleCreateCustomer = async (e) => {
    e.preventDefault()
    if (!customerForm.name) {
      setError('Customer name is required')
      return
    }
    setSaving(true)
    try {
      await erpAccountingAPI.createCustomer(token, {
        ...customerForm,
        openingBalance: Number(customerForm.openingBalance || 0),
        creditLimit: Number(customerForm.creditLimit || 0),
        paymentTermsDays: Number(customerForm.paymentTermsDays || 0),
      })
      setCustomerForm({
        name: '',
        phone: '',
        email: '',
        address: '',
        gstVat: '',
        openingBalance: '',
        creditLimit: '',
        paymentTermsDays: '',
        currency: currencies.find((currency) => currency.baseCurrency)?.code || 'USD',
        notes: '',
      })
      setShowCustomerForm(false)
      await Promise.all([loadCustomers(), loadAccounts()])
      showNotification('✅ Customer created successfully')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create customer')
    } finally {
      setSaving(false)
    }
  }
  const openEditModal = (type, record) => {
    let formState = {}
    if (type === 'account') {
      formState = {
        accountName: record.accountName || '',
        description: record.description || '',
        currency: record.currency || 'USD',
        department: record.department || '',
      }
    }
    if (type === 'mapping') {
      formState = {
        mappingType: record.mappingType || '',
        debitAccountId: record.debitAccountId?._id || '',
        creditAccountId: record.creditAccountId?._id || '',
        department: record.department || '',
        description: record.description || '',
      }
    }
    if (type === 'currency') {
      const r = Number(record.exchangeRate || 0)
      const unitsPerUsd =
        !record.baseCurrency && Number.isFinite(r) && r > 0 ? 1 / r : ''
      formState = {
        code: record.code || '',
        name: record.name || '',
        symbol: record.symbol || '',
        exchangeRate: record.exchangeRate || 1,
        baseCurrency: Boolean(record.baseCurrency),
        oneUsdEquals: unitsPerUsd === '' ? '' : String(unitsPerUsd),
      }
    }
    if (type === 'customer') {
      formState = {
        name: record.name || '',
        phone: record.phone || '',
        email: record.email || '',
        address: record.address || '',
        gstVat: record.gstVat || '',
        creditLimit: record.creditLimit || 0,
        paymentTermsDays: record.paymentTermsDays || 0,
        currency: record.currency || 'USD',
        notes: record.notes || '',
      }
    }
    setEditState({ type, record, form: formState })
  }
  const closeEditModal = () => {
    setEditState({ type: '', record: null, form: {} })
  }
  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (editState.type === 'ledger') {
      handleSaveEditLedger()
      return
    }
    if (!editState.record || !editState.type) return
    setSaving(true)
    try {
      if (editState.type === 'account') {
        await erpAccountingAPI.updateAccount(token, editState.record._id, editState.form)
        await loadAccounts()
      }
      if (editState.type === 'mapping') {
        await erpAccountingAPI.updateMapping(token, editState.record._id, editState.form)
        await loadMappings()
      }
      if (editState.type === 'currency') {
        let nextRate = Number(editState.form.exchangeRate || 1)
        const fromQuote = exchangeRateFromUnitsPerBase(editState.form.oneUsdEquals)
        if (!editState.form.baseCurrency && fromQuote !== null) nextRate = fromQuote
        if (editState.form.baseCurrency) nextRate = 1
        if (!editState.form.baseCurrency && (!Number.isFinite(nextRate) || nextRate <= 0)) {
          setError(`Enter a positive exchange rate or a valid 1 ${erpBaseCurrencyCode} = (units) quote.`)
          setSaving(false)
          return
        }
        const { oneUsdEquals: _omitQuote, ...currencyPayload } = editState.form
        await erpAccountingAPI.updateCurrency(token, editState.record._id, {
          ...currencyPayload,
          exchangeRate: nextRate,
        })
        await loadCurrencies()
      }
      if (editState.type === 'customer') {
        await erpAccountingAPI.updateCustomer(token, editState.record._id, {
          ...editState.form,
          creditLimit: Number(editState.form.creditLimit || 0),
          paymentTermsDays: Number(editState.form.paymentTermsDays || 0),
        })
        await loadCustomers()
      }
      closeEditModal()
      showNotification('✅ Changes saved successfully')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }
  const handleCreateCurrency = async (e) => {
    e.preventDefault()
    if (!currencyForm.code || !currencyForm.name || !currencyForm.symbol) {
      setError('Currency code, name, and symbol are required')
      return
    }
    let exchangeRate = Number(currencyForm.exchangeRate || 1)
    const fromQuote = exchangeRateFromUnitsPerBase(currencyForm.oneUsdEquals)
    if (!currencyForm.baseCurrency && fromQuote !== null) exchangeRate = fromQuote
    if (currencyForm.baseCurrency) exchangeRate = 1
    if (!currencyForm.baseCurrency && (!Number.isFinite(exchangeRate) || exchangeRate <= 0)) {
      setError(`For a non-base currency, enter a positive exchange rate (${erpBaseCurrencyCode} per 1 unit) or use 1 ${erpBaseCurrencyCode} = (units).`)
      return
    }
    setSaving(true)
    try {
      const { oneUsdEquals: _omitQuote, ...currencyBody } = currencyForm
      await erpAccountingAPI.createCurrency(token, { ...currencyBody, exchangeRate })
      setCurrencyForm({ code: '', name: '', symbol: '', exchangeRate: 1, baseCurrency: false, oneUsdEquals: '' })
      setShowCurrencyForm(false)
      await loadCurrencies()
      showNotification('✅ Currency created successfully')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create currency')
    } finally {
      setSaving(false)
    }
  }
  const handleSyncCurrencyMaster = async () => {
    setSaving(true)
    try {
      const response = await erpAccountingAPI.seedDefaultCurrencies(token)
      await loadCurrencies()
      showNotification(`✅ Currency master synced (${response.createdCount || 0} created, ${response.normalizedCount || 0} updated)`)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to sync currency master')
    } finally {
      setSaving(false)
    }
  }
  const handleCreateMapping = async (e) => {
    e.preventDefault()
    if (!mappingForm.mappingType || !mappingForm.debitAccountId || !mappingForm.creditAccountId) {
      setError('Mapping type, debit account, and credit account are required')
      return
    }
    setSaving(true)
    try {
      await erpAccountingAPI.createMapping(token, mappingForm)
      setMappingForm({ mappingType: '', debitAccountId: '', creditAccountId: '', department: '', description: '' })
      setShowMappingForm(false)
      await loadMappings()
      showNotification('✅ Mapping created successfully')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create mapping')
    } finally {
      setSaving(false)
    }
  }
  const handleEditMapping = (mapping) => openEditModal('mapping', mapping)
  const handleDeleteMapping = async (mapping) => {
    if (!window.confirm(`Deactivate mapping ${mapping.mappingType}?`)) return
    try {
      await erpAccountingAPI.deleteMapping(token, mapping._id)
      await loadMappings()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete mapping')
    }
  }
  const handleEditCurrency = (currency) => openEditModal('currency', currency)
  const handleDeleteCurrency = async (currency) => {
    if (!window.confirm(`Delete currency ${currency.code}?`)) return
    try {
      await erpAccountingAPI.deleteCurrency(token, currency._id)
      await loadCurrencies()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete currency')
    }
  }
  const handleEditCustomer = (customer) => openEditModal('customer', customer)
  const handleDeleteCustomer = async (customer) => {
    if (!window.confirm(`Deactivate customer ${customer.name}?`)) return
    try {
      await erpAccountingAPI.deleteCustomer(token, customer._id)
      await loadCustomers()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete customer')
    }
  }
  const handleEditLedger = (entry) => {
    setEditState({
      type: 'ledger',
      record: entry,
      form: {
        date: new Date(entry.date).toISOString().slice(0, 10),
        debitAccountId: entry.debitAccountId?._id || '',
        creditAccountId: entry.creditAccountId?._id || '',
        amount: entry.amount,
        description: entry.description,
        referenceType: entry.referenceType,
        currency: entry.currency,
      },
    })
  }
  const handleReverseLedger = async (entryOrVoucher) => {
    const entry = entryOrVoucher?.representative || entryOrVoucher
    const entryIds = Array.isArray(entryOrVoucher?.entryIds) && entryOrVoucher.entryIds.length
      ? entryOrVoucher.entryIds
      : [entry?._id].filter(Boolean)
    const lineLabel = entryIds.length > 1 ? `${entryIds.length} ledger lines` : 'ledger entry'
    const voucherLabel = extractLedgerJvDocNoFromDescription(entry?.description) || entry?.referenceType || 'entry'
    if (!window.confirm(`Remove ${voucherLabel} (${lineLabel}) from the ledger? This hides the voucher; balances will exclude these lines.`)) return
    try {
      setSaving(true)
      await Promise.all(entryIds.map((id) => erpAccountingAPI.deleteLedgerEntry(token, id)))
      await loadLedger()
      setError('')
      showNotification(`✅ Voucher removed (${entryIds.length} line${entryIds.length === 1 ? '' : 's'})`)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to remove voucher')
    } finally {
      setSaving(false)
    }
  }
  const handleReconcileLedger = async (entry) => {
    try {
      setSaving(true)
      await erpAccountingAPI.reconcileLedgerEntry(token, entry._id)
      await loadLedger()
      showNotification(`✅ Entry marked as ${entry.bankReconciled ? 'Unreconciled' : 'Reconciled'}`)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update reconciliation status')
    } finally {
      setSaving(false)
    }
  }
  const handleSaveEditLedger = async () => {
    if (!editState.form.debitAccountId || !editState.form.creditAccountId || !editState.form.amount) {
      setError('All fields required')
      return
    }
    if (editState.form.debitAccountId === editState.form.creditAccountId) {
      setError('Debit and Credit accounts must be different')
      return
    }
    try {
      setSaving(true)
      await erpAccountingAPI.updateLedgerEntry(token, editState.record._id, editState.form)
      await loadLedger()
      setEditState({ type: '', record: null, form: {} })
      setError('')
      showNotification('✅ Entry updated successfully')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update entry')
    } finally {
      setSaving(false)
    }
  }
  if (!token) {
    return (
      <div style={{ padding: '2rem', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '0.5rem', color: '#DC2626', textAlign: 'center' }}>
        <p style={{ fontSize: '1rem', fontWeight: '500' }}>🔒 Please log in to access this module.</p>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* <h2 style={{ marginBottom: '1.5rem', color: C.t1, fontSize: '1.5rem', fontWeight: '700' }}>
        📊 ERP Accounting System
      </h2> */}
      {error && <div style={{ background: C.danger, color: '#FFFFFF', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>{error}</div>}
      {success && <div style={{ background: C.s1, color: '#FFFFFF', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>{success}</div>}
      {activeTab === 'dashboard' && (
      <ERPDashboardTab
        activeTab={activeTab}
        C={C}
        dashWidgets={dashWidgets}
        setDashWidgets={setDashWidgets}
        dashEditMode={dashEditMode}
        setDashEditMode={setDashEditMode}
        dashHoveredWid={dashHoveredWid}
        setDashHoveredWid={setDashHoveredWid}
        dashWidgetCols={dashWidgetCols}
        setDashWidgetCols={setDashWidgetCols}
        dashCustomizeOpen={dashCustomizeOpen}
        setDashCustomizeOpen={setDashCustomizeOpen}
        dashPickSelected={dashPickSelected}
        setDashPickSelected={setDashPickSelected}
        dashDragSrc={dashDragSrc}
        ERP_DASH_ALL_WIDGETS={ERP_DASH_ALL_WIDGETS}
        dashboard={dashboard}
        dashChatMessages={dashChatMessages}
        setActiveTab={setActiveTabGuarded}
        onNavigateMain={onNavigateMain}
        goldPriceUSD={goldPriceUSD}
        silverPriceUSD={silverPriceUSD}
        dashboardLiveRecalcEnabled={activeTab === 'dashboard' && (goldPriceUSD > 0 || silverPriceUSD > 0)}
      />
      )}
      {/* CHART OF ACCOUNTS TAB */}
      {activeTab === 'accounts' && (
      <ERPAccountsTabContainer activeTab={activeTab}>
        <div>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ color: C.ink, fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>Chart of Accounts</h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: C.inkSoft }}>
              Hierarchical account tree — right-click any account for more options.
            </p>
          </div>
          <Suspense fallback={<ErpSubTabFallback />}>
            <ChartOfAccountsTree canManageAccounts={canManageAccounts} onOpenSummary={handleOpenAccountSummaryFromTree} />
          </Suspense>
        </div>
      </ERPAccountsTabContainer>
      )}
      {/* LEDGER TAB */}
      {activeTab === 'customers' && (
        <Suspense fallback={<ErpSubTabFallback />}>
          <ERPCustomersTab
            C={C}
            canManageCustomers={canManageCustomers}
            showCustomerForm={showCustomerForm}
            setShowCustomerForm={setShowCustomerForm}
            customerForm={customerForm}
            setCustomerForm={setCustomerForm}
            handleCreateCustomer={handleCreateCustomer}
            saving={saving}
            customers={customers}
            handleEditCustomer={handleEditCustomer}
            handleDeleteCustomer={handleDeleteCustomer}
          />
        </Suspense>
      )}
      {/* CUSTOMER MARGIN TAB */}
      {activeTab === 'customer-margin' && (
        <Suspense fallback={<ErpSubTabFallback />}>
          <ERPCustomerMarginTab
            C={C}
            setActiveTabGuarded={setActiveTabGuarded}
            customerMarginSort={customerMarginSort}
            setCustomerMarginSort={setCustomerMarginSort}
            customerMarginCompactView={customerMarginCompactView}
            setCustomerMarginCompactView={setCustomerMarginCompactView}
            customerMarginSearch={customerMarginSearch}
            setCustomerMarginSearch={setCustomerMarginSearch}
            customerMarginRows={customerMarginRows}
            handleCustomerMarginRowContextMenu={handleCustomerMarginRowContextMenu}
            customerMarginContextMenu={customerMarginContextMenu}
          />
        </Suspense>
      )}
      {/* SUPPLIER MARGIN TAB */}
      {activeTab === 'supplier-margin' && (
        <Suspense fallback={<ErpSubTabFallback />}>
          <ERPSupplierMarginTab
            C={C}
            setActiveTabGuarded={setActiveTabGuarded}
            supplierMarginSort={supplierMarginSort}
            setSupplierMarginSort={setSupplierMarginSort}
            supplierMarginCompactView={supplierMarginCompactView}
            setSupplierMarginCompactView={setSupplierMarginCompactView}
            supplierMarginSearch={supplierMarginSearch}
            setSupplierMarginSearch={setSupplierMarginSearch}
            supplierMarginRows={supplierMarginRows}
            handleSupplierMarginRowContextMenu={handleSupplierMarginRowContextMenu}
            supplierMarginContextMenu={supplierMarginContextMenu}
          />
        </Suspense>
      )}
      {activeTab === 'fixing-register' && (
        <Suspense fallback={<ErpSubTabFallback />}>
          <ERPFixingRegisterTab
            activeTab={activeTab}
            C={C}
            setActiveTab={setActiveTabGuarded}
            fixingRegPanelOffset={fixingRegPanelOffset}
            fixingRegPanelDrag={fixingRegPanelDrag}
            beginFixingRegPanelDrag={beginFixingRegPanelDrag}
            handleFixingRegProceed={handleFixingRegProceed}
            fixingRegLoading={fixingRegLoading}
            fixingRegFilter={fixingRegFilter}
            setFixingRegFilter={setFixingRegFilter}
            fixingRegisterStockTypeOptions={fixingRegisterStockTypeOptions}
            setFixingRegShown={setFixingRegShown}
            setFixingRegResults={setFixingRegResults}
            setFixingRegError={setFixingRegError}
            fixingRegError={fixingRegError}
            fixingRegShown={fixingRegShown}
            fixingRegOpening={fixingRegOpening}
            fixingRegResults={fixingRegResults}
            fixingRegFmtQty={fixingRegFmtQty}
            fixingRegFmtRate={fixingRegFmtRate}
            fixingRegFmtAmt={fixingRegFmtAmt}
          />
        </Suspense>
      )}
      {(activeTab === 'ledger' || showLedgerForm) && (
        <Suspense fallback={<ErpSubTabFallback />}>
          <ERPLedgerTab
        activeTab={activeTab}
        C={C}
        canManageAccounts={canManageAccounts}
        showLedgerForm={showLedgerForm}
        openJvModal={openJvModal}
        ledgerVoucherTab={ledgerVoucherTab}
        setLedgerVoucherTab={setLedgerVoucherTab}
        JV_MODE_META={JV_MODE_META}
        resolveJvModeMeta={resolveJvModeMeta}
        jvMode={jvMode}
        getJvValidation={getJvValidation}
        jvLines={jvLines}
        baseCurrencyCode={baseCurrencyCode}
        closeJvModal={closeJvModal}
        jvModalSize={jvModalSize}
        jvModalOffset={jvModalOffset}
        jvModalDrag={jvModalDrag}
        jvModalResize={jvModalResize}
        beginJvModalDrag={beginJvModalDrag}
        switchJvMode={switchJvMode}
        jvEditEntryIds={jvEditEntryIds}
        currencies={currencies}
        jvHeader={jvHeader}
        setJvHeader={setJvHeader}
        bankJvComboGroups={bankJvComboGroups}
        jvComboGroups={jvComboGroups}
        resolveJvLineAccount={resolveJvLineAccount}
        handleJvAccountKeyDown={handleJvAccountKeyDown}
        updateJvLine={updateJvLine}
        handleJvLineKeyDown={handleJvLineKeyDown}
        removeJvLine={removeJvLine}
        addJvLine={addJvLine}
        handlePrintJvVoucher={handlePrintJvVoucher}
        handleSaveMultiLineJV={handleSaveMultiLineJV}
        saving={saving}
        beginJvModalResize={beginJvModalResize}
        ledgerFilters={ledgerFilters}
        setLedgerFilters={setLedgerFilters}
        modalInputStyle={ERP_MODAL_INPUT_STYLE}
        LEDGER_DEPARTMENTS={LEDGER_DEPARTMENTS}
        LEDGER_REFERENCE_TYPES={LEDGER_REFERENCE_TYPES}
        accounts={accounts}
        sorting={sorting}
        setSorting={setSorting}
        pagination={pagination}
        setPagination={setPagination}
        ITEMS_PER_PAGE={ITEMS_PER_PAGE}
        ledger={ledger}
        ledgerMeta={ledgerMeta}
        loadLedger={loadLedger}
        jvReadOnly={jvReadOnly}
        handleOpenJv={handleOpenJv}
        handleEditJv={handleEditJv}
        handleEditLedger={handleEditLedger}
        handleReconcileLedger={handleReconcileLedger}
        handleReverseLedger={handleReverseLedger}
        isFinance={isFinance}
        handleRepairJvFxPreview={handleRepairJvFxPreview}
        handleRepairJvFxApply={handleRepairJvFxApply}
          />
        </Suspense>
      )}
      {/* ACCOUNT MAPPINGS TAB */}
      {activeTab === 'mappings' && (
        <Suspense fallback={<ErpSubTabFallback />}>
          <ERPMappingsTab
            C={C}
            canManageAccounts={canManageAccounts}
            showMappingForm={showMappingForm}
            setShowMappingForm={setShowMappingForm}
            mappingFilters={mappingFilters}
            setMappingFilters={setMappingFilters}
            LEDGER_DEPARTMENTS={LEDGER_DEPARTMENTS}
            mappingSummary={mappingSummary}
            getDepartmentBadgeStyle={getDepartmentBadgeStyle}
            mappingForm={mappingForm}
            setMappingForm={setMappingForm}
            accounts={accounts}
            handleCreateMapping={handleCreateMapping}
            saving={saving}
            mappings={mappings}
            sorting={sorting}
            setSorting={setSorting}
            pagination={pagination}
            setPagination={setPagination}
            ITEMS_PER_PAGE={ITEMS_PER_PAGE}
            token={token}
            loadMappings={loadMappings}
            showNotification={showNotification}
            setError={setError}
            setTestMapping={setTestMapping}
            setShowMappingTest={setShowMappingTest}
            handleEditMapping={handleEditMapping}
            handleDeleteMapping={handleDeleteMapping}
          />
        </Suspense>
      )}
      {/* ACCOUNT SUMMARY TAB */}
      {activeTab === 'enquiry' && (
        <Suspense fallback={<ErpSubTabFallback />}>
          <ERPEnquiryTab
            activeTab={activeTab}
            C={C}
            isSuperAdmin={isSuperAdmin}
            isFinance={isFinance}
            canViewBalanceEnquiry={canViewBalanceEnquiry}
            handleAccountEnquiry={handleAccountEnquiry}
            accountEnquiryCode={accountEnquiryCode}
            setAccountEnquiryCode={setAccountEnquiryCode}
            setEnquiryStatus={setEnquiryStatus}
            filteredGroupedSummaryAccounts={filteredGroupedSummaryAccounts}
            fetchAccountEnquiryByCode={fetchAccountEnquiryByCode}
            enquiryLoading={enquiryLoading}
            enquiryStatus={enquiryStatus}
            summaryAccountsLoading={summaryAccountsLoading}
            safeSummaryAccounts={safeSummaryAccounts}
            enquiryHistory={enquiryHistory}
            buildAccountEnquiryHref={buildAccountEnquiryHref}
          />
        </Suspense>
      )}
      {(activeTab === 'transactions' || jumpToTransactionId) && (
        <Suspense fallback={<ErpSubTabFallback />}>
          <ERPTransactionsTab
        activeTab={activeTab}
        C={C}
        emptyCardStyle={ERP_EMPTY_CARD_STYLE}
        transactionSummary={transactionSummary}
        selectedTransactionId={selectedTransactionId}
        setSelectedTransactionId={setSelectedTransactionId}
        transactionFilters={transactionFilters}
        setTransactionFilters={setTransactionFilters}
        modalInputStyle={ERP_MODAL_INPUT_STYLE}
        availableTransactionTypes={availableTransactionTypes}
        TRANSACTION_TYPE_LABELS={TRANSACTION_TYPE_LABELS}
        loadTransactions={loadTransactions}
        handleExportTransactionsCsv={handleExportTransactionsCsv}
        handleExportTransactionsXlsx={handleExportTransactionsXlsx}
        handleExportTransactionsPdf={handleExportTransactionsPdf}
        getTransactionBulkSelectionLabel={getTransactionBulkSelectionLabel}
        selectedTransactionIds={selectedTransactionIds}
        setSelectedTransactionIds={setSelectedTransactionIds}
        transactionWorkflowNote={transactionWorkflowNote}
        setTransactionWorkflowNote={setTransactionWorkflowNote}
        saving={saving}
        handleBulkTransactionAction={handleBulkTransactionAction}
        isSuperAdmin={isSuperAdmin}
        isFinance={isFinance}
        handleCreateTransaction={handleCreateTransaction}
        isTransactionEditMode={isTransactionEditMode}
        resetTransactionComposer={resetTransactionComposer}
        transactionForm={transactionForm}
        setTransactionForm={setTransactionForm}
        currencies={currencies}
        customers={customers}
        vendors={vendors}
        inventoryProducts={inventoryProducts}
        mappings={mappings}
        accounts={accounts}
        selectedTransaction={selectedTransaction}
        TRANSACTION_STATUS_STYLES={TRANSACTION_STATUS_STYLES}
        resolveTransactionAttachmentUrl={resolveTransactionAttachmentUrl}
        transactionAttachmentInputKey={transactionAttachmentInputKey}
        handleUploadTransactionAttachment={handleUploadTransactionAttachment}
        handleDeleteTransactionAttachment={handleDeleteTransactionAttachment}
        handleTransactionAction={handleTransactionAction}
        transactionCommentDraft={transactionCommentDraft}
        setTransactionCommentDraft={setTransactionCommentDraft}
        handleAddTransactionComment={handleAddTransactionComment}
        handleSendTransactionChat={handleSendTransactionChat}
        formatTransactionCommentKind={formatTransactionCommentKind}
        formatTransactionAuditEntry={formatTransactionAuditEntry}
        TRANSACTION_ACTION_LABELS={TRANSACTION_ACTION_LABELS}
        transactions={transactions}
        toggleVisibleTransactionSelection={toggleVisibleTransactionSelection}
        allVisibleTransactionsSelected={allVisibleTransactionsSelected}
        toggleTransactionSelection={toggleTransactionSelection}
        populateTransactionForm={populateTransactionForm}
        handleDeleteTransaction={handleDeleteTransaction}
        transactionMeta={transactionMeta}
        transactionPageCount={transactionPageCount}
        loading={transactionsLoading}
          />
        </Suspense>
      )}
      {activeTab === 'reports' && (
        <Suspense fallback={<ErpSubTabFallback />}>
          <ERPReportsTab
        activeTab={activeTab}
        C={C}
        modalInputStyle={ERP_MODAL_INPUT_STYLE}
        reportFilters={reportFilters}
        setReportFilters={setReportFilters}
        ACCOUNT_TYPES={ACCOUNT_TYPES}
        LEDGER_REFERENCE_TYPES={LEDGER_REFERENCE_TYPES}
        handleExportReportCsv={handleExportReportCsv}
        handleExportReportXlsx={handleExportReportXlsx}
        handleExportReportPdf={handleExportReportPdf}
        handlePrintCurrentReport={handlePrintCurrentReport}
        emptyCardStyle={ERP_EMPTY_CARD_STYLE}
        reports={reports}
        reportView={reportView}
        setReportView={setReportView}
        getReportPeriodLabel={getReportPeriodLabel}
        formatDirectionalBalance={formatDirectionalBalance}
        handleTrialAccountDrilldown={handleTrialAccountDrilldown}
        formatMoney={formatMoney}
        handleReportAccountDrilldown={handleReportAccountDrilldown}
        formatMoneyAbs={formatMoneyAbs}
        selectedReportAccountId={selectedReportAccountId}
        setSelectedReportAccountId={setSelectedReportAccountId}
        accounts={accounts}
        setSelectedReportAccountCode={setSelectedReportAccountCode}
        loadLedgerReport={loadLedgerReport}
        selectedReportAccountCode={selectedReportAccountCode}
        ledgerReportRows={ledgerReportRows}
        loading={reportsLoading}
        voucherSource={voucherSource}
        setVoucherSource={setVoucherSource}
        modalBackdropStyle={ERP_MODAL_BACKDROP_STYLE}
        modalCardStyle={ERP_MODAL_CARD_STYLE}
        voucherSourceLoading={voucherSourceLoading}
        handleOpenVoucherSource={handleOpenVoucherSource}
        handleJumpToTransaction={handleJumpToTransaction}
          />
        </Suspense>
      )}
      {/* VENDORS TAB */}
      {activeTab === 'vendors' && (
        <Suspense fallback={<ErpSubTabFallback />}>
          <ERPVendorsTab
        activeTab={activeTab}
        C={C}
        modalInputStyle={ERP_MODAL_INPUT_STYLE}
        emptyCardStyle={ERP_EMPTY_CARD_STYLE}
        saving={saving}
        canManageVendors={canManageVendors}
        vendorSummary={vendorSummary}
        vendorPaymentCalendar={vendorPaymentCalendar}
        vendorComplianceSummary={vendorComplianceSummary}
        vendorOverdueQueue={vendorOverdueQueue}
        vendorFilters={vendorFilters}
        showVendorForm={showVendorForm}
        editingVendorId={editingVendorId}
        vendorForm={vendorForm}
        vendors={vendors}
        selectedVendorId={selectedVendorId}
        selectedVendorDetails={selectedVendorDetails}
        vendorPermissions={vendorPermissions}
        vendorWorkflowReason={vendorWorkflowReason}
        vendorDocumentForm={vendorDocumentForm}
        handleVendorFilterSearch={handleVendorFilterSearch}
        setEditingVendorId={setEditingVendorId}
        setShowVendorForm={setShowVendorForm}
        loadVendorOverdueQueue={loadVendorOverdueQueue}
        setVendorFilters={setVendorFilters}
        handleCreateVendor={handleCreateVendor}
        setVendorForm={setVendorForm}
        handleVendorSelect={handleVendorSelect}
        handleEditVendor={handleEditVendor}
        handleDeleteVendor={handleDeleteVendor}
        setVendorWorkflowReason={setVendorWorkflowReason}
        handleVendorWorkflowStatus={handleVendorWorkflowStatus}
        handleAddVendorDocument={handleAddVendorDocument}
        handleVendorTableDocumentUpload={handleVendorTableDocumentUpload}
        setVendorDocumentForm={setVendorDocumentForm}
        handleDeleteVendorDocument={handleDeleteVendorDocument}
          />
        </Suspense>
      )}
      {/* INVENTORY TAB */}
      {activeTab === 'inventory' && (
        <Suspense fallback={<ErpSubTabFallback />}>
          <ERPInventoryTab
        activeTab={activeTab}
        C={C}
        modalInputStyle={ERP_MODAL_INPUT_STYLE}
        isSuperAdmin={isSuperAdmin}
        isFinance={isFinance}
        saving={saving}
        token={token}
        tenantKey={inventoryTenantKey}
        liveMetalSnapshot={erpLiveMetalSnapshot}
        liveMetalError={liveMetalFetchError}
        loadInventory={loadInventory}
        inventoryMappingProducts={inventoryMappingProducts}
        inventoryCatalogProducts={inventoryCatalogProducts}
        inventoryProductsByMetal={inventoryProductsByMetal}
        inventoryReportProducts={inventoryReportProducts}
        inventoryTotalQuantity={inventoryTotalQuantity}
        inventoryTotalValue={inventoryTotalValue}
        inventoryLowStockCount={inventoryLowStockCount}
        inventoryMetalBreakdown={inventoryMetalBreakdown}
        inventoryTopProducts={inventoryTopProducts}
        legacyInventoryProducts={legacyInventoryProducts}
        inventoryVatFilter={inventoryVatFilter}
        inventoryVatSortDir={inventoryVatSortDir}
        sortedInventoryTableRows={sortedInventoryTableRows}
        stockMovements={stockMovements}
        stockMovementsLoading={stockMovementsLoading}
        stockMovementsFilter={stockMovementsFilter}
        showInventoryProductModal={showInventoryProductModal}
        showInventoryMappingModal={showInventoryMappingModal}
        editingProductId={editingProductId}
        editingInventoryProductId={editingInventoryProductId}
        stockTypeModalTab={stockTypeModalTab}
        inventoryModalOffset={inventoryModalOffset}
        inventoryModalDragging={inventoryModalDragging}
        inventoryProductModalOffset={inventoryProductModalOffset}
        inventoryProductModalDragging={inventoryProductModalDragging}
        inventoryMappingForm={inventoryMappingForm}
        inventoryProductForm={inventoryProductForm}
        inventoryStockTypeOptions={inventoryStockTypeOptions}
        inventoryProductPurityWeight={inventoryProductPurityWeight}
        setEditingProductId={setEditingProductId}
        setInventoryMappingForm={setInventoryMappingForm}
        setInventoryStockCodeManualOverride={setInventoryStockCodeManualOverride}
        setInventoryModalOffset={setInventoryModalOffset}
        setShowInventoryMappingModal={setShowInventoryMappingModal}
        setEditingInventoryProductId={setEditingInventoryProductId}
        setInventoryProductModalOffset={setInventoryProductModalOffset}
        setShowInventoryProductModal={setShowInventoryProductModal}
        setInventoryVatFilter={setInventoryVatFilter}
        setInventoryVatSortDir={setInventoryVatSortDir}
        setStockMovementsFilter={setStockMovementsFilter}
        setInventoryProductForm={setInventoryProductForm}
        setStockTypeModalTab={setStockTypeModalTab}
        createInventoryMappingForm={createInventoryMappingForm}
        decodeInventoryCategoryMeta={decodeInventoryCategoryMeta}
        titleCaseWords={titleCaseWords}
        formatVatPercent={formatVatPercent}
        resolveMainStockValueFromForm={resolveMainStockValueFromForm}
        handleEditProduct={handleEditProduct}
        handleDeleteProduct={handleDeleteProduct}
        handleEditInventoryCatalogProduct={handleEditInventoryCatalogProduct}
        handleDeleteInventoryCatalogProduct={handleDeleteInventoryCatalogProduct}
        loadStockLedger={loadStockLedger}
        resetInventoryProductForm={resetInventoryProductForm}
        handleCreateInventoryCatalogProduct={handleCreateInventoryCatalogProduct}
        handleInventoryProductModalDragStart={handleInventoryProductModalDragStart}
        resetInventoryMappingForm={resetInventoryMappingForm}
        handleCreateProduct={handleCreateProduct}
        handleInventoryModalDragStart={handleInventoryModalDragStart}
          />
        </Suspense>
      )}
      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <Suspense fallback={<ErpSubTabFallback />}>
          <ERPSettingsTab
            C={C}
            selectedBrandingKey={selectedBrandingKey}
            setSelectedBrandingKey={setSelectedBrandingKey}
            handleSelectBrandingProfile={handleSelectBrandingProfile}
            brandingProfiles={brandingProfiles}
            brandingForm={brandingForm}
            setBrandingForm={setBrandingForm}
            reportBranding={reportBranding}
            handleBrandingLogoFile={handleBrandingLogoFile}
            saving={saving}
            canManageAccounts={canManageAccounts}
            handleSaveBranding={handleSaveBranding}
            inventoryStockCodeSettings={inventoryStockCodeSettings}
            setInventoryStockCodeSettings={setInventoryStockCodeSettings}
            handleCreateBrandingDraft={handleCreateBrandingDraft}
            brandingPreviewLogo={brandingPreviewLogo}
            brandingPreview={brandingPreview}
          />
        </Suspense>
      )}
      {/* CURRENCIES TAB */}
      {activeTab === 'currencies' && (
        <Suspense fallback={<ErpSubTabFallback />}>
          <ERPCurrenciesTab
            C={C}
            erpBaseCurrencyCode={erpBaseCurrencyCode}
            canManageAccounts={canManageAccounts}
            showCurrencyForm={showCurrencyForm}
            setShowCurrencyForm={setShowCurrencyForm}
            handleSyncCurrencyMaster={handleSyncCurrencyMaster}
            saving={saving}
            setActiveTabGuarded={setActiveTabGuarded}
            usdConversion={usdConversion}
            setUsdConversion={setUsdConversion}
            usdToTargetAmount={usdToTargetAmount}
            selectedUsdConversionRate={selectedUsdConversionRate}
            currencyForm={currencyForm}
            setCurrencyForm={setCurrencyForm}
            handleCreateCurrency={handleCreateCurrency}
            currencies={currencies}
            handleEditCurrency={handleEditCurrency}
            handleDeleteCurrency={handleDeleteCurrency}
          />
        </Suspense>
      )}
      {editState.record && (
        <div style={ERP_MODAL_BACKDROP_STYLE} onClick={closeEditModal}>
          <div style={ERP_MODAL_CARD_STYLE} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', color: C.ink, fontSize: '1.1rem', fontWeight: '700' }}>
              Edit {editState.type.charAt(0).toUpperCase() + editState.type.slice(1)}
            </h3>
            <form onSubmit={handleSaveEdit}>
              {editState.type === 'account' && (
                <>
                  <input
                    value={editState.form.accountName || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, accountName: e.target.value } }))}
                    placeholder="Account Name"
                    style={ERP_MODAL_INPUT_STYLE}
                  />
                  <input
                    value={editState.form.description || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, description: e.target.value } }))}
                    placeholder="Description"
                    style={ERP_MODAL_INPUT_STYLE}
                  />
                  <input
                    value={editState.form.department || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, department: e.target.value } }))}
                    placeholder="Department"
                    style={ERP_MODAL_INPUT_STYLE}
                  />
                  <input
                    value={editState.form.currency || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, currency: e.target.value } }))}
                    placeholder="Currency"
                    style={ERP_MODAL_INPUT_STYLE}
                  />
                </>
              )}
              {editState.type === 'mapping' && (
                <>
                  <input
                    value={editState.form.mappingType || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, mappingType: e.target.value } }))}
                    placeholder="Mapping Type"
                    style={ERP_MODAL_INPUT_STYLE}
                  />
                  <select
                    value={editState.form.debitAccountId || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, debitAccountId: e.target.value } }))}
                    style={ERP_MODAL_INPUT_STYLE}
                  >
                    <option value="">Select Debit Account</option>
                    {accounts.map((account) => (
                      <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>
                    ))}
                  </select>
                  <select
                    value={editState.form.creditAccountId || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, creditAccountId: e.target.value } }))}
                    style={ERP_MODAL_INPUT_STYLE}
                  >
                    <option value="">Select Credit Account</option>
                    {accounts.map((account) => (
                      <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>
                    ))}
                  </select>
                  <select
                    value={editState.form.department || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, department: e.target.value } }))}
                    style={ERP_MODAL_INPUT_STYLE}
                  >
                    <option value="">Shared / All Departments</option>
                    {LEDGER_DEPARTMENTS.map((department) => (
                      <option key={department} value={department}>{department}</option>
                    ))}
                  </select>
                  <input
                    value={editState.form.description || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, description: e.target.value } }))}
                    placeholder="Description"
                    style={ERP_MODAL_INPUT_STYLE}
                  />
                </>
              )}
              {editState.type === 'currency' && (
                <>
                  <input
                    value={editState.form.code || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, code: e.target.value.toUpperCase() } }))}
                    placeholder="Code"
                    style={ERP_MODAL_INPUT_STYLE}
                  />
                  <input
                    value={editState.form.name || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, name: e.target.value } }))}
                    placeholder="Name"
                    style={ERP_MODAL_INPUT_STYLE}
                  />
                  <input
                    value={editState.form.symbol || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, symbol: e.target.value } }))}
                    placeholder="Symbol"
                    style={ERP_MODAL_INPUT_STYLE}
                  />
                  <input
                    type="number"
                    step="0.0001"
                    value={editState.form.exchangeRate || 1}
                    onChange={(e) => setEditState((prev) => ({
                      ...prev,
                      form: { ...prev.form, exchangeRate: e.target.value, oneUsdEquals: '' },
                    }))}
                    placeholder="Exchange Rate"
                    style={ERP_MODAL_INPUT_STYLE}
                    disabled={Boolean(editState.form.baseCurrency)}
                  />
                  {!editState.form.baseCurrency && (
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editState.form.oneUsdEquals ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        const r = exchangeRateFromUnitsPerBase(v)
                        setEditState((prev) => ({
                          ...prev,
                          form: {
                            ...prev.form,
                            oneUsdEquals: v,
                            exchangeRate: r !== null ? String(r) : prev.form.exchangeRate,
                          },
                        }))
                      }}
                      placeholder={`1 ${erpBaseCurrencyCode} = (units of this currency)`}
                      style={ERP_MODAL_INPUT_STYLE}
                    />
                  )}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: C.ink, marginBottom: '0.75rem' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(editState.form.baseCurrency)}
                      onChange={(e) => {
                        const base = e.target.checked
                        setEditState((prev) => ({
                          ...prev,
                          form: {
                            ...prev.form,
                            baseCurrency: base,
                            exchangeRate: base ? 1 : prev.form.exchangeRate,
                            oneUsdEquals: base ? '' : prev.form.oneUsdEquals,
                          },
                        }))
                      }}
                    />
                    Set as base currency
                  </label>
                </>
              )}
              {editState.type === 'customer' && (
                <>
                  <input
                    value={editState.form.name || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, name: e.target.value } }))}
                    placeholder="Customer Name"
                    style={ERP_MODAL_INPUT_STYLE}
                  />
                  <input
                    value={editState.form.phone || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, phone: e.target.value } }))}
                    placeholder="Phone"
                    style={ERP_MODAL_INPUT_STYLE}
                  />
                  <input
                    value={editState.form.email || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, email: e.target.value } }))}
                    placeholder="Email"
                    style={ERP_MODAL_INPUT_STYLE}
                  />
                  <input
                    value={editState.form.address || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, address: e.target.value } }))}
                    placeholder="Address"
                    style={ERP_MODAL_INPUT_STYLE}
                  />
                  <input
                    value={editState.form.gstVat || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, gstVat: e.target.value } }))}
                    placeholder="GST/VAT"
                    style={ERP_MODAL_INPUT_STYLE}
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={editState.form.creditLimit || 0}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, creditLimit: e.target.value } }))}
                    placeholder="Credit Limit"
                    style={ERP_MODAL_INPUT_STYLE}
                  />
                  <input
                    type="number"
                    value={editState.form.paymentTermsDays || 0}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, paymentTermsDays: e.target.value } }))}
                    placeholder="Payment Terms (Days)"
                    style={ERP_MODAL_INPUT_STYLE}
                  />
                  <input
                    value={editState.form.currency || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, currency: e.target.value.toUpperCase() } }))}
                    placeholder="Currency"
                    style={ERP_MODAL_INPUT_STYLE}
                  />
                  <input
                    value={editState.form.notes || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, notes: e.target.value } }))}
                    placeholder="Notes"
                    style={ERP_MODAL_INPUT_STYLE}
                  />
                </>
              )}
              {editState.type === 'ledger' && (
                <>
                  <input
                    type="date"
                    value={editState.form.date || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, date: e.target.value } }))}
                    style={ERP_MODAL_INPUT_STYLE}
                  />
                  <select
                    value={editState.form.debitAccountId || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, debitAccountId: e.target.value } }))}
                    style={ERP_MODAL_INPUT_STYLE}
                  >
                    <option value="">Select Debit Account</option>
                    {accounts.map((acc) => (
                      <option key={acc._id} value={acc._id}>{acc.accountCode} - {acc.accountName}</option>
                    ))}
                  </select>
                  <select
                    value={editState.form.creditAccountId || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, creditAccountId: e.target.value } }))}
                    style={ERP_MODAL_INPUT_STYLE}
                  >
                    <option value="">Select Credit Account</option>
                    {accounts.map((acc) => (
                      <option key={acc._id} value={acc._id}>{acc.accountCode} - {acc.accountName}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={editState.form.amount || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, amount: parseFloat(e.target.value) || 0 } }))}
                    placeholder="Amount"
                    style={ERP_MODAL_INPUT_STYLE}
                  />
                  <input
                    value={editState.form.description || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, description: e.target.value } }))}
                    placeholder="Description"
                    style={ERP_MODAL_INPUT_STYLE}
                  />
                  <select
                    value={editState.form.referenceType || 'journal'}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, referenceType: e.target.value } }))}
                    style={ERP_MODAL_INPUT_STYLE}
                  >
                    <option value="journal">Journal</option>
                    <option value="invoice">Invoice</option>
                    <option value="payment">Payment</option>
                    <option value="purchase">Purchase</option>
                    <option value="expense">Expense</option>
                    <option value="payroll">Payroll</option>
                  </select>
                </>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" onClick={closeEditModal} style={{ padding: '0.6rem 1rem', background: '#FFFFFF', color: C.ink, border: '1px solid #D1D5DB', borderRadius: '0.5rem', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} style={{ padding: '0.6rem 1rem', background: C.s1, color: '#FFFFFF', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* VOUCHERS TAB */}
      {(activeTab === 'vouchers' || jumpToVoucher) && (
      <ERPVouchersTabContainer activeTab={activeTab}>
        <Suspense fallback={<div style={{ padding: '1rem', color: C.inkSoft }}>Loading vouchers...</div>}>
          <VoucherTab
            token={token}
            user={user}
            accounts={accounts}
            customers={customers}
            vendors={vendors}
            currencies={currencies}
            reportBranding={branding}
            pendingOpenTransactionId={jumpToVoucher?.id || null}
            pendingOpenTransactionType={jumpToVoucher?.type || null}
            onPendingOpenTransactionConsumed={onJumpToVoucherConsumed}
          />
        </Suspense>
      </ERPVouchersTabContainer>
      )}
      {/* DIRECT DEALS TAB */}
      {activeTab === 'direct-deals' && (
        <Suspense fallback={<ErpSubTabFallback />}>
          <DirectDealsTab
            token={token}
            customers={customers}
            currencies={currencies}
            canManage={canManageDirectDeals}
            isSuperAdmin={isSuperAdmin}
          />
        </Suspense>
      )}
      {/* TEST MAPPING MODAL */}
      {showMappingTest && testMapping && (
        <div style={ERP_MODAL_BACKDROP_STYLE} onClick={() => setShowMappingTest(false)}>
          <div style={ERP_MODAL_CARD_STYLE} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem', color: C.ink, fontWeight: '700' }}>
              Test Mapping: {testMapping.mappingType}
            </h3>
            <div style={{ background: '#F9FAFB', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
              <p style={{ color: C.inkSoft, marginBottom: '0.75rem' }}>
                <strong>Usage Count:</strong> {testMapping.usageCount || 0} times used
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
                <div>
                  <p style={{ color: C.t3, fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem' }}>DEBIT ACCOUNT</p>
                  <p style={{ color: C.ink, fontWeight: '600' }}>{testMapping.debitAccountId?.accountCode}</p>
                  <p style={{ color: C.t3, fontSize: '0.875rem' }}>{testMapping.debitAccountId?.accountName}</p>
                </div>
                <div>
                  <p style={{ color: C.t3, fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem' }}>CREDIT ACCOUNT</p>
                  <p style={{ color: C.ink, fontWeight: '600' }}>{testMapping.creditAccountId?.accountCode}</p>
                  <p style={{ color: C.t3, fontSize: '0.875rem' }}>{testMapping.creditAccountId?.accountName}</p>
                </div>
              </div>
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${C.t2}` }}>
                <p style={{ color: C.t3, fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem' }}>DESCRIPTION</p>
                <p style={{ color: C.ink }}>{testMapping.description || '(No description)'}</p>
              </div>
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${C.t2}`, background: '#ECFDF5', padding: '0.75rem', borderRadius: '0.375rem' }}>
                <p style={{ color: '#065F46', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>✓ Sample Transaction</p>
                <p style={{ color: '#047857', fontSize: '0.875rem' }}>When this mapping is applied:</p>
                <ul style={{ color: '#047857', fontSize: '0.875rem', marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                  <li>Debit: {testMapping.debitAccountId?.accountCode}</li>
                  <li>Credit: {testMapping.creditAccountId?.accountCode}</li>
                  <li>Amount: Enter any amount</li>
                </ul>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowMappingTest(false)} style={{ padding: '0.6rem 1rem', background: '#FFFFFF', color: C.ink, border: '1px solid #D1D5DB', borderRadius: '0.5rem', cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ACCOUNT SUMMARY POPUP MODAL - TRADING PLATFORM STYLE */}
      <AccountEnquiryModal
        open={showEnquiryModal}
        onClose={() => setShowEnquiryModal(false)}
        enquiryBackdropColor={enquiryBackdropColor}
        enquiryModalOffset={enquiryModalOffset}
        enquiryModalDrag={enquiryModalDrag}
        beginEnquiryModalDrag={beginEnquiryModalDrag}
        enquiryLoading={enquiryLoading}
        accountEnquiryCode={accountEnquiryCode}
        setAccountEnquiryCode={setAccountEnquiryCode}
        setShowEnquiryLookupMenu={setShowEnquiryLookupMenu}
        showEnquiryLookupMenu={showEnquiryLookupMenu}
        filteredGroupedSummaryAccounts={filteredGroupedSummaryAccounts}
        setEnquiryStatus={setEnquiryStatus}
        fetchAccountEnquiryByCode={fetchAccountEnquiryByCode}
        enquiryStatus={enquiryStatus}
        accountEnquiryData={accountEnquiryData}
        modalPositionRows={modalPositionRows}
        formatStatementValue={formatStatementValue}
        getSignedColor={getSignedColor}
        formatDirectionalBalance={formatDirectionalBalance}
        unfixedMetalEntries={unfixedMetalEntries}
        formatStatementDate={formatStatementDate}
        fixedMetalSummary={fixedMetalSummary}
        unfixedMetalSummary={unfixedMetalSummary}
        unknownFixMetalEntries={unknownFixMetalEntries}
        modalTotalFundsDisplay={modalTotalFundsDisplay}
        modalRevaluationDisplay={modalRevaluationDisplay}
        modalNetEquityDisplay={modalNetEquityDisplay}
        modalMarginAmtDisplay={modalMarginAmtDisplay}
        modalExcessDisplay={modalExcessDisplay}
        modalMarginPctDisplay={modalMarginPctDisplay}
        enquirySuppressMetalSpotMtm={enquirySuppressMetalSpotMtm}
        excessCurrency={excessCurrency}
        setExcessCurrency={setExcessCurrency}
        baseCurrencyCode={baseCurrencyCode}
        statementDisplayCurrencyOptions={statementDisplayCurrencyOptions}
        filteredStatementEntries={filteredStatementEntries}
        recentPaymentReceiptEntry={recentPaymentReceiptEntry}
        resolveStatementReceiptNo={resolveStatementReceiptNo}
        statementFilters={statementFilters}
        setStatementFilters={setStatementFilters}
        statementReferenceTypes={statementReferenceTypes}
        statementDepartments={statementDepartments}
        setStatementMetalCommodityEnabled={setStatementMetalCommodityEnabled}
        statementMetalCommodityEnabled={statementMetalCommodityEnabled}
        statementFilterCurrencyOptions={statementFilterCurrencyOptions}
        statementMetalOptions={statementMetalOptions}
        statementDisplayCurrency={statementDisplayCurrency}
        showStatementAuditIds={showStatementAuditIds}
        setShowStatementAuditIds={setShowStatementAuditIds}
        statementTableRef={statementTableRef}
        convertStatementDisplayAmount={convertStatementDisplayAmount}
        resolveMetalCode={resolveMetalCode}
        statementSelectedMetalCode={statementSelectedMetalCode}
        pureWeightRunningByEntryKey={pureWeightRunningByEntryKey}
        formatStatementNullableValue={formatStatementNullableValue}
        canExportAccountSummary={canExportAccountSummary}
        handleViewStatement={handleViewStatement}
        buildAccountEnquiryHref={buildAccountEnquiryHref}
        handleExportEnquiryPdf={handleExportEnquiryPdf}
        getAccountEnquirySignedMetricColor={getAccountEnquirySignedMetricColor}
        formatAccountEnquiryExcessDisplay={formatAccountEnquiryExcessDisplay}
        resolveExposureDirection={resolveExposureDirection}
        isMetalStatementEntry={isMetalStatementEntry}
      />
      <StatementPreviewModal
        open={showStatementPreview}
        onClose={() => setShowStatementPreview(false)}
        title={statementPreviewTitle}
        html={statementPreviewHtml}
        loading={statementPreviewLoading}
      />
      <StatementExportOptionsModal
        open={exportOptionsOpen}
        onClose={() => setExportOptionsOpen(false)}
        onPrint={handlePrintStatement}
        onDownloadPdf={handleDownloadStatementPdf}
      />
    </div>
  )
}
export default ERPTab
