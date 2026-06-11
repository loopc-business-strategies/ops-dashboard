import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { getTenantBranding } from '../../config/tenantBranding'
import erpAccountingAPI from '../../api/erp-accounting'
import messagesAPI from '../../api/messages'
import { readSummaryAccountsCache, writeSummaryAccountsCache } from '../../utils/erpSummaryAccountsCache'
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
import ChartOfAccountsTree from './ChartOfAccountsTree'
import DirectDealsTab from './DirectDealsTab'
import { useERPTabStateAdapter } from './erp/useERPTabStateAdapter'
import { useErpDashWidgets } from './erp/useErpDashWidgets'
import { deriveErpAccessPolicy, getAvailableTransactionTypes } from './erp/accessPolicy'
import {
  ERPAccountsTabContainer,
  ERPEnquiryTabContainer,
  ERPVouchersTabContainer,
} from './erp/ERPTabContainers'
import {
  DEFAULT_INVENTORY_STOCK_CODE_SETTINGS,
  accountLookupText,
  buildAutoStockCode,
  buildUniqueStockCode,
  createInventoryMappingForm,
  createInventoryProductForm,
  createTransactionForm,
  decodeInventoryCategoryMeta,
  decodeInventoryCategoryPairs,
  encodeInventoryCategoryMeta,
  formatVatPercent,
  getTransactionActionLabels,
  getTransactionTypeLabels,
  resolveAccountIdFromInput,
  resolveMainStockValueFromForm,
  resolveTransactionAttachmentUrl,
  titleCaseWords,
} from './erp/erpTabUtils'
import ERPInventoryTab from './erp/tabs/ERPInventoryTab'
import ERPVendorsTab from './erp/tabs/ERPVendorsTab'
import ERPDashboardTab from './erp/tabs/ERPDashboardTab'
import ERPLedgerTab from './erp/tabs/ERPLedgerTab'
import ERPTransactionsTab from './erp/tabs/ERPTransactionsTab'
import ERPReportsTab from './erp/tabs/ERPReportsTab'
import { trialBalanceRowsForView } from './erp/trialBalanceReportRows'
import ERPFixingRegisterTab from './erp/tabs/ERPFixingRegisterTab'
import { startERPRealtimeFeeds, startMetalRatesRealtime } from '../../utils/realtimeSocket'
import useLiveMetalRates from '../../hooks/useLiveMetalRates'
import {
  liveRatesToMetalRatesState,
  resolveEffectiveSpotPrices,
  resolveInventoryValuationUnitCost,
} from '../../utils/liveMetalRates'
import { downloadBlob, downloadCsv, printStatementHtml } from './erp/exportHelpers'
import {
  accumulateUnfixedVoucherRevaluationByMetal,
  buildStatementCurrencyOptions,
  buildStatementMetalOptions,
  calculateAccountSummaryMetrics,
  formatAccountEnquiryExcessDisplay,
  getAccountEnquirySignedMetricColor,
  normalizeStatementCurrencyCode,
  resolveExposureDirection,
  matchesStatementMetal,
  resolveMetalCodeFromStockName,
  resolveStatementMetalCode,
  isMetalStatementEntry,
} from './erp/statementHelpers'
import { generateStatementHtml as buildStatementHtml } from './erp/statementPrintHtml'
import { shouldSuppressSpotMetalMtmForAccountEnquiry } from './erp/metalMarginPolicy'
import {
  canViewErpSubTab,
  resolveAllowedErpSubTab,
} from '../../utils/erpSubTabPermissions'
import {
  JV_MODE_META,
  buildJvDocNo as buildNextJvDocNo,
  convertJvAmountBetweenCurrencies,
  createJvHeader as createNextJvHeader,
  emptyJvLine,
  extractLedgerJvDocNoFromDescription,
  filterJvEditableEntries,
  inferLegacyJvBatchDisplayFc,
  normalizeJvCurrencyCode,
  reconstructJvEditLines,
  resolveJvModeMeta,
} from './erp/journalVoucherHelpers'
const VoucherTab = lazy(() => import('./VoucherTab'))
import {
  DEFAULT_BRANDING,
  DEFAULT_BRANDING_PROFILES,
  LOGO_UPLOAD_ACCEPT,
  LOGO_UPLOAD_MAX_BYTES,
  normalizeBrandingKey,
  clampBrandingDimension,
  brandingOptionLabel,
  createLogoRenderAsset,
  isSupportedLogoUpload,
} from './erp/ERPBrandingUtils'
import { resolveDocumentBranding } from './erp/documentBranding'
import { loadExcel, loadPdfTools } from './erp/lazyExportLibs'
import { ERP_TAB_COLORS as C, TRANSACTION_STATUS_STYLES, formatDateInputLocal, ERP_EMPTY_CARD_STYLE, ERP_MODAL_BACKDROP_STYLE, ERP_MODAL_CARD_STYLE, ERP_MODAL_INPUT_STYLE } from './erp/erpTabPresentation'
import { exchangeRateFromUnitsPerBase, resolveCurrencyRowByCode } from './erp/erpCurrencyRowHelpers'
import StatementExportOptionsModal from './erp/StatementExportOptionsModal'

const JV_MODAL_DEFAULT_SIZE = Object.freeze({ width: 980, height: 640 })

function ERPTab({
  focusTab,
  onNavigateMain,
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
  const { activeTab, setActiveTab } = useERPTabStateAdapter(focusTab)
  useEffect(() => {
    const allowedTab = resolveAllowedErpSubTab(user, activeTab, focusTab || 'dashboard')
    if (allowedTab !== activeTab) {
      setActiveTab(allowedTab)
    }
  }, [activeTab, focusTab, user, setActiveTab])
  const canViewCurrentErpSubTab = canViewErpSubTab(user, activeTab)
  const dashStorageKey = `erp_dash_${user?.name || 'default'}`
  const [dashEditMode, setDashEditMode] = useState(false)
  const { dashWidgets, setDashWidgets } = useErpDashWidgets({ dashStorageKey, dashEditMode })
  const [dashHoveredWid, setDashHoveredWid] = useState(null)
  const [dashWidgetCols, setDashWidgetCols] = useState({})
  const [dashCustomizeOpen, setDashCustomizeOpen] = useState(false)
  const [dashPickSelected, setDashPickSelected] = useState([])
  const dashDragSrc = useRef(null)
  const activeTabRef = useRef(activeTab)
  // Dashboard date-range filter
  const [dashDateFrom] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [dashDateTo] = useState(() => formatDateInputLocal(new Date()))
  const [dashAutoRefresh] = useState(false)
  const [dashChatMessages, setDashChatMessages] = useState([])
  const [accounts, setAccounts] = useState([])
  const [summaryAccounts, setSummaryAccounts] = useState([])
  const [customers, setCustomers] = useState([])
  const [customerMarginSearch, setCustomerMarginSearch] = useState('')
  const [customerMarginCompactView, setCustomerMarginCompactView] = useState(true)
  const [customerMarginSort, setCustomerMarginSort] = useState('margin-desc')
  const [customerMarginContextMenu, setCustomerMarginContextMenu] = useState({ open: false, x: 0, y: 0, row: null })
  const [supplierMarginSearch, setSupplierMarginSearch] = useState('')
  const [supplierMarginCompactView, setSupplierMarginCompactView] = useState(true)
  const [supplierMarginSort, setSupplierMarginSort] = useState('margin-desc')
  const [supplierMarginContextMenu, setSupplierMarginContextMenu] = useState({ open: false, x: 0, y: 0, row: null })
  const [fixingRegFilter, setFixingRegFilter] = useState({
    metalType: '',
    quantityUnit: 'GOZ',
    rateUnit: 'GOZ',
    orderBy: 'voucherNo',
    fromDate: formatDateInputLocal(new Date(new Date().getFullYear(), 0, 1)),
    toDate: formatDateInputLocal(new Date()),
    groupBy: 'none',
    partyFilter: 'all',
    partySearch: '',
    excludeOpeningBalance: false,
    excludeFutures: false,
    status: 'preview',
  })
  const [fixingRegResults, setFixingRegResults] = useState([])
  const [fixingRegOpening, setFixingRegOpening] = useState({ qtyOz: 0, value: 0 })
  const [fixingRegLoading, setFixingRegLoading] = useState(false)
  const [fixingRegShown, setFixingRegShown] = useState(false)
  const [fixingRegError, setFixingRegError] = useState('')
  const [fixingRegPanelOffset, setFixingRegPanelOffset] = useState({ x: 0, y: 0 })
  const [fixingRegPanelDrag, setFixingRegPanelDrag] = useState({ active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 })
  const [ledger, setLedger] = useState([])
  const [mappings, setMappings] = useState([])
  const [currencies, setCurrencies] = useState([])
  const erpBaseCurrencyCode = useMemo(
    () => String(currencies.find((c) => c.baseCurrency)?.code || 'USD').trim().toUpperCase() || 'USD',
    [currencies],
  )
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(false)
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
  const [enquiryHistory, setEnquiryHistory] = useState([])
  const [showEnquiryModal, setShowEnquiryModal] = useState(false)
  const [showEnquiryLookupMenu, setShowEnquiryLookupMenu] = useState(false)
  const [enquiryModalOffset, setEnquiryModalOffset] = useState({ x: 0, y: 0 })
  const [enquiryModalDrag, setEnquiryModalDrag] = useState({ active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 })
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
  const [transactionForm, setTransactionForm] = useState(createTransactionForm)
  const [editingTransactionId, setEditingTransactionId] = useState('')
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
  const { snapshot: liveMetalSnapshot, error: liveMetalError } = useLiveMetalRates()
  useEffect(() => {
    const synced = liveRatesToMetalRatesState(liveMetalSnapshot)
    if (!synced) return
    setMetalRates(synced)
  }, [liveMetalSnapshot])
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
  const inventoryReportRows = useMemo(() => inventoryReportProducts.map((item) => {
    const categoryMeta = decodeInventoryCategoryMeta(item.category)
    const productMeta = decodeInventoryCategoryPairs(item.category)
    const quantity = Math.max(0, Number(item.quantity || 0))
    const metalName = productMeta.mainStock || productMeta.metalType || categoryMeta.mainStock || categoryMeta.metalType || ''
    const priceUnit = categoryMeta.priceUnit || productMeta.priceUnit || 'OZ'
    const storedUnitCost = Number(item.unitCost || 0)
    const unitCost = resolveInventoryValuationUnitCost(storedUnitCost, metalName, liveMetalSnapshot, priceUnit)
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
  }), [inventoryReportProducts, liveMetalSnapshot])
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
  const fixingRegisterStockTypeOptions = useMemo(() => {
    const normalizeToMetalCode = (rawValue) => {
      const normalized = String(rawValue || '').trim().toLowerCase()
      if (!normalized) return ''
      if (normalized === 'xau' || normalized === 'gold') return 'XAU'
      if (normalized === 'xag' || normalized === 'silver') return 'XAG'
      if (normalized === 'xpt' || normalized === 'platinum') return 'XPT'
      if (normalized === 'xpd' || normalized === 'palladium') return null
      return String(rawValue || '').trim().toUpperCase()
    }
    const stockTypeOptions = inventoryMappingProducts.map((item) => {
      const meta = decodeInventoryCategoryMeta(item.category)
      const source = meta.metalType || meta.mainStock || item.name
      const metalCode = normalizeToMetalCode(source)
      const labelName = titleCaseWords(meta.mainStock || meta.metalType || item.name || item.sku || 'Stock Type')
      const puritySuffix = meta.purity ? ` (${meta.purity})` : ''
      return {
        id: item._id,
        value: `${metalCode}::${item._id}`,
        metalCode,
        label: `${labelName}${puritySuffix}`,
      }
    }).filter((option) => Boolean(option.metalCode))
    if (stockTypeOptions.length) {
      return [
        { id: 'all-metals', value: 'ALL::all', metalCode: 'ALL', label: 'All Metals' },
        ...stockTypeOptions,
      ]
    }
    // Legacy fallback for older datasets where stock types were not encoded in mapping records.
    const legacyProductOptions = inventoryCatalogProducts.map((item) => {
      const meta = decodeInventoryCategoryPairs(item.category)
      const source = meta.metalType || meta.mainStock || item.name
      const metalCode = normalizeToMetalCode(source)
      const productLabel = titleCaseWords(meta.productCategory || item.name || item.sku || 'Product')
      const puritySuffix = meta.productPurity ? ` (${meta.productPurity})` : ''
      return {
        id: item._id,
        value: `${metalCode}::${item._id}`,
        metalCode,
        label: `${productLabel}${puritySuffix}`,
      }
    }).filter((option) => Boolean(option.metalCode))
    if (legacyProductOptions.length) {
      return [
        { id: 'all-metals', value: 'ALL::all', metalCode: 'ALL', label: 'All Metals' },
        ...legacyProductOptions,
      ]
    }
    // Final fallback: allow fixing register to work even when no inventory stock type/product records exist.
    return [
      { id: 'all-metals', value: 'ALL::all', metalCode: 'ALL', label: 'All Metals' },
      { id: 'metal-gold', value: 'XAU::fallback-gold', metalCode: 'XAU', label: 'Gold (XAU)' },
      { id: 'metal-silver', value: 'XAG::fallback-silver', metalCode: 'XAG', label: 'Silver (XAG)' },
      { id: 'metal-platinum', value: 'XPT::fallback-platinum', metalCode: 'XPT', label: 'Platinum (XPT)' },
      { id: 'metal-other', value: 'OTHER::fallback-other', metalCode: 'OTHER', label: 'Other Metals' },
    ]
  }, [inventoryCatalogProducts, inventoryMappingProducts])
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
  const rawStatementEntries = accountEnquiryData?.statement?.entries || []
  const resolveFixStatus = (entry) => {
    const explicit = String(entry?.metalFixStatus || '').trim().toLowerCase()
    if (explicit === 'fixed' || explicit === 'unfixed') return explicit
    const text = `${String(entry?.description || '')} ${String(entry?.referenceType || '')}`.toLowerCase()
    if (/non[\s-_]?fix|unfix|unfixed/.test(text)) return 'unfixed'
    if (/fixing|fixed|price[\s-_]?fix/.test(text)) return 'fixed'
    return 'unknown'
  }
  const effectiveSpotPrices = resolveEffectiveSpotPrices({
    liveSnapshot: liveMetalSnapshot,
    enquiryGold: accountEnquiryData?.metals?.goldPrice,
    enquirySilver: accountEnquiryData?.metals?.silverPrice,
    fallbackGold: metalRates.goldPrice,
    fallbackSilver: metalRates.silverPrice,
  })
  const goldPriceUSD = effectiveSpotPrices.goldPriceUSD
  const silverPriceUSD = effectiveSpotPrices.silverPriceUSD
  const totalFunds = accountEnquiryData ? Number(accountEnquiryData.balances?.netBalance || 0) : 0
  const modalStatementCurrency = erpBaseCurrencyCode
  const rawUnfixedMetalDedupeKeys = new Set()
  const rawUnfixedStatementMetalHint = rawStatementEntries.reduce((acc, entry) => {
    if (resolveFixStatus(entry) !== 'unfixed') return acc
    if (!isMetalStatementEntry(entry)) return acc
    const w = Number(entry.metalSignedWeight || 0)
    if (!Number.isFinite(w) || w === 0) return acc
    const tx = String(entry?.sourceTransactionId || '').trim()
    if (tx) {
      const dedupeKey = `${tx}:${Math.round(w * 1e6)}`
      if (rawUnfixedMetalDedupeKeys.has(dedupeKey)) return acc
      rawUnfixedMetalDedupeKeys.add(dedupeKey)
    }
    const mc = resolveStatementMetalCode(entry)
    if (mc === 'XAG') acc.silver += w
    else if (mc && mc !== '-') acc.gold += w
    return acc
  }, { gold: 0, silver: 0 })
  const resolvePreferredStatementMetalCode = (entries = [], hint = { gold: 0, silver: 0 }) => {
    const explicitMetal = entries.find((entry) => {
      const metalCode = String(entry?.metalCode || '').trim().toUpperCase()
      return metalCode === 'XAU' || metalCode === 'XAG'
    })
    if (explicitMetal?.metalCode) return String(explicitMetal.metalCode).trim().toUpperCase()
    const goldAbs = Math.abs(Number(accountEnquiryData?.metals?.goldBalance || 0)) || Math.abs(hint.gold || 0)
    const silverAbs = Math.abs(Number(accountEnquiryData?.metals?.silverBalance || 0)) || Math.abs(hint.silver || 0)
    return silverAbs > goldAbs ? 'XAG' : 'XAU'
  }
  const defaultStatementMetalCode = resolvePreferredStatementMetalCode(rawStatementEntries, rawUnfixedStatementMetalHint)
  const statementSelectedMetalCode = statementFilters.metalCommodity
    ? resolveMetalCodeFromStockName(statementFilters.metalCommodity)
    : defaultStatementMetalCode
  const statementDisplayCurrency = normalizeStatementCurrencyCode(
    statementFilters.showAmountIn
    || accountEnquiryData?.balances?.rateCurrency
    || accountEnquiryData?.account?.currency
    || modalStatementCurrency,
  ).trim().toUpperCase()
  const baseCurrencyCode = erpBaseCurrencyCode
  const statementFilterCurrencyOptions = buildStatementCurrencyOptions({
    includeAll: true,
    currencies,
    accountCurrency: accountEnquiryData?.account?.currency,
    rateCurrency: accountEnquiryData?.balances?.rateCurrency,
    baseCurrency: baseCurrencyCode,
    modalCurrency: modalStatementCurrency,
  })
  const statementDisplayCurrencyOptions = buildStatementCurrencyOptions({
    includeAll: false,
    currencies,
    accountCurrency: accountEnquiryData?.account?.currency,
    rateCurrency: accountEnquiryData?.balances?.rateCurrency,
    baseCurrency: baseCurrencyCode,
    modalCurrency: modalStatementCurrency,
  })
  const statementMetalOptions = buildStatementMetalOptions(inventoryStockTypeOptions)
  const convertStatementDisplayAmount = (value) => {
    const numeric = Number(value || 0)
    if (!Number.isFinite(numeric)) return 0
    const converted = convertJvAmount(numeric, modalStatementCurrency, statementDisplayCurrency)
    return Number.isFinite(converted) ? converted : numeric
  }
  const spotMetalQuoteCurrency = normalizeStatementCurrencyCode(
    accountEnquiryData?.metals?.priceCurrency || 'USD',
  ).trim().toUpperCase()
  const convertMetalSpotDisplayAmount = (value) => {
    const numeric = Number(value || 0)
    if (!Number.isFinite(numeric)) return 0
    const converted = convertJvAmount(numeric, spotMetalQuoteCurrency, statementDisplayCurrency)
    return Number.isFinite(converted) ? converted : numeric
  }
  const formatStatementValue = (value, digits = 2) => {
    const num = Number(value || 0)
    return num.toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  }
  const formatStatementNullableValue = (value, digits = 2) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
    return formatStatementValue(value, digits)
  }
  const getSignedColor = (value) => {
    const num = Number(value || 0)
    return num >= 0 ? '#111827' : '#c0392b'  // Red for negative
  }
  const isCashOnHandEnquiry = String(accountEnquiryData?.account?.accountCode || '').trim() === '1000'
  const strictCashStatementTypes = new Set([
    'payment',
    'receipt',
    'sale',
    'purchase',
    // DO NOT include 'journal' - exchange adjustments should NOT appear in Cash statement
    // They post to P&L accounts (4190/5190), not to Cash (1000)
    // 'journal',  // REMOVED
    'jv',
    'bank_jv',
    'bank-jv',
  ])
  const resolveMetalCode = resolveStatementMetalCode
  const isLikelyMongoId = (value) => /^[a-f0-9]{24}$/i.test(String(value || '').trim())
  const resolveStatementReceiptNo = (entry = {}) => {
    const parsedDocNo = (() => {
      const text = `${String(entry.description || '')} ${String(entry.notes || '')}`
      const match = text.match(/\b((?:Pay|Rec|Pur|Sal|MRec|MPay|BnkJV|JV|Jv)[/-]\d{4}[/-]\d{1,6})\b/i)
      return String(match?.[1] || '').trim()
    })()
    const sourceNo = String(entry.sourceTransactionNumber || '').trim()
    if (sourceNo && !isLikelyMongoId(sourceNo)) return sourceNo
    if (parsedDocNo) return parsedDocNo
    return '-'
  }
  const resolveDealSide = (entry) => {
    const explicit = String(entry?.metalDealType || entry?.sourceTransactionType || '').toLowerCase().trim()
    if (explicit === 'sale' || explicit === 'purchase' || explicit === 'metal_receipt' || explicit === 'metal_payment') return explicit
    const referenceType = String(entry?.referenceType || '').toLowerCase().trim()
    if (referenceType === 'sale' || referenceType === 'purchase' || referenceType === 'metal_receipt' || referenceType === 'metal_payment') return referenceType
    return ''
  }
  const combineVoucherStatementRows = (entries = []) => {
    const grouped = new Map()
    const orderedKeys = []
    entries.forEach((entry, index) => {
      const dealSide = resolveDealSide(entry)
      const sourceId = String(entry?.sourceTransactionId || '').trim()
      const receiptNo = resolveStatementReceiptNo(entry)
      const canGroup = sourceId && ['sale', 'purchase', 'metal_receipt', 'metal_payment'].includes(dealSide)
      const key = canGroup ? `tx:${sourceId}` : `row:${entry?._id || index}`
      if (!grouped.has(key)) {
        grouped.set(key, {
          ...entry,
          _id: key,
          statementRowIds: [entry?._id].filter(Boolean),
          debitAmount: 0,
          creditAmount: 0,
          signedAmount: 0,
          sourceTransactionType: entry?.sourceTransactionType || dealSide || entry?.referenceType || '',
          metalDealType: entry?.metalDealType || dealSide,
          referenceType: dealSide || entry?.referenceType || '',
          offsetAccountCode: '',
          offsetAccountName: '',
          receiptNo,
          metalSignedWeight: 0,
          unfixedVoucherAmount: 0,
        })
        orderedKeys.push(key)
      }
      const row = grouped.get(key)
      row.debitAmount += Number(entry?.debitAmount || 0)
      row.creditAmount += Number(entry?.creditAmount || 0)
      row.signedAmount += Number(entry?.signedAmount || 0)
      row.statementRowIds = Array.from(new Set([...(row.statementRowIds || []), entry?._id].filter(Boolean)))
      const incomingVoucherAmount = Number(entry?.unfixedVoucherAmount || 0)
      if (Number.isFinite(incomingVoucherAmount) && Math.abs(incomingVoucherAmount) > Math.abs(Number(row.unfixedVoucherAmount || 0))) {
        row.unfixedVoucherAmount = incomingVoucherAmount
      }
      const entryType = String(entry?.referenceType || '').toLowerCase()
      if (entryType === dealSide || (!row.offsetAccountCode && entry?.offsetAccountCode)) {
        row.offsetAccountCode = entry?.offsetAccountCode || row.offsetAccountCode
        row.offsetAccountName = entry?.offsetAccountName || row.offsetAccountName
      }
      if (!row.sourceTransactionNumber && entry?.sourceTransactionNumber) row.sourceTransactionNumber = entry.sourceTransactionNumber
      if (!row.metalFixStatus && entry?.metalFixStatus) row.metalFixStatus = entry.metalFixStatus
      if (!row.metalCode && entry?.metalCode) row.metalCode = entry.metalCode
      if (!row.isMetalTrade && entry?.isMetalTrade) row.isMetalTrade = entry.isMetalTrade
      // Multi-leg vouchers often repeat the same metalSignedWeight on each ledger line; sum would double grams.
      const incomingMetalW = Number(entry?.metalSignedWeight || 0)
      if (Number.isFinite(incomingMetalW) && incomingMetalW !== 0) {
        const cur = Number(row.metalSignedWeight || 0)
        if (!cur) {
          row.metalSignedWeight = incomingMetalW
        } else {
          const maxAbs = Math.max(Math.abs(cur), Math.abs(incomingMetalW))
          const sameWithinGram = maxAbs > 0 && (Math.abs(cur - incomingMetalW) / maxAbs) < 1e-5
          if (sameWithinGram) {
            // Duplicate weight on another leg for the same voucher — keep a single physical weight.
          } else {
            row.metalSignedWeight = cur + incomingMetalW
          }
        }
      }
    })
    return orderedKeys.map((key) => {
      const row = grouped.get(key)
      row.debitAmount = Number(row.debitAmount.toFixed(2))
      row.creditAmount = Number(row.creditAmount.toFixed(2))
      row.signedAmount = Number(row.signedAmount.toFixed(2))
      row.unfixedVoucherAmount = Number(Number(row.unfixedVoucherAmount || 0).toFixed(2))
      return row
    })
  }
  const statementEntries = combineVoucherStatementRows(rawStatementEntries)
  {
    const sortStatementNewestFirst = (left, right) => {
      const leftDate = new Date(left?.date || 0).getTime()
      const rightDate = new Date(right?.date || 0).getTime()
      if (rightDate !== leftDate) return rightDate - leftDate
      return String(right?._id || '').localeCompare(String(left?._id || ''))
    }
    const sorted = [...statementEntries].sort(sortStatementNewestFirst)
    let rb = Number(accountEnquiryData?.balances?.netBalance ?? 0)
    if (!Number.isFinite(rb)) rb = 0
    for (const row of sorted) {
      row.runningBalance = rb
      rb -= Number(row?.signedAmount || 0)
    }
  }
  const deriveStatementUnfixedMetalBalances = (entries) => entries.reduce((acc, entry) => {
    if (resolveFixStatus(entry) !== 'unfixed') return acc
    if (!isMetalStatementEntry(entry)) return acc
    const w = Number(entry.metalSignedWeight || 0)
    if (!Number.isFinite(w) || w === 0) return acc
    const mc = resolveStatementMetalCode(entry)
    if (mc === 'XAG') acc.silver += w
    else if (mc && mc !== '-') acc.gold += w
    return acc
  }, { gold: 0, silver: 0 })
  const statementUnfixedMetalBalances = deriveStatementUnfixedMetalBalances(statementEntries)
  const apiGoldBal = accountEnquiryData ? Number(accountEnquiryData.metals?.goldBalance || 0) : 0
  const apiSilverBal = accountEnquiryData ? Number(accountEnquiryData.metals?.silverBalance || 0) : 0
  const xauBalance = apiGoldBal !== 0 ? apiGoldBal : statementUnfixedMetalBalances.gold
  const xagBalance = apiSilverBal !== 0 ? apiSilverBal : statementUnfixedMetalBalances.silver
  const modalTotalFunds = totalFunds
  // Creditor/vendor AP: flag drives enquiry layout — funds from ledger, revaluation from spot × net grams.
  const enquirySuppressMetalSpotMtm = Boolean(
    accountEnquiryData?.metals?.suppressMetalSpotMtm
      || (accountEnquiryData && shouldSuppressSpotMetalMtmForAccountEnquiry(accountEnquiryData.account)),
  )
  const statementUnfixedVoucherRevaluationByMetal = accumulateUnfixedVoucherRevaluationByMetal(statementEntries, {
    mode: enquirySuppressMetalSpotMtm ? 'booked' : 'unpriced',
    resolveFixStatus,
    isMetalEntry: isMetalStatementEntry,
    resolveMetalCode: resolveStatementMetalCode,
  })
  const statementUnfixedVoucherRevaluation =
    statementUnfixedVoucherRevaluationByMetal.gold
    + statementUnfixedVoucherRevaluationByMetal.silver
    + statementUnfixedVoucherRevaluationByMetal.other
  const useVoucherRevaluation = !enquirySuppressMetalSpotMtm && Math.abs(statementUnfixedVoucherRevaluation) > 0.000001
  const xauSpotValue = xauBalance * goldPriceUSD
  const xagSpotValue = xagBalance * silverPriceUSD
  let xauCurrentValue
  let xagCurrentValue
  let modalRevaluation
  if (enquirySuppressMetalSpotMtm) {
    // Creditor/vendor AP: ledger payable in Total Funds; revaluation = spot on net metal position.
    xauCurrentValue = xauSpotValue
    xagCurrentValue = xagSpotValue
    modalRevaluation = xauSpotValue + xagSpotValue
  } else {
    xauCurrentValue = useVoucherRevaluation
      ? statementUnfixedVoucherRevaluationByMetal.gold
      : xauSpotValue
    xagCurrentValue = useVoucherRevaluation
      ? statementUnfixedVoucherRevaluationByMetal.silver
      : xagSpotValue
    modalRevaluation = useVoucherRevaluation
      ? statementUnfixedVoucherRevaluation
      : (xauCurrentValue + xagCurrentValue)
  }
  const modalMarginAmt = Math.abs(modalRevaluation) * 0.02
  const resolvePayableBreakEvenPrice = (metalBalance) => {
    const grams = Math.abs(Number(metalBalance || 0))
    if (grams <= 0) return 0
    return Math.abs(totalFunds) / grams
  }
  const breakEvenPrice = resolvePayableBreakEvenPrice(xauBalance)
  const displayModalPositionCurrentValue = (spotBasedValue, bookedValue) => {
    if (enquirySuppressMetalSpotMtm || !useVoucherRevaluation) {
      return convertMetalSpotDisplayAmount(spotBasedValue)
    }
    return convertStatementDisplayAmount(bookedValue)
  }
  const modalPositionRows = accountEnquiryData ? [
    {
      key: 'xau',
      type: 'XAU',
      limits: 0,
      balance: xauBalance,
      price: convertMetalSpotDisplayAmount(goldPriceUSD),
      currentValue: displayModalPositionCurrentValue(xauSpotValue, statementUnfixedVoucherRevaluationByMetal.gold),
      breakEven: convertStatementDisplayAmount(breakEvenPrice),
    },
    {
      key: 'xag',
      type: 'XAG',
      limits: 0,
      balance: xagBalance,
      price: convertMetalSpotDisplayAmount(silverPriceUSD),
      currentValue: displayModalPositionCurrentValue(xagSpotValue, statementUnfixedVoucherRevaluationByMetal.silver),
      breakEven: convertStatementDisplayAmount(resolvePayableBreakEvenPrice(xagBalance)),
    },
  ] : []
  const buildPureWeightRunningBalancesByEntryKey = (entries, selectedMetalCode) => {
    const selected = String(selectedMetalCode || '').trim().toUpperCase()
    const isMetalRowForPureWt = (entry) => isMetalStatementEntry(entry) && resolveStatementMetalCode(entry) === selected
    let closing = entries.reduce((sum, entry) => {
      if (!isMetalRowForPureWt(entry)) return sum
      return sum + Number(entry.metalSignedWeight || 0)
    }, 0)
    const map = new Map()
    for (const entry of entries) {
      if (!isMetalRowForPureWt(entry)) continue
      map.set(entry._id, closing)
      closing -= Number(entry.metalSignedWeight || 0)
    }
    return map
  }
  const pureWeightRunningByEntryKey = buildPureWeightRunningBalancesByEntryKey(statementEntries, statementSelectedMetalCode)
  const statementReferenceTypes = Array.from(new Set(statementEntries.map((entry) => String(entry.referenceType || '').trim()).filter(Boolean))).sort()
  const statementDepartments = Array.from(new Set(statementEntries.map((entry) => String(entry.department || '').trim()).filter(Boolean))).sort()
  const filteredStatementEntries = statementEntries.filter((entry) => {
    if (isCashOnHandEnquiry) {
      const sourceType = String(entry?.sourceTransactionType || '').toLowerCase().trim()
      const referenceType = String(entry?.referenceType || '').toLowerCase().trim()
      const effectiveType = sourceType || referenceType
      if (!strictCashStatementTypes.has(effectiveType)) return false
    }
    const entryDate = entry.date ? new Date(entry.date) : null
    if (statementFilters.startDate) {
      const start = new Date(statementFilters.startDate)
      if (!entryDate || entryDate < start) return false
    }
    if (statementFilters.endDate) {
      const end = new Date(statementFilters.endDate)
      end.setHours(23, 59, 59, 999)
      if (!entryDate || entryDate > end) return false
    }
    if (statementFilters.referenceType && String(entry.referenceType || '') !== statementFilters.referenceType) return false
    if (statementFilters.department && String(entry.department || '') !== statementFilters.department) return false
    if (statementFilters.fixStatus) {
      const fixStatus = resolveFixStatus(entry)
      if (statementFilters.fixStatus === 'fixed' && fixStatus !== 'fixed') return false
      if (statementFilters.fixStatus === 'unfixed' && fixStatus !== 'unfixed') return false
      if (statementFilters.fixStatus === 'unknown' && fixStatus !== 'unknown') return false
    }
    if (statementFilters.foreignCurrency) {
      const entryCurrency = normalizeStatementCurrencyCode(entry.currency)
      const selectedCurrency = normalizeStatementCurrencyCode(statementFilters.foreignCurrency)
      if (entryCurrency !== selectedCurrency) return false
    }
    if (statementMetalCommodityEnabled && statementFilters.metalCommodity) {
      if (!matchesStatementMetal(entry, statementFilters.metalCommodity)) return false
    }
    return true
  })
  const visibleStatementNetBalance = filteredStatementEntries.reduce((sum, entry) => {
    return sum + Number(entry?.signedAmount || 0)
  }, 0)
  const modalTotalFundsDisplay = isCashOnHandEnquiry ? visibleStatementNetBalance : modalTotalFunds
  const modalDisplayMetrics = calculateAccountSummaryMetrics({
    totalFunds: modalTotalFundsDisplay,
    revaluation: modalRevaluation,
    marginAmount: modalMarginAmt,
  })
  const modalNetEquityDisplay = modalDisplayMetrics.netEquity
  const modalExcessDisplay = modalDisplayMetrics.excess
  const modalMarginPctDisplay = modalDisplayMetrics.marginPercent
  const metalFixingEntries = filteredStatementEntries
    .map((entry) => {
      const dealSide = resolveDealSide(entry)
      if (dealSide !== 'sale' && dealSide !== 'purchase') return null
      const isExplicitMetalTrade = Boolean(entry?.isMetalTrade)
      const hasLegacyMetalHint = String(entry?.metalCode || '').trim() !== '' || /\bxau\b|\bxag\b|gold|silver/i.test(String(entry?.description || ''))
      if (!isExplicitMetalTrade && !hasLegacyMetalHint) return null
      const amount = Math.abs(Number(entry?.signedAmount ?? entry?.debitAmount ?? entry?.creditAmount ?? 0))
      return {
        ...entry,
        dealSide,
        fixStatus: resolveFixStatus(entry),
        metalCode: resolveMetalCode(entry),
        amount,
      }
    })
    .filter(Boolean)
  const fixedMetalEntries = metalFixingEntries.filter((entry) => entry.fixStatus === 'fixed')
  const unfixedMetalEntries = metalFixingEntries.filter((entry) => entry.fixStatus === 'unfixed')
  const unknownFixMetalEntries = metalFixingEntries.filter((entry) => entry.fixStatus === 'unknown')
  const summarizeMetalDealRows = (rows) => rows.reduce((acc, row) => {
    if (row.dealSide === 'sale') {
      acc.saleCount += 1
      acc.saleAmount += row.amount
    }
    if (row.dealSide === 'purchase') {
      acc.purchaseCount += 1
      acc.purchaseAmount += row.amount
    }
    return acc
  }, {
    saleCount: 0,
    purchaseCount: 0,
    saleAmount: 0,
    purchaseAmount: 0,
  })
  const fixedMetalSummary = summarizeMetalDealRows(fixedMetalEntries)
  const unfixedMetalSummary = summarizeMetalDealRows(unfixedMetalEntries)
  const formatStatementDate = (value) => {
    if (!value) return '-'
    const dt = new Date(value)
    if (Number.isNaN(dt.getTime())) return '-'
    return dt.toLocaleDateString()
  }
  const recentPaymentReceiptEntry = [...rawStatementEntries]
    .filter((entry) => {
      const type = String(entry.referenceType || '').toLowerCase()
      return type === 'payment' || type === 'receipt'
    })
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0] || null
  const transactionPageCount = Math.max(1, Math.ceil(Number(transactionMeta.total || 0) / Number(transactionMeta.limit || 25)))
  const isTransactionEditMode = Boolean(editingTransactionId)
  const allVisibleTransactionsSelected = Boolean(transactions.length) && transactions.every((tx) => selectedTransactionIds.includes(tx._id))
  const enquiryBackdropColor = enquiryModalDrag.active ? 'rgba(15, 23, 42, 0.12)' : 'rgba(15, 23, 42, 0.45)'
  const beginEnquiryModalDrag = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    setEnquiryModalDrag({
      active: true,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: enquiryModalOffset.x,
      startY: enquiryModalOffset.y,
    })
  }
  const beginFixingRegPanelDrag = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    setFixingRegPanelDrag({
      active: true,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: fixingRegPanelOffset.x,
      startY: fixingRegPanelOffset.y,
    })
  }
  const beginJvModalDrag = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    setJvModalDrag({
      active: true,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: jvModalOffset.x,
      startY: jvModalOffset.y,
    })
  }
  const beginJvModalResize = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    setJvModalResize({
      active: true,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startW: jvModalSize.width,
      startH: jvModalSize.height,
    })
  }
  useEffect(() => {
    if (!showEnquiryModal) {
      setEnquiryModalOffset((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }))
      setEnquiryModalDrag((prev) => {
        if (!prev.active && prev.pointerX === 0 && prev.pointerY === 0 && prev.startX === 0 && prev.startY === 0) return prev
        return { active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 }
      })
      return undefined
    }
    if (!enquiryModalDrag.active) return undefined
    const handlePointerMove = (event) => {
      setEnquiryModalOffset({
        x: enquiryModalDrag.startX + (event.clientX - enquiryModalDrag.pointerX),
        y: enquiryModalDrag.startY + (event.clientY - enquiryModalDrag.pointerY),
      })
    }
    const handlePointerUp = () => {
      setEnquiryModalDrag((prev) => ({ ...prev, active: false }))
    }
    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)
    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
    }
  }, [showEnquiryModal, enquiryModalDrag])
  useEffect(() => {
    if (!showLedgerForm) {
      setJvModalOffset((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }))
      setJvModalDrag((prev) => {
        if (!prev.active && prev.pointerX === 0 && prev.pointerY === 0 && prev.startX === 0 && prev.startY === 0) return prev
        return { active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 }
      })
      setJvModalResize((prev) => {
        if (!prev.active && prev.pointerX === 0 && prev.pointerY === 0 && prev.startW === JV_MODAL_DEFAULT_SIZE.width && prev.startH === JV_MODAL_DEFAULT_SIZE.height) return prev
        return { active: false, pointerX: 0, pointerY: 0, startW: JV_MODAL_DEFAULT_SIZE.width, startH: JV_MODAL_DEFAULT_SIZE.height }
      })
      setJvModalSize((prev) => (prev.width === JV_MODAL_DEFAULT_SIZE.width && prev.height === JV_MODAL_DEFAULT_SIZE.height ? prev : JV_MODAL_DEFAULT_SIZE))
      return undefined
    }
    if (!jvModalDrag.active) return undefined
    const onMouseMove = (event) => {
      setJvModalOffset({
        x: jvModalDrag.startX + (event.clientX - jvModalDrag.pointerX),
        y: jvModalDrag.startY + (event.clientY - jvModalDrag.pointerY),
      })
    }
    const onMouseUp = () => {
      setJvModalDrag((prev) => ({ ...prev, active: false }))
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [showLedgerForm, jvModalDrag])
  useEffect(() => {
    if (!showLedgerForm || !jvModalResize.active) return undefined
    const onMouseMove = (event) => {
      const nextWidth = Math.max(860, Math.min(window.innerWidth - 24, jvModalResize.startW + (event.clientX - jvModalResize.pointerX)))
      const nextHeight = Math.max(500, Math.min(window.innerHeight - 24, jvModalResize.startH + (event.clientY - jvModalResize.pointerY)))
      setJvModalSize({ width: nextWidth, height: nextHeight })
    }
    const onMouseUp = () => {
      setJvModalResize((prev) => ({ ...prev, active: false }))
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [showLedgerForm, jvModalResize])
  useEffect(() => {
    if (activeTab !== 'fixing-register') {
      setFixingRegPanelOffset((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }))
      setFixingRegPanelDrag((prev) => {
        if (!prev.active && prev.pointerX === 0 && prev.pointerY === 0 && prev.startX === 0 && prev.startY === 0) return prev
        return { active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 }
      })
      return undefined
    }
    if (!fixingRegPanelDrag.active) return undefined
    const onMouseMove = (event) => {
      setFixingRegPanelOffset({
        x: fixingRegPanelDrag.startX + (event.clientX - fixingRegPanelDrag.pointerX),
        y: fixingRegPanelDrag.startY + (event.clientY - fixingRegPanelDrag.pointerY),
      })
    }
    const onMouseUp = () => {
      setFixingRegPanelDrag((prev) => ({ ...prev, active: false }))
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [activeTab, fixingRegPanelDrag])
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
  const loadDashboard = async () => {
    if (!canLoadDashboard) return
    setLoading(true)
    try {
      const [data, chatData] = await Promise.all([
        erpAccountingAPI.getDashboardReport(token, { startDate: dashDateFrom, endDate: dashDateTo }),
        messagesAPI.getLatestMessages(token, 'group', 10).catch(() => ({ messages: [] })),
      ])
      setDashboard(data)
      setDashChatMessages(chatData?.messages || chatData || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load dashboard')
    }
    setLoading(false)
  }
  const loadAccounts = async (params = {}) => {
    const isSummaryScope = params.scope === 'summary'
    if (!canLoadReferenceData && !(isSummaryScope && canViewBalanceEnquiry)) return
    const tenantKey = user?.tenant || user?.company || 'default'
    if (isSummaryScope) {
      const cached = readSummaryAccountsCache(tenantKey)
      if (cached?.length) {
        setSummaryAccounts(cached)
        setSummaryAccountsLoading(false)
      } else {
        setSummaryAccountsLoading(true)
      }
    } else {
      setLoading(true)
    }
    try {
      if (isSummaryScope) {
        const data = await erpAccountingAPI.getAccounts(token, { ...params, page: 1, limit: 500 })
        const rows = data.accounts || []
        const uniqueById = new Map()
        rows.forEach((item) => {
          if (item?._id) uniqueById.set(item._id, item)
        })
        const next = Array.from(uniqueById.values())
        setSummaryAccounts(next)
        writeSummaryAccountsCache(tenantKey, next)
      } else {
        const data = await erpAccountingAPI.getAccounts(token, params)
        setAccounts(data.accounts || [])
      }
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || `Failed to load ${isSummaryScope ? 'account summary options' : 'accounts'}`)
    }
    if (isSummaryScope) setSummaryAccountsLoading(false)
    else setLoading(false)
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
    const exactAccount = summaryAccounts.find((account) => String(account?.accountCode || '').trim().toLowerCase() === cleanInput.toLowerCase())
    if (exactAccount?.accountCode) return String(exactAccount.accountCode).trim()
    const matchedLabel = summaryAccounts.find((account) => formatSummaryAccountLabel(account).toLowerCase() === cleanInput.toLowerCase())
    if (matchedLabel?.accountCode) return String(matchedLabel.accountCode).trim()
    const labelPrefixMatch = cleanInput.match(/^([^\s-][^-]*?)(?:\s*-\s*.*)?$/)
    const candidateCode = String(labelPrefixMatch?.[1] || cleanInput).trim()
    return candidateCode
  }
  const groupedSummaryAccounts = useMemo(() => summaryAccounts
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
    }, []), [summaryAccounts])
  const entryAccountOptions = useMemo(() => {
    const baseEntryAccountOptions = summaryAccounts.length ? summaryAccounts : accounts
    const customerVendorLedgerOptions = [...(Array.isArray(customers) ? customers : []), ...(Array.isArray(vendors) ? vendors : [])]
      .map((party) => party?.ledgerAccountId)
      .filter((ledger) => ledger && (ledger._id || ledger.accountCode))
    const seenEntryAccountKeys = new Set()
    return [...baseEntryAccountOptions, ...customerVendorLedgerOptions].filter((account) => {
      const key = String(account?._id || account?.accountCode || '').trim()
      if (!key) return false
      if (seenEntryAccountKeys.has(key)) return false
      seenEntryAccountKeys.add(key)
      return true
    })
  }, [summaryAccounts, accounts, customers, vendors])
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
    if (!account) return baseCurrencyCode
    const explicitCurrency = normalizeJvCurrencyCode(account.currency || account.currencyCode || '')
    if (explicitCurrency) return explicitCurrency
    const hint = `${String(account.accountCode || '').toUpperCase()} ${String(account.accountName || '').toUpperCase()}`
    if (hint.includes('USD')) return 'USD'
    if (hint.includes('UZS') || hint.includes('SOMS') || hint.includes('SOM')) return 'UZS'
    return baseCurrencyCode
  }
  const convertJvAmount = (amount, fromCurrency, toCurrency) => {
    return convertJvAmountBetweenCurrencies(amount, fromCurrency, toCurrency, currencies, baseCurrencyCode)
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
    setLoading(true)
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
      if (accountData) setAccounts(accountData.accounts || [])
      if (currencyData) setCurrencies(currencyData.currencies || [])
      if (mappingData) setMappings(mappingData.mappings || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load ledger')
    }
    setLoading(false)
  }
  const loadCustomers = async (params) => {
    if (!canLoadParties) return
    setLoading(true)
    try {
      const data = await erpAccountingAPI.getCustomers(token, params)
      setCustomers(data.customers || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load customers')
    }
    setLoading(false)
  }
  const loadMappings = async (params = mappingFilters) => {
    if (!canViewMappings) return
    setLoading(true)
    try {
      const [mappingData, accountData] = await Promise.all([
        erpAccountingAPI.getMappings(token, params),
        canLoadReferenceData ? erpAccountingAPI.getAccounts(token) : Promise.resolve(null),
      ])
      setMappings(mappingData.mappings || [])
      setMappingSummary(mappingData.summary || { total: 0, shared: 0, byDepartment: {} })
      if (accountData) setAccounts(accountData.accounts || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load mappings')
    }
    setLoading(false)
  }
  const loadCurrencies = async () => {
    if (!canLoadReferenceData) return
    setLoading(true)
    try {
      const data = await erpAccountingAPI.getCurrencies(token)
      setCurrencies(data.currencies || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load currencies')
    }
    setLoading(false)
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
  const loadTransactions = async (overrides = {}) => {
    if (!(canAccessTransactions || canAccessVouchers || canAccessFixingRegister)) return
    setLoading(true)
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
      const [data, customerData, vendorData, inventoryData, mappingData, accountData, currencyData] = await Promise.all([
        erpAccountingAPI.getTransactions(token, params),
        canLoadParties ? erpAccountingAPI.getCustomers(token) : Promise.resolve(null),
        canLoadParties ? loadAllVendors({ includeInactive: true }) : Promise.resolve(null),
        canLoadInventoryData ? erpAccountingAPI.getInventoryProducts(token) : Promise.resolve(null),
        canViewMappings ? erpAccountingAPI.getMappings(token) : Promise.resolve(null),
        canLoadReferenceData ? erpAccountingAPI.getAccounts(token) : Promise.resolve(null),
        canLoadReferenceData ? erpAccountingAPI.getCurrencies(token) : Promise.resolve(null),
      ])
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
      if (customerData) setCustomers(customerData.customers || [])
      if (vendorData) setVendors(vendorData.vendors || [])
      if (inventoryData) setInventoryProducts(inventoryData.products || [])
      if (mappingData) setMappings(mappingData.mappings || [])
      if (accountData) setAccounts(accountData.accounts || [])
      if (currencyData) setCurrencies(currencyData.currencies || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load transactions')
    }
    setLoading(false)
  }
  const resetTransactionComposer = () => {
    setEditingTransactionId('')
    setTransactionForm({
      ...createTransactionForm(),
      currency: baseCurrencyCode,
      exchangeRate: '1',
    })
  }
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
  const populateTransactionForm = (tx) => {
    setEditingTransactionId(tx._id)
    setSelectedTransactionId(tx._id)
    setTransactionForm({
      type: tx.type || 'expense',
      metalFixStatus: String(tx.voucherMeta?.fixingType || '').toLowerCase().includes('non') ? 'unfixed' : 'fixed',
      amount: String(tx.amount ?? ''),
      date: tx.date ? new Date(tx.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      currency: tx.currency || 'USD',
      exchangeRate: String(tx.exchangeRate ?? 1),
      description: tx.description || '',
      customerId: tx.customerId?._id || tx.customerId || '',
      vendorId: tx.vendorId?._id || tx.vendorId || '',
      inventoryItemId: tx.inventoryItemId?._id || tx.inventoryItemId || '',
      mappingId: tx.mappingId?._id || tx.mappingId || '',
      debitAccountId: tx.debitAccountId?._id || tx.debitAccountId || '',
      creditAccountId: tx.creditAccountId?._id || tx.creditAccountId || '',
    })
  }
  const getTransactionValidationMessage = () => {
    if (!transactionForm.type || !transactionForm.amount) return 'Transaction type and amount are required'
    if (Number(transactionForm.amount) <= 0) return 'Amount must be greater than zero'
    if (['sale', 'receipt'].includes(transactionForm.type) && !transactionForm.customerId) return 'Customer is required for sales and receipts'
    if (['purchase', 'payment'].includes(transactionForm.type) && !transactionForm.vendorId) return 'Vendor is required for purchases and payments'
    return ''
  }
  useEffect(() => {
    const normalizedType = String(transactionForm.type || '').toLowerCase()
    if (!['receipt', 'payment'].includes(normalizedType)) return
    let selectedAccountCurrency = ''
    if (normalizedType === 'receipt' && transactionForm.customerId) {
      const customer = customers.find((item) => String(item._id) === String(transactionForm.customerId))
      selectedAccountCurrency = String(customer?.ledgerAccountId?.currency || customer?.currency || '').trim().toUpperCase()
    }
    if (normalizedType === 'payment' && transactionForm.vendorId) {
      const vendor = vendors.find((item) => String(item._id) === String(transactionForm.vendorId))
      selectedAccountCurrency = String(vendor?.ledgerAccountId?.currency || vendor?.currency || '').trim().toUpperCase()
    }
    if (!selectedAccountCurrency) return
    if (String(transactionForm.currency || '').toUpperCase() === selectedAccountCurrency) return
    const matchedCurrency = currencies.find((currency) => String(currency.code || '').toUpperCase() === selectedAccountCurrency)
    const nextRate = Number(matchedCurrency?.exchangeRate || 1)
    setTransactionForm((prev) => ({
      ...prev,
      currency: selectedAccountCurrency,
      exchangeRate: Number.isFinite(nextRate) && nextRate > 0 ? String(nextRate) : prev.exchangeRate,
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sync party account currency when party changes only (omit manual `currency` edits)
  }, [transactionForm.type, transactionForm.customerId, transactionForm.vendorId, customers, vendors, currencies])
  const loadVendors = async (filters = vendorFilters) => {
    if (!canLoadParties) return
    setLoading(true)
    try {
      const data = await loadAllVendors(filters)
      setVendors(data.vendors || [])
      setVendorSummary(data.summary || { totalVendors: 0, totalOutstanding: 0, overLimit: 0, blacklisted: 0, onHold: 0, nonCompliant: 0 })
      setVendorPermissions(data.permissions || { canManage: false, canUpdateOperational: false })
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load vendors')
    }
    setLoading(false)
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
    setLoading(true)
    try {
      const productsData = await erpAccountingAPI.getInventoryProducts(token)
      setInventoryProducts(productsData.products || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load inventory')
    }
    setLoading(false)
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
  const patchAccountEnquiryMetalRates = (rates) => {
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
  }
  const loadReports = async (targetView = reportView) => {
    if (!canAccessReports) return
    setLoading(true)
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
    setLoading(false)
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
  const handleCreateTransaction = async (e) => {
    e.preventDefault()
    const validationMessage = getTransactionValidationMessage()
    if (validationMessage) {
      setError(validationMessage)
      return
    }
    try {
      setSaving(true)
      const payload = {
        ...transactionForm,
        currency: baseCurrencyCode,
        exchangeRate: 1,
        amount: Number(transactionForm.amount),
        ...(['sale', 'purchase'].includes(String(transactionForm.type || '').toLowerCase()) ? { metalFixStatus: transactionForm.metalFixStatus || 'fixed' } : {}),
      }
      const response = isTransactionEditMode
        ? await erpAccountingAPI.updateTransaction(token, editingTransactionId, payload)
        : await erpAccountingAPI.createTransaction(token, payload)
      resetTransactionComposer()
      setSelectedTransactionId(response.transaction?._id || '')
      await loadTransactions({ cursor: null, cursorHistory: [] })
      showNotification(isTransactionEditMode ? '✅ Transaction updated' : '✅ Transaction created as draft')
    } catch (e) {
      setError(e.response?.data?.message || `Failed to ${isTransactionEditMode ? 'update' : 'create'} transaction`)
    } finally {
      setSaving(false)
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
    if (!cleanCode) {
      setError('Please enter account number')
      setEnquiryStatus({ type: 'error', message: 'Please enter account number' })
      return
    }
    const tenantKey = user?.tenant || user?.company || 'default'
    const cached = readAccountEnquiryCache(tenantKey, cleanCode)
    if (cached) {
      setAccountEnquiryCode(cleanCode)
      setAccountEnquiryData(cached)
      setEnquiryLoading(false)
    }
    try {
      if (shouldOpenModal) setShowEnquiryModal(true)
      if (!cached) setEnquiryLoading(true)
      setShowEnquiryLookupMenu(false)
      setEnquiryStatus({ type: '', message: '' })
      const data = await erpAccountingAPI.getAccountEnquiry(token, cleanCode, { statementLimit: 120, refresh: '1' })
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
      if (!cached) showNotification('✅ Account summary loaded')
    } catch (e) {
      if (!cached) {
        setAccountEnquiryData(null)
        const msg = e.response?.data?.message || 'Failed to fetch account summary'
        setError(msg)
        setEnquiryStatus({ type: 'error', message: msg })
      }
    } finally {
      setEnquiryLoading(false)
    }
  }
  const handleOpenAccountSummaryFromTree = async (account) => {
    if (!account?.accountCode) return
    setActiveTab('enquiry')
    setAccountEnquiryCode(account.accountCode)
    await fetchAccountEnquiryByCode(account.accountCode)
  }
  const handleAccountEnquiry = async (e) => {
    e.preventDefault()
    await fetchAccountEnquiryByCode(accountEnquiryCode, { openModal: true })
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
    if (!customerMarginContextMenu.open && !supplierMarginContextMenu.open) return undefined
    const closeMenu = () => {
      setCustomerMarginContextMenu((prev) => (prev.open ? { open: false, x: 0, y: 0, row: null } : prev))
      setSupplierMarginContextMenu((prev) => (prev.open ? { open: false, x: 0, y: 0, row: null } : prev))
    }
    const handleEscape = (event) => {
      if (event.key === 'Escape') closeMenu()
    }
    window.addEventListener('click', closeMenu)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [customerMarginContextMenu.open, supplierMarginContextMenu.open])
  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])
  useEffect(() => {
    accountEnquiryDataRef.current = accountEnquiryData
  }, [accountEnquiryData])
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
    const tenantKey = user?.tenant || user?.company
    const stopRealtime = startERPRealtimeFeeds({
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
    const stopMetalRatesRealtime = startMetalRatesRealtime({
      token,
      tenant: tenantKey,
      onRatesUpdate: (payload) => {
        const rates = payload?.rates || payload?.data?.rates
        if (!rates) return
        setMetalRates(rates)
        if (activeTabRef.current === 'enquiry' && accountEnquiryDataRef.current?.account?.accountCode) {
          patchAccountEnquiryMetalRates(rates)
        }
      },
    })
    return () => {
      stopRealtime()
      stopMetalRatesRealtime()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- realtime handlers intentionally use refs + stable loaders
  }, [token, user?.tenant, user?.company, canAccessERP])
  // Load dashboard once per tab visit and when date range changes
  useEffect(() => {
    if (activeTab !== 'dashboard' || !canLoadDashboard || !token) return
    loadDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, dashDateFrom, dashDateTo, token, canLoadDashboard])
  // Auto-refresh every 30 seconds when enabled and on dashboard tab
  useEffect(() => {
    if (!dashAutoRefresh || activeTab !== 'dashboard') return
    const interval = setInterval(() => {
      if (canLoadDashboard && token) loadDashboard()
    }, 30000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashAutoRefresh, activeTab])
  useEffect(() => {
    if (activeTab !== 'vouchers' || !token) return
    if (!customers.length) loadCustomers({ limit: 200 })
    if (!vendors.length) loadVendors()
    if (!currencies.length) loadCurrencies()
    if (!accounts.length) loadAccounts()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tab bootstrap: loaders intentionally omitted from deps
  }, [activeTab, token, customers.length, vendors.length, currencies.length, accounts.length])
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
  }, [fixingRegisterStockTypeOptions, fixingRegFilter.metalType])
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
  const customerMarginRows = useMemo(() => {
    const query = String(customerMarginSearch || '').trim().toLowerCase()
    const rows = (customers || [])
      .map((customer) => {
        const outstanding = Number(customer?.outstandingBalance || 0)
        const goldPosition = Number(customer?.goldPosition || 0)
        const silverPosition = Number(customer?.silverPosition || 0)
        const goldPrice = Number(customer?.metalRates?.goldPrice || goldPriceUSD || 0)
        const silverPrice = Number(customer?.metalRates?.silverPrice || silverPriceUSD || 0)
        const customerFunds = outstanding < 0 ? Math.abs(outstanding) : outstanding
        const isLiabilityCustomerLedger = String(customer?.ledgerAccountId?.accountType || '').toLowerCase() === 'liability'
        const fallbackRevaluation = isLiabilityCustomerLedger
          ? 0
          : (goldPosition * goldPrice) + (silverPosition * silverPrice)
        const fallbackMargin = Math.abs(fallbackRevaluation) * 0.02
        const fallbackMetrics = calculateAccountSummaryMetrics({
          totalFunds: customerFunds,
          revaluation: fallbackRevaluation,
          marginAmount: fallbackMargin,
        })
        const marginAmount = Number(customer?.marginAmount ?? fallbackMargin)
        const rawExcess = Number(customer?.marginExcess ?? fallbackMetrics.excess)
        const rawEquity = Number(customer?.marginEquity ?? fallbackMetrics.netEquity)
        const excess = rawExcess < 0 ? Math.abs(rawExcess) : rawExcess
        const equity = rawEquity < 0 ? Math.abs(rawEquity) : rawEquity
        const marginPercent = Number(customer?.marginPercent ?? fallbackMetrics.marginPercent)
        const status = String(customer?.marginStatus || (equity > 0 ? 'POSITIVE' : equity < 0 ? 'NEGATIVE' : 'NEUTRAL')).toUpperCase()
        return {
          id: customer?._id,
          customerName: String(customer?.name || '-'),
          balanceAbs: Math.abs(excess),
          equity,
          rawOutstanding: outstanding,
          goldPosition,
          silverPosition,
          marginAmount,
          excess,
          status,
          marginPercent,
          accountCode: String(customer?.ledgerAccountId?.accountCode || ''),
          description: String(customer?.ledgerAccountId?.accountName || `${String(customer?.name || '').trim()} customer`),
        }
      })
      .filter((row) => (!query ? true : row.customerName.toLowerCase().includes(query)))
    if (customerMarginSort === 'margin-asc') {
      rows.sort((a, b) => {
        const av = Number.isFinite(a.marginPercent) ? Number(a.marginPercent) : -1
        const bv = Number.isFinite(b.marginPercent) ? Number(b.marginPercent) : -1
        return av - bv
      })
    } else if (customerMarginSort === 'name-asc') {
      rows.sort((a, b) => a.customerName.localeCompare(b.customerName))
    } else {
      rows.sort((a, b) => {
        const av = Number.isFinite(a.marginPercent) ? Number(a.marginPercent) : -1
        const bv = Number.isFinite(b.marginPercent) ? Number(b.marginPercent) : -1
        return bv - av
      })
    }
    return rows
  }, [customers, customerMarginSearch, customerMarginSort, goldPriceUSD, silverPriceUSD])
  const supplierMarginRows = useMemo(() => {
    const query = String(supplierMarginSearch || '').trim().toLowerCase()
    const rows = (vendors || [])
      .map((vendor) => {
        const outstanding = -Math.abs(Number(vendor?.outstanding ?? vendor?.outstandingBalance ?? 0))
        const goldPosition = Number(vendor?.goldPosition || 0)
        const silverPosition = Number(vendor?.silverPosition || 0)
        const fallbackRevaluation = 0
        const fallbackMargin = 0
        const fallbackMetrics = calculateAccountSummaryMetrics({
          totalFunds: outstanding,
          revaluation: fallbackRevaluation,
          marginAmount: fallbackMargin,
        })
        const marginAmount = Number(vendor?.marginAmount ?? fallbackMargin)
        const excess = Number(vendor?.marginExcess ?? fallbackMetrics.excess)
        const equity = Number(vendor?.marginEquity ?? fallbackMetrics.netEquity)
        const marginPercent = Number(vendor?.marginPercent ?? fallbackMetrics.marginPercent)
        const status = String(vendor?.marginStatus || (equity > 0 ? 'POSITIVE' : equity < 0 ? 'NEGATIVE' : 'NEUTRAL')).toUpperCase()
        return {
          id: vendor?._id,
          supplierName: String(vendor?.name || '-'),
          balanceAbs: Math.abs(excess),
          equity,
          rawOutstanding: outstanding,
          goldPosition,
          silverPosition,
          marginAmount,
          excess,
          status,
          marginPercent,
          accountCode: String(vendor?.ledgerAccountId?.accountCode || ''),
          description: String(vendor?.ledgerAccountId?.accountName || `${String(vendor?.name || '').trim()} supplier`),
        }
      })
      .filter((row) => (!query ? true : row.supplierName.toLowerCase().includes(query)))
    if (supplierMarginSort === 'margin-asc') {
      rows.sort((a, b) => {
        const av = Number.isFinite(a.marginPercent) ? Number(a.marginPercent) : -1
        const bv = Number.isFinite(b.marginPercent) ? Number(b.marginPercent) : -1
        return av - bv
      })
    } else if (supplierMarginSort === 'name-asc') {
      rows.sort((a, b) => a.supplierName.localeCompare(b.supplierName))
    } else {
      rows.sort((a, b) => {
        const av = Number.isFinite(a.marginPercent) ? Number(a.marginPercent) : -1
        const bv = Number.isFinite(b.marginPercent) ? Number(b.marginPercent) : -1
        return bv - av
      })
    }
    return rows
  }, [vendors, supplierMarginSearch, supplierMarginSort])
  const formatCustomerMarginEquity = (row) => {
    const amount = Number(Math.abs(row?.equity || 0)).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    if (Number(row?.equity || 0) > 0) return `+${amount}`
    if (Number(row?.equity || 0) < 0) return `-${amount}`
    return amount
  }
  const formatCustomerMarginPercent = (value) => {
    if (!Number.isFinite(Number(value))) return '-'
    return `${Number(value).toFixed(2)} %`
  }
  const formatCustomerMarginPosition = (value) => {
    const amount = Number(value || 0)
    if (!Number.isFinite(amount)) return '-'
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    })
  }
  const formatCustomerMarginAmount = (value) => {
    const amount = Number(value || 0)
    if (!Number.isFinite(amount)) return '-'
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }
  const formatCustomerMarginExcessShort = (row) => {
    const amount = Number(Math.abs(row?.excess ?? row?.balanceAbs ?? 0)).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    if (Number(row?.excess || 0) > 0) return `Excess ${amount}`
    if (Number(row?.excess || 0) < 0) return `Short ${amount}`
    return '-'
  }
  const handleCustomerMarginRowContextMenu = (event, row) => {
    event.preventDefault()
    const menuWidth = 292
    const menuHeight = 242
    const viewportPad = 8
    let x = event.clientX + 6
    let y = event.clientY + 6
    if (x + menuWidth > window.innerWidth - viewportPad) {
      x = Math.max(viewportPad, window.innerWidth - menuWidth - viewportPad)
    }
    if (y + menuHeight > window.innerHeight - viewportPad) {
      y = Math.max(viewportPad, window.innerHeight - menuHeight - viewportPad)
    }
    setCustomerMarginContextMenu({ open: true, x, y, row })
  }
  const handleSupplierMarginRowContextMenu = (event, row) => {
    event.preventDefault()
    const menuWidth = 292
    const menuHeight = 242
    const viewportPad = 8
    let x = event.clientX + 6
    let y = event.clientY + 6
    if (x + menuWidth > window.innerWidth - viewportPad) {
      x = Math.max(viewportPad, window.innerWidth - menuWidth - viewportPad)
    }
    if (y + menuHeight > window.innerHeight - viewportPad) {
      y = Math.max(viewportPad, window.innerHeight - menuHeight - viewportPad)
    }
    setSupplierMarginContextMenu({ open: true, x, y, row })
  }
  const FIXING_REG_UNIT_PER_OZ = { GOZ: 1, GRAM: 31.1034768, KG: 0.0311034768, TOLA: 2.66667 }
  const fixingRegNormalizeUnit = (unit) => {
    const normalized = String(unit || 'GOZ').trim().toUpperCase()
    if (normalized === 'OZ' || normalized === 'OUNCE' || normalized === 'OUNCES') return 'GOZ'
    return normalized
  }
  const fixingRegConvertQty = (oz, unit) => oz * (FIXING_REG_UNIT_PER_OZ[fixingRegNormalizeUnit(unit)] || 1)
  const fixingRegConvertRate = (pricePerOz, unit) => pricePerOz / (FIXING_REG_UNIT_PER_OZ[fixingRegNormalizeUnit(unit)] || 1)
  const fixingRegConvertToOz = (qty, unit) => {
    const normalizedUnit = fixingRegNormalizeUnit(unit)
    const factor = FIXING_REG_UNIT_PER_OZ[normalizedUnit] || 1
    return Number(qty || 0) / factor
  }
  const fixingRegFmtQty = (oz, unit) => fixingRegConvertQty(oz, unit).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 4 })
  const fixingRegFmtRate = (p, unit) => fixingRegConvertRate(p, unit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  const fixingRegFmtAmt = (v) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const handleFixingRegProceed = async () => {
    setFixingRegError('')
    setFixingRegLoading(true)
    try {
      const today = new Date(); today.setHours(23, 59, 59, 999)
      const fromDate = fixingRegFilter.fromDate ? new Date(`${fixingRegFilter.fromDate}T00:00:00`) : null
      const openingEndDate = fromDate ? new Date(fromDate.getTime() - 86400000) : null
      const selectedMetalCode = String(fixingRegFilter.metalType || '').split('::')[0].toUpperCase()
      const primaryMetalCodes = new Set(['XAU', 'XAG', 'XPT', 'XPD'])
      const isAllMetalSelection = !selectedMetalCode || selectedMetalCode === 'ALL'
      const isOtherMetalSelection = selectedMetalCode === 'OTHER'
      const matchesSelectedMetal = (metalCodeRaw) => {
        const metalCode = String(metalCodeRaw || '').toUpperCase()
        if (isAllMetalSelection) return true
        if (isOtherMetalSelection) return metalCode && !primaryMetalCodes.has(metalCode)
        return metalCode === selectedMetalCode
      }
      const fetchAllPages = async (fetchFn, key, limit = 200) => {
        const allRows = []
        let page = 1
        let total = 0
        do {
          const data = await fetchFn({ page, limit })
          const chunk = Array.isArray(data?.[key]) ? data[key] : []
          allRows.push(...chunk)
          total = Number(data?.total || chunk.length)
          if (!chunk.length) break
          page += 1
        } while (allRows.length < total)
        return allRows
      }
      const baseTxParams = {
        startDate: fixingRegFilter.fromDate,
        endDate: fixingRegFilter.toDate,
      }
      const openingTxParams = openingEndDate ? {
        endDate: openingEndDate.toISOString().slice(0, 10),
      } : null
      if (fixingRegFilter.status === 'final') baseTxParams.status = 'posted'
      if (openingTxParams && fixingRegFilter.status === 'final') openingTxParams.status = 'posted'
      const [saleTxs, purchaseTxs, deals, openingSaleTxs, openingPurchaseTxs, openingDeals] = await Promise.all([
        fetchAllPages((p) => erpAccountingAPI.getTransactions(token, { ...baseTxParams, ...p, type: 'sale' }), 'transactions', 200),
        fetchAllPages((p) => erpAccountingAPI.getTransactions(token, { ...baseTxParams, ...p, type: 'purchase' }), 'transactions', 200),
        fetchAllPages((p) => erpAccountingAPI.getDirectDeals(token, {
          ...p,
          startDate: fixingRegFilter.fromDate,
          endDate: fixingRegFilter.toDate,
          ...(fixingRegFilter.status === 'final' ? { status: 'confirmed' } : {}),
        }), 'deals', 100),
        openingTxParams
          ? fetchAllPages((p) => erpAccountingAPI.getTransactions(token, { ...openingTxParams, ...p, type: 'sale' }), 'transactions', 200)
          : Promise.resolve([]),
        openingTxParams
          ? fetchAllPages((p) => erpAccountingAPI.getTransactions(token, { ...openingTxParams, ...p, type: 'purchase' }), 'transactions', 200)
          : Promise.resolve([]),
        openingTxParams
          ? fetchAllPages((p) => erpAccountingAPI.getDirectDeals(token, {
            ...p,
            endDate: openingEndDate.toISOString().slice(0, 10),
            ...(fixingRegFilter.status === 'final' ? { status: 'confirmed' } : {}),
          }), 'deals', 100)
          : Promise.resolve([]),
      ])
      const buildRows = ({ txSales = [], txPurchases = [], directDeals = [] }) => {
        const rows = []
        const toValidNumber = (value) => {
          if (value === null || value === undefined || value === '') return null
          const parsed = Number(value)
          return Number.isFinite(parsed) ? parsed : null
        }
        const resolveUnfixAmount = (line = {}) => {
          const premium = toValidNumber(line.premiumAmount)
            ?? toValidNumber(line.premiumAmt)
            ?? toValidNumber(line.premium)
            ?? toValidNumber(line.premiumValueAmount)
          if (premium !== null) return premium
          const total = toValidNumber(line.totalAmount) ?? toValidNumber(line.amountLC)
          const metal = toValidNumber(line.metalAmount)
          if (total !== null && metal !== null) return total - metal
          return 0
        }
        const txRows = [...txSales, ...txPurchases]
        for (const tx of txRows) {
          const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
          const txFixingTypeRaw = String(tx?.voucherMeta?.fixingType || tx?.metalFixStatus || '').trim().toLowerCase()
          const txFixingMode = ['non-fixing', 'non_fixing', 'nonfixing', 'unfixed', 'unfix'].includes(txFixingTypeRaw) ? 'Unfixing' : 'Fixing'
          const voucherNo = String(tx?.voucherMeta?.vocNo || tx?.voucherMeta?.refNo || tx?._id || '').trim()
          const branch = tx?.voucherMeta?.branch || 'HO'
          const partyName = tx?.customerId?.name || tx?.vendorId?.name || tx?.voucherMeta?.partyName || '—'
          const docDate = tx?.voucherMeta?.docDate || tx?.date || null
          const valueDate = tx?.voucherMeta?.valueDate || tx?.date || null
          if (fixingRegFilter.excludeFutures && valueDate && new Date(valueDate) > today) continue
          if (fixingRegFilter.partyFilter === 'selected' && fixingRegFilter.partySearch.trim()) {
            if (!partyName.toLowerCase().includes(fixingRegFilter.partySearch.trim().toLowerCase())) continue
          }
          if (!lines.length) {
            if (!isAllMetalSelection) continue
            if (fixingRegFilter.excludeOpeningBalance && /opening/i.test(String(tx?.description || ''))) continue
            rows.push({
              rowId: `${tx._id}-0`,
              sourceType: 'Voucher',
              voucherNo,
              docDate,
              valueDate,
              branch,
              customerName: partyName,
              direction: tx.type === 'purchase' ? 'buy' : 'sell',
              metal: '',
              qty: 0,
              price: Number(tx?.voucherMeta?.metalRate || 0),
              amount: Number(tx?.amount || 0),
              dealStatus: tx?.status || 'draft',
              remarks: tx?.description || '',
              fixingMode: txFixingMode,
              groupKey: fixingRegFilter.groupBy === 'customer' ? partyName : fixingRegFilter.groupBy === 'branch' ? branch : fixingRegFilter.groupBy === 'valuedate' ? new Date(valueDate || docDate || Date.now()).toISOString().slice(0, 10) : 'All',
            })
            continue
          }
          lines.forEach((line, idx) => {
            const lineMetal = resolveVoucherLineMetalCode(line)
            if (!matchesSelectedMetal(lineMetal)) return
            const narration = String(line.narration || tx?.description || '')
            const pureWeightGram = Number(line.pureWeight || line.grossWeight || 0)
            const qtyOz = pureWeightGram > 0 ? (pureWeightGram / 31.1034768) : 0
            if (fixingRegFilter.excludeOpeningBalance && /opening/i.test(narration)) return
            rows.push({
              rowId: `${tx._id}-${idx}`,
              sourceType: 'Voucher',
              voucherNo,
              docDate,
              valueDate,
              branch,
              customerName: partyName,
              direction: tx.type === 'purchase' ? 'buy' : 'sell',
              metal: lineMetal || '',
              qty: qtyOz,
              price: Number(line.metalRate || tx?.voucherMeta?.metalRate || 0),
              amount: txFixingMode === 'Unfixing'
                ? resolveUnfixAmount(line)
                : Number(line.totalAmount || line.amountLC || tx?.amount || 0),
              dealStatus: tx?.status || 'draft',
              remarks: narration,
              fixingMode: txFixingMode,
              groupKey: fixingRegFilter.groupBy === 'customer' ? partyName : fixingRegFilter.groupBy === 'branch' ? branch : fixingRegFilter.groupBy === 'valuedate' ? new Date(valueDate || docDate || Date.now()).toISOString().slice(0, 10) : 'All',
            })
          })
        }
        for (const deal of directDeals) {
          if (deal.isDeleted) continue
          if (fixingRegFilter.status === 'final' && deal.status !== 'confirmed') continue
          const dealEntryType = String(deal.entryType || 'fixing').trim().toLowerCase()
          const dealFixingMode = ['non-fixing', 'non_fixing', 'nonfixing', 'unfixed', 'unfixing'].includes(dealEntryType) ? 'Unfixing' : 'Fixing'
          const dealDocDate = new Date(deal.docDate)
          const dealValueDate = new Date(deal.valueDate)
          if (fixingRegFilter.excludeOpeningBalance && /opening/i.test(deal.remarks || '')) continue
          if (fixingRegFilter.excludeFutures && dealValueDate > today) continue
          for (const line of deal.lineItems || []) {
            const lineMetal = resolveDirectDealMetalCode(line.metal || 'XAU')
            if (!matchesSelectedMetal(lineMetal)) continue
            const qtyOz = fixingRegConvertToOz(Number(line.qty || 0), line.stockCode || 'OZ')
            const partyName = line.customerName || '—'
            if (fixingRegFilter.partyFilter === 'selected' && fixingRegFilter.partySearch.trim()) {
              if (!partyName.toLowerCase().includes(fixingRegFilter.partySearch.trim().toLowerCase())) continue
            }
            const groupKey =
              fixingRegFilter.groupBy === 'customer' ? (partyName)
              : fixingRegFilter.groupBy === 'branch' ? (deal.branch || 'HO')
              : fixingRegFilter.groupBy === 'valuedate' ? new Date(deal.valueDate).toISOString().slice(0, 10)
              : 'All'
            rows.push({
              rowId: `${deal._id}-${line._id || Math.random().toString(36).slice(2, 8)}`,
              sourceType: 'Direct Deal',
              voucherNo: deal.docNo,
              docDate: dealDocDate,
              valueDate: dealValueDate,
              branch: deal.branch || 'HO',
              dealStatus: deal.status,
              remarks: deal.remarks || '',
              direction: line.direction,
              metal: lineMetal || 'XAU',
              qty: qtyOz,
              eqOz: Number(line.eqOz || 0),
              stockCode: (line.stockCode || 'OZ').toUpperCase(),
              price: Number(line.price || 0),
              amount: Number(line.amount || 0),
              customerName: partyName,
              customerCode: line.customerCode || '',
              fixingMode: dealFixingMode,
              groupKey,
            })
          }
        }
        rows.sort((a, b) => {
          const orderBy = fixingRegFilter.orderBy || 'voucherNo'
          if (orderBy === 'docDate' || orderBy === 'valueDate') {
            const dateKey = orderBy
            const dateCompare = new Date(a[dateKey] || 0) - new Date(b[dateKey] || 0)
            if (dateCompare !== 0) return dateCompare
          }
          const aVoucher = String(a.voucherNo || '')
          const bVoucher = String(b.voucherNo || '')
          const voucherCompare = aVoucher.localeCompare(bVoucher, undefined, { numeric: true, sensitivity: 'base' })
          if (voucherCompare !== 0) return voucherCompare
          return new Date(a.docDate || 0) - new Date(b.docDate || 0)
        })
        return rows
      }
      const resolveVoucherLineMetalCode = (line = {}) => {
        const raw = String(line.stockCode || line.productType || line.narration || '').trim().toUpperCase()
        if (!raw) return ''
        if (raw.includes('XAU') || raw.includes('GOLD')) return 'XAU'
        if (raw.includes('XAG') || raw.includes('SILVER')) return 'XAG'
        if (raw.includes('XPT') || raw.includes('PLATINUM')) return 'XPT'
        if (raw.includes('XPD') || raw.includes('PALLADIUM')) return 'XPD'
        return ''
      }
      const resolveDirectDealMetalCode = (value) => {
        const raw = String(value || '').trim().toUpperCase()
        if (!raw) return ''
        if (raw === 'XAU' || raw.includes('GOLD')) return 'XAU'
        if (raw === 'XAG' || raw.includes('SILV')) return 'XAG'
        if (raw === 'XPT' || raw.includes('PLAT')) return 'XPT'
        if (raw === 'XPD' || raw.includes('PALL')) return 'XPD'
        return raw
      }
      const openingRows = fixingRegFilter.excludeOpeningBalance
        ? []
        : buildRows({ txSales: openingSaleTxs, txPurchases: openingPurchaseTxs, directDeals: openingDeals })
      const rows = buildRows({ txSales: saleTxs, txPurchases: purchaseTxs, directDeals: deals })
      const openingQtyOz = openingRows.reduce((sum, row) => {
        const mode = String(row?.fixingMode || '').trim().toLowerCase()
        if (mode === 'unfixing') return sum
        const qty = Number(row.qty || 0)
        const sign = String(row.direction || '').toLowerCase() === 'buy' ? 1 : -1
        return sum + (sign * qty)
      }, 0)
      const getRowSignedAmount = (row) => {
        const amount = Number(row?.amount || 0)
        const mode = String(row?.fixingMode || '').trim().toLowerCase()
        if (mode === 'unfixing') return amount
        const sign = String(row?.direction || '').toLowerCase() === 'buy' ? 1 : -1
        return sign * amount
      }
      const openingValue = openingRows.reduce((sum, row) => {
        return sum + getRowSignedAmount(row)
      }, 0)
      setFixingRegOpening({ qtyOz: openingQtyOz, value: openingValue })
      setFixingRegResults(rows)
      setFixingRegShown(true)
    } catch (err) {
      setFixingRegError(err?.response?.data?.message || err.message || 'Failed to load fixing register data.')
    } finally {
      setFixingRegLoading(false)
    }
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
  const escapeHtml = (value) => String(value ?? '')
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
    const w = window.open('', '_blank')
    if (!w) {
      setError('Popup blocked. Please allow popups for statement preview')
      return
    }
    w.document.open()
    w.document.write(`
      <html>
        <head><title>Preparing Statement</title></head>
        <body style="margin:0;padding:32px;font-family:Arial, sans-serif;color:#111827;background:#ffffff;">
          Preparing statement...
        </body>
      </html>
    `)
    w.document.close()
    try {
      const htmlData = await generateStatementHtml()
      if (!htmlData) {
        w.close()
        return
      }
      w.document.open()
      w.document.write(htmlData.html)
      w.document.close()
      w.focus()
      showNotification('Statement preview opened')
    } catch (err) {
      console.error('Statement preview error:', err)
      w.document.open()
      w.document.write(`
        <html>
          <head><title>Statement Error</title></head>
          <body style="margin:0;padding:32px;font-family:Arial, sans-serif;color:#991B1B;background:#ffffff;">
            Failed to open statement preview.
          </body>
        </html>
      `)
      w.document.close()
      setError('Failed to open statement preview.')
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
    setActiveTab('transactions')
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
  useEffect(() => {
    if (!jumpToEnquiryAccountCode || typeof onJumpToEnquiryConsumed !== 'function') return undefined
    let cancelled = false
    ;(async () => {
      try {
        const code = String(jumpToEnquiryAccountCode || '').trim()
        if (!code) return
        setActiveTab('enquiry')
        await fetchAccountEnquiryByCode(code, { openModal: true })
      } finally {
        if (!cancelled) onJumpToEnquiryConsumed()
      }
    })()
    return () => {
      cancelled = true
    }
    // One-shot deep link from notifications; fetchAccountEnquiryByCode is intentionally omitted from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpToEnquiryAccountCode, onJumpToEnquiryConsumed])

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
  // ─── Multi-line Journal Voucher helpers ──────────────────────────────────────
  const getJvAccountById = (accountId) => entryAccountOptions.find((item) => String(item?._id) === String(accountId || '')) || null
  const getJvAccountCode = (accountId) => String(getJvAccountById(accountId)?.accountCode || '').trim().toUpperCase()
  const isExchangeAccountCode = (code) => ['4190', '5190'].includes(String(code || '').trim().toUpperCase())
  const isExchangeLine = (line) => isExchangeAccountCode(getJvAccountCode(line?.accountId))
  const applyBankJvExchangeBalancing = (lines) => {
    if (jvMode !== 'bank_jv') return lines
    const hasManualFxEntry = lines.some((line) => {
      if (!isExchangeLine(line)) return false
      const hasAmount = Number(line.debit || 0) > 0 || Number(line.credit || 0) > 0
      return hasAmount && !line.autoFx
    })
    if (hasManualFxEntry) return lines
    const withoutFxAmounts = lines.map((line) => (
      isExchangeLine(line) && line.autoFx
        ? { ...line, debit: '', credit: '' }
        : line
    ))
    const nonFxLines = withoutFxAmounts.filter((line) => String(line.accountId || '').trim() && !isExchangeLine(line))
    if (nonFxLines.length < 2) return withoutFxAmounts
    let baseDebit = 0
    let baseCredit = 0
    for (const line of nonFxLines) {
      const accountCurrency = inferJvAccountCurrency(line.accountId)
      const debitRaw = Number(line.debit || 0)
      const creditRaw = Number(line.credit || 0)
      const debitValue = Number.isFinite(debitRaw) && debitRaw > 0 ? debitRaw : 0
      const creditValue = Number.isFinite(creditRaw) && creditRaw > 0 ? creditRaw : 0
      if (debitValue > 0) {
        const normalizedDebit = convertJvAmount(debitValue, accountCurrency, baseCurrencyCode)
        if (!Number.isFinite(normalizedDebit)) return withoutFxAmounts
        baseDebit += normalizedDebit
      }
      if (creditValue > 0) {
        const normalizedCredit = convertJvAmount(creditValue, accountCurrency, baseCurrencyCode)
        if (!Number.isFinite(normalizedCredit)) return withoutFxAmounts
        baseCredit += normalizedCredit
      }
    }
    const difference = Number((baseDebit - baseCredit).toFixed(2))
    if (Math.abs(difference) < 0.005) return withoutFxAmounts
    const needsDebitFx = difference < 0
    const targetCode = needsDebitFx ? '5190' : '4190'
    const targetAccount = entryAccountOptions.find((item) => String(item?.accountCode || '').trim().toUpperCase() === targetCode)
    if (!targetAccount?._id) return withoutFxAmounts
    let workingLines = withoutFxAmounts
    let targetLine = withoutFxAmounts.find((line) => getJvAccountCode(line.accountId) === targetCode)
      || withoutFxAmounts.find((line) => isExchangeLine(line))
      || withoutFxAmounts.find((line) => {
        const hasAccount = String(line.accountId || '').trim().length > 0
        const hasAmount = Number(line.debit || 0) > 0 || Number(line.credit || 0) > 0
        const hasNarration = String(line.description || '').trim().length > 0
        return !hasAccount && !hasAmount && !hasNarration
      })
    // If user filled both bank rows and there is no free/FX row, auto-add one for instant balancing.
    if (!targetLine) {
      const nextId = Math.max(0, ...withoutFxAmounts.map((line) => Number(line.id || 0))) + 1
      targetLine = { id: nextId, accountId: '', accountInput: '', description: '', debit: '', credit: '', autoFx: true }
      workingLines = [...withoutFxAmounts, targetLine]
    }
    const targetCurrency = inferJvAccountCurrency(targetAccount._id)
    const fxAmount = convertJvAmount(Math.abs(difference), baseCurrencyCode, targetCurrency)
    if (!Number.isFinite(fxAmount) || fxAmount <= 0) return workingLines
    return workingLines.map((line) => {
      if (line.id !== targetLine.id) return line
      return {
        ...line,
        accountId: String(targetAccount._id),
        accountInput: accountLookupText(targetAccount),
        debit: needsDebitFx ? String(fxAmount) : '',
        credit: needsDebitFx ? '' : String(fxAmount),
        autoFx: true,
      }
    })
  }
  const updateJvLine = (id, field, value) => {
    setJvLines((prev) => {
      const withEdited = prev.map((line) => {
        if (line.id !== id) return line
        if (field === 'debit') return { ...line, debit: value, credit: '', autoFx: false, autoSync: false }
        if (field === 'credit') return { ...line, credit: value, debit: '', autoFx: false, autoSync: false }
        return { ...line, [field]: value, autoFx: false, autoSync: false }
      })
      if (jvMode !== 'bank_jv' || !['debit', 'credit'].includes(field)) return withEdited
      const enteredAmount = Number(value || 0)
      if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) return applyBankJvExchangeBalancing(withEdited)
      const sourceLine = withEdited.find((line) => line.id === id)
      if (!sourceLine?.accountId) return applyBankJvExchangeBalancing(withEdited)
      if (isExchangeLine(sourceLine) && enteredAmount > 0) return withEdited
      const targetField = field === 'debit' ? 'credit' : 'debit'
      const targetLine = withEdited.find((line) => {
        if (line.id === id) return false
        if (!String(line.accountId || '').trim()) return false
        if (isExchangeLine(line)) return false
        return true
      })
      if (!targetLine) return applyBankJvExchangeBalancing(withEdited)
      const existingTargetValue = Number(targetLine[targetField] || 0)
      const preserveManualTarget = Number.isFinite(existingTargetValue)
        && existingTargetValue > 0
        && !targetLine.autoSync
      if (preserveManualTarget) {
        return applyBankJvExchangeBalancing(withEdited)
      }
      const sourceCurrency = inferJvAccountCurrency(sourceLine.accountId)
      const targetCurrency = inferJvAccountCurrency(targetLine.accountId)
      const convertedAmount = convertJvAmount(enteredAmount, sourceCurrency, targetCurrency)
      if (!Number.isFinite(convertedAmount) || convertedAmount <= 0) return applyBankJvExchangeBalancing(withEdited)
      const withSyncedPair = withEdited.map((line) => {
        if (line.id !== targetLine.id) return line
        return targetField === 'debit'
          ? { ...line, debit: String(convertedAmount), credit: '', autoFx: false, autoSync: true }
          : { ...line, credit: String(convertedAmount), debit: '', autoFx: false, autoSync: true }
      })
      return applyBankJvExchangeBalancing(withSyncedPair)
    })
  }
  const resolveJvLineAccount = (lineId, value, label = '') => {
    const resolvedId = resolveAccountIdFromInput(value, entryAccountOptions)
    const account = resolvedId ? entryAccountOptions.find((a) => String(a._id) === String(resolvedId)) : null
    const resolvedLabel = account ? accountLookupText(account) : label
    setJvLines((prev) => {
      const withResolved = prev.map((line) => (
        line.id !== lineId
          ? line
          : { ...line, accountId: resolvedId || '', accountInput: resolvedLabel || '', autoFx: false, autoSync: false }
      ))
      return applyBankJvExchangeBalancing(withResolved)
    })
  }
  const getJvValidation = (lines) => {
    const lineIssuesById = {}
    const activeLines = []
    let totalDebit = 0
    let totalCredit = 0
    let totalDebitRaw = 0
    let totalCreditRaw = 0
    const headerCur = normalizeJvCurrencyCode(jvHeader.currency || baseCurrencyCode)
    const baseNorm = normalizeJvCurrencyCode(baseCurrencyCode)
    const useDocCurrency = headerCur !== baseNorm
    // LoopC INR-base: journal lines are entered in voucher (header) currency; do not re-interpret
    // per GL account currency when header === base (avoids USD-tagged COA inflating INR totals).
    const loopcJournalHeaderLineCurrency = inventoryTenantKey === 'loopc' && jvMode === 'journal'
    const treatLineAmountsAsHeaderCurrency = Boolean(loopcJournalHeaderLineCurrency || useDocCurrency)
    lines.forEach((line, index) => {
      const debit = Number(line.debit || 0)
      const credit = Number(line.credit || 0)
      const debitRawValue = Number.isFinite(debit) && debit > 0 ? debit : 0
      const creditRawValue = Number.isFinite(credit) && credit > 0 ? credit : 0
      totalDebitRaw += debitRawValue
      totalCreditRaw += creditRawValue
      const accountId = String(line.accountId || '').trim()
      const hasNarration = String(line.description || '').trim().length > 0
      const hasAmount = debitRawValue > 0 || creditRawValue > 0
      const hasTyped = hasAmount || hasNarration || accountId
      let debitValue = debitRawValue
      let creditValue = creditRawValue
      if (accountId) {
        const lineAmountCurrency = treatLineAmountsAsHeaderCurrency ? headerCur : inferJvAccountCurrency(accountId)
        if (debitRawValue > 0) {
          const normalizedDebit = convertJvAmount(debitRawValue, lineAmountCurrency, baseNorm)
          if (!Number.isFinite(normalizedDebit) || normalizedDebit <= 0) {
            lineIssuesById[line.id] = `Row ${index + 1}: Missing or invalid currency rate for ${lineAmountCurrency}`
          } else {
            debitValue = normalizedDebit
          }
        }
        if (creditRawValue > 0) {
          const normalizedCredit = convertJvAmount(creditRawValue, lineAmountCurrency, baseNorm)
          if (!Number.isFinite(normalizedCredit) || normalizedCredit <= 0) {
            lineIssuesById[line.id] = `Row ${index + 1}: Missing or invalid currency rate for ${lineAmountCurrency}`
          } else {
            creditValue = normalizedCredit
          }
        }
      }
      if (debitValue > 0 && creditValue > 0) {
        lineIssuesById[line.id] = `Row ${index + 1}: Only one side allowed per row`
      } else if (hasTyped && !hasAmount && !(jvMode === 'bank_jv' && isExchangeLine(line))) {
        lineIssuesById[line.id] = `Row ${index + 1}: Enter debit or credit amount`
      } else if (hasAmount && !accountId) {
        lineIssuesById[line.id] = `Row ${index + 1}: Account is required`
      }
      totalDebit += debitValue
      totalCredit += creditValue
      if (!lineIssuesById[line.id] && hasAmount && accountId) {
        activeLines.push({
          id: line.id,
          accountId,
          description: String(line.description || '').trim(),
          debit: debitValue,
          credit: creditValue,
        })
      }
    })
    const difference = Number((totalDebit - totalCredit).toFixed(2))
    const hasLineIssues = Object.keys(lineIssuesById).length > 0
    const hasDebit = totalDebit > 0
    const hasCredit = totalCredit > 0
    const isBalanced = hasDebit && hasCredit && Math.abs(difference) < 0.005
    const canSave = !hasLineIssues && isBalanced && activeLines.length > 1
    const displayTotalCurrency = treatLineAmountsAsHeaderCurrency ? headerCur : baseNorm
    const displayDebitTotal = treatLineAmountsAsHeaderCurrency ? Number(totalDebitRaw.toFixed(2)) : totalDebit
    const displayCreditTotal = treatLineAmountsAsHeaderCurrency ? Number(totalCreditRaw.toFixed(2)) : totalCredit
    const useRawJvLineAmountsForSave = Boolean(useDocCurrency || loopcJournalHeaderLineCurrency)
    return {
      activeLines,
      lineIssuesById,
      totalDebit,
      totalCredit,
      totalDebitRaw,
      totalCreditRaw,
      useDocCurrency,
      useRawJvLineAmountsForSave,
      displayTotalCurrency,
      displayDebitTotal,
      displayCreditTotal,
      difference,
      isBalanced,
      canSave,
      hasLineIssues,
    }
  }
  const addJvLine = () => {
    setJvLines((prev) => [...prev, emptyJvLine(nextJvLineId)])
    setNextJvLineId((n) => n + 1)
  }
  const removeJvLine = (id) => {
    setJvLines((prev) => prev.filter((l) => l.id !== id))
  }
  const handleJvLineKeyDown = (e, idx) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (idx === jvLines.length - 1) addJvLine()
    }
  }
  const handleJvAccountKeyDown = (e, idx) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (idx === jvLines.length - 1) addJvLine()
    }
  }
  const resetJvForm = async (mode = 'journal') => {
    setJvMode(mode)
    setJvLines([emptyJvLine(1), emptyJvLine(2)])
    setNextJvLineId(3)
    setJvEditEntryIds([])
    let docNo = buildJvDocNo(mode)
    const refType = resolveJvModeMeta(mode).referenceType
    try {
      if (token) {
        const data = await erpAccountingAPI.getNextJvDocNo(token, refType)
        if (data?.success && data.docNo) docNo = data.docNo
      }
    } catch (_) { /* keep client-side sequence from current page */ }
    setJvHeader({
      docNo,
      date: new Date().toISOString().slice(0, 10),
      narration: '',
      currency: baseCurrencyCode,
    })
  }
  const handleEditJv = async (entry) => {
    const rawDesc = String(entry.description || '')
    const docNoHead = (rawDesc.includes(' — ') ? rawDesc.split(' — ') : rawDesc.split(' - '))[0]?.trim() || ''
    const docNo = docNoHead
    const hasDocPrefix = /^(jv|bnkjv)[/-]/i.test(String(docNo || ''))
    const entryMode = String(entry?.referenceType || '').toLowerCase() === 'bank_jv' ? 'bank_jv' : 'journal'
    const refTypeFilter = entryMode
    let docMatchedEntries = [entry]
    try {
      const batchId = entry.referenceId ? String(entry.referenceId).trim() : ''
      if (batchId && /^[a-fA-F0-9]{24}$/.test(batchId)) {
        const data = await erpAccountingAPI.getLedger(token, {
          referenceType: refTypeFilter,
          referenceId: batchId,
          limit: 300,
          page: 1,
        })
        if (Array.isArray(data?.entries) && data.entries.length) {
          docMatchedEntries = data.entries
        }
      } else if (docNo && hasDocPrefix) {
        const data = await erpAccountingAPI.getLedger(token, {
          referenceType: refTypeFilter,
          docNoPrefix: docNo,
          limit: 300,
          page: 1,
        })
        if (Array.isArray(data?.entries) && data.entries.length) {
          docMatchedEntries = data.entries
        }
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load JV lines for editing')
      return
    }
    const editableEntries = filterJvEditableEntries(docMatchedEntries, entry, entryMode)
    const reconstructed = reconstructJvEditLines(editableEntries, entry, {
      baseCurrencyCode,
      normalizeJvCurrencyCode,
      convertJvAmount,
      inferJvAccountCurrency,
      inferLegacyJvBatchDisplayFc,
    })
    setJvMode(reconstructed.entryMode)
    setJvEditEntryIds(reconstructed.jvEditEntryIds)
    setJvLines(reconstructed.lines)
    setNextJvLineId(reconstructed.nextJvLineId)
    setJvHeader({
      docNo: reconstructed.headerDocNo,
      date: reconstructed.entryDate,
      narration: reconstructed.narration,
      currency: reconstructed.headerCurrency,
    })
    setJvModalOffset({ x: 0, y: 0 })
    setJvModalDrag({ active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 })
    setJvModalResize({ active: false, pointerX: 0, pointerY: 0, startW: JV_MODAL_DEFAULT_SIZE.width, startH: JV_MODAL_DEFAULT_SIZE.height })
    setJvModalSize(JV_MODAL_DEFAULT_SIZE)
    setShowLedgerForm(true)
  }
  const handleRepairJvFxPreview = async () => {
    if (!canCloseLedgerPeriod || !token) return
    setSaving(true)
    try {
      const data = await erpAccountingAPI.repairJvFxPreview(token, { mode: 'coa' })
      const msg = `Preview: ${data.updated} postings would update (${data.candidateRows} base+1 candidates). Skipped line-events: ${data.skipped}.`
      showNotification(msg)
      if (Array.isArray(data.skipSamples) && data.skipSamples.length) {
        console.info('[repairJvFx preview skip samples]', data.skipSamples)
      }
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'JV FX repair preview failed')
    } finally {
      setSaving(false)
    }
  }
  const handleRepairJvFxApply = async () => {
    if (!canCloseLedgerPeriod || !token) return
    const reason = window.prompt('Maintenance reason (min 8 characters)', 'JV ledger backfill store UZS and FX rate')
    if (!reason || String(reason).trim().length < 8) {
      showNotification('Apply cancelled: reason must be at least 8 characters.')
      return
    }
    const confirmToken = window.prompt('Enter server DESTRUCTIVE_ADMIN_CONFIRM_TOKEN (production also needs ENABLE_DESTRUCTIVE_ADMIN_API=true)')
    if (!confirmToken?.trim()) {
      showNotification('Apply cancelled.')
      return
    }
    setSaving(true)
    try {
      const data = await erpAccountingAPI.repairJvFxApply(token, {
        mode: 'coa',
        confirmToken: String(confirmToken).trim(),
        reason: String(reason).trim(),
      })
      showNotification(data.message || `Updated ${data.updated} ledger postings`)
      setError('')
      await loadLedger()
    } catch (e) {
      setError(e.response?.data?.message || 'JV FX repair apply failed')
    } finally {
      setSaving(false)
    }
  }
  const closeJvModal = () => {
    setShowLedgerForm(false)
    void resetJvForm(ledgerVoucherTab)
    setJvModalOffset({ x: 0, y: 0 })
    setJvModalDrag({ active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 })
    setJvModalResize({ active: false, pointerX: 0, pointerY: 0, startW: JV_MODAL_DEFAULT_SIZE.width, startH: JV_MODAL_DEFAULT_SIZE.height })
    setJvModalSize(JV_MODAL_DEFAULT_SIZE)
  }
  const openJvModal = async (mode = ledgerVoucherTab) => {
    await resetJvForm(mode)
    setJvModalOffset({ x: 0, y: 0 })
    setJvModalDrag({ active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 })
    setJvModalResize({ active: false, pointerX: 0, pointerY: 0, startW: JV_MODAL_DEFAULT_SIZE.width, startH: JV_MODAL_DEFAULT_SIZE.height })
    setJvModalSize(JV_MODAL_DEFAULT_SIZE)
    setShowLedgerForm(true)
  }
  const switchJvMode = async (mode) => {
    if (jvEditEntryIds.length > 0) return
    setJvMode(mode)
    let docNo = buildJvDocNo(mode)
    try {
      if (token) {
        const data = await erpAccountingAPI.getNextJvDocNo(token, resolveJvModeMeta(mode).referenceType)
        if (data?.success && data.docNo) docNo = data.docNo
      }
    } catch (_) { /* keep client fallback */ }
    setJvHeader((prev) => ({ ...prev, docNo }))
  }
  const handlePrintJvVoucher = async () => {
    const validation = getJvValidation(jvLines)
    const modeMeta = resolveJvModeMeta(jvMode)
    const logoMarkup = await buildBrandingLogoTag(branding, 'margin-left:auto;')
    const rows = (validation.activeLines.length ? validation.activeLines : jvLines)
      .map((line, index) => {
        const account = getJvAccountById(line.accountId)
        const accountText = account
          ? `${account.accountCode || ''} - ${account.accountName || ''}`
          : (line.accountInput || line.accountId || '')
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(accountText)}</td>
            <td>${escapeHtml(line.description || jvHeader.narration || '')}</td>
            <td class="num">${Number(line.debit || 0) > 0 ? Number(line.debit || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
            <td class="num">${Number(line.credit || 0) > 0 ? Number(line.credit || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
          </tr>
        `
      })
      .join('')
    const body = `
      <div class="doc-head">
        <div>
          <div class="company">${escapeHtml(branding.companyName || DEFAULT_BRANDING.companyName)}</div>
          ${branding.address ? `<div class="meta">${escapeHtml(branding.address).replace(/\n/g, '<br />')}</div>` : ''}
          ${branding.phone ? `<div class="meta">Telephone: ${escapeHtml(branding.phone)}</div>` : ''}
          ${branding.trn ? `<div class="meta">TRN: ${escapeHtml(branding.trn)}</div>` : ''}
        </div>
        ${logoMarkup}
      </div>
      <h1>${escapeHtml(modeMeta.badge)}</h1>
      <div class="meta-grid">
        <div><strong>Doc No:</strong> ${escapeHtml(jvHeader.docNo || '')}</div>
        <div><strong>Date:</strong> ${escapeHtml(jvHeader.date || '')}</div>
        <div><strong>Currency:</strong> ${escapeHtml(jvHeader.currency || baseCurrencyCode)}</div>
        <div><strong>Prepared By:</strong> ${escapeHtml(user?.name || '')}</div>
      </div>
      <table>
        <thead><tr><th>No.</th><th>Account</th><th>Narration</th><th class="num">Debit</th><th class="num">Credit</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5">No JV rows</td></tr>'}</tbody>
        <tfoot><tr><td colspan="3" class="num">Total</td><td class="num">${(validation.displayDebitTotal ?? validation.totalDebit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td class="num">${(validation.displayCreditTotal ?? validation.totalCredit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr></tfoot>
      </table>
      <div class="note">${escapeHtml(jvHeader.narration || '')}</div>
      <div class="signatures">
        <div>Prepared By</div>
        <div>Checked By</div>
        <div>Authorised Signatory</div>
      </div>
    `
    openPrintWindow(modeMeta.badge, body)
    showNotification('JV print layout opened')
  }
  const handleSaveMultiLineJV = async () => {
    const validation = getJvValidation(jvLines)
    if (validation.hasLineIssues) {
      const firstLineIssue = Object.values(validation.lineIssuesById)[0]
      setError(firstLineIssue || 'Please fix JV row errors before saving')
      return
    }
    if (!validation.activeLines.length) {
      setError('Add at least one debit row and one credit row')
      return
    }
    if (!validation.isBalanced) {
      setError('Debit and Credit totals are not balanced')
      return
    }
    const headerCur = normalizeJvCurrencyCode(jvHeader.currency || baseCurrencyCode)
    const baseCur = normalizeJvCurrencyCode(baseCurrencyCode)
    const strictUseDocCurrency = Boolean(validation.useDocCurrency)
    const useRawJvLineAmountsForSave = Boolean(validation.useRawJvLineAmountsForSave)

    let debitQueue
    let creditQueue
    if (useRawJvLineAmountsForSave) {
      debitQueue = jvLines
        .filter((line) => String(line.accountId || '').trim() && Number(line.debit || 0) > 0)
        .map((line) => ({
          accountId: line.accountId,
          description: String(line.description || '').trim(),
          remaining: Number(Number(line.debit || 0).toFixed(2)),
        }))
      creditQueue = jvLines
        .filter((line) => String(line.accountId || '').trim() && Number(line.credit || 0) > 0)
        .map((line) => ({
          accountId: line.accountId,
          description: String(line.description || '').trim(),
          remaining: Number(Number(line.credit || 0).toFixed(2)),
        }))
    } else {
      debitQueue = validation.activeLines
        .filter((line) => line.debit > 0)
        .map((line) => ({ ...line, remaining: Number(line.debit.toFixed(2)) }))
      creditQueue = validation.activeLines
        .filter((line) => line.credit > 0)
        .map((line) => ({ ...line, remaining: Number(line.credit.toFixed(2)) }))
    }
    if (!debitQueue.length || !creditQueue.length) {
      setError('JV requires at least one debit row and one credit row')
      return
    }
    const entries = []
    let drIndex = 0
    let crIndex = 0
    while (drIndex < debitQueue.length && crIndex < creditQueue.length) {
      const debitLine = debitQueue[drIndex]
      const creditLine = creditQueue[crIndex]
      const pairAmount = Math.min(debitLine.remaining, creditLine.remaining)
      if (pairAmount > 0) {
        entries.push({
          debitAccountId: debitLine.accountId,
          creditAccountId: creditLine.accountId,
          amount: Number(pairAmount.toFixed(2)),
          lineDesc: [debitLine.description, creditLine.description].filter(Boolean).join(' | '),
        })
      }
      debitLine.remaining = Number((debitLine.remaining - pairAmount).toFixed(2))
      creditLine.remaining = Number((creditLine.remaining - pairAmount).toFixed(2))
      if (debitLine.remaining <= 0.004) drIndex += 1
      if (creditLine.remaining <= 0.004) crIndex += 1
    }
    const debitRemainder = debitQueue.reduce((sum, line) => sum + Math.max(0, line.remaining), 0)
    const creditRemainder = creditQueue.reduce((sum, line) => sum + Math.max(0, line.remaining), 0)
    if (debitRemainder > 0.01 || creditRemainder > 0.01) {
      setError('Failed to allocate JV lines into balanced ledger entries')
      return
    }
    const isBankJV = jvMode === 'bank_jv'
    const sharedDesc = [jvHeader.docNo, jvHeader.narration].filter(Boolean).join(' — ') || 'Manual JV'
    const makeJvGroupObjectId = () => {
      const hex = '0123456789abcdef'
      let s = ''
      for (let i = 0; i < 24; i += 1) s += hex[Math.floor(Math.random() * 16)]
      return s
    }
    const jvGroupId = makeJvGroupObjectId()
    let headerFxRate = 1
    if (headerCur !== baseCur) {
      const curRow = currencies.find((c) => normalizeJvCurrencyCode(c?.code) === headerCur)
      headerFxRate = Number(curRow?.exchangeRate || 0)
      if (!Number.isFinite(headerFxRate) || headerFxRate <= 0) {
        setError(`Cannot post in ${headerCur}: add an active ${headerCur} currency with exchangeRate (vs ${baseCur}) in Master → Currencies.`)
        return
      }
      if (!strictUseDocCurrency) {
        for (const row of entries) {
          const fcRaw = Number(row.amount) / headerFxRate
          const postAmt = headerFxRate < 0.001 ? Math.round(fcRaw) : Number(fcRaw.toFixed(2))
          if (!Number.isFinite(postAmt) || postAmt <= 0) {
            setError('A JV line would round to zero in the header currency; adjust amounts or the FX rate.')
            return
          }
        }
      }
    }
    setSaving(true)
    try {
      // If editing an existing JV, reverse old entries first and post replacements.
      // This keeps the accounting audit trail intact.
      if (jvEditEntryIds.length > 0) {
        await Promise.all(jvEditEntryIds.map((id) => erpAccountingAPI.deleteLedgerEntry(token, id)))
      }
      await Promise.all(entries.map((entry) => {
        const pairBase = Number(entry.amount)
        let postAmount = pairBase
        let postCurrency = baseCur
        let postRate = 1
        if (headerCur !== baseCur) {
          if (strictUseDocCurrency) {
            postAmount = pairBase
            postCurrency = headerCur
            postRate = headerFxRate
          } else {
            const fcRaw = pairBase / headerFxRate
            postAmount = headerFxRate < 0.001 ? Math.round(fcRaw) : Number(fcRaw.toFixed(2))
            postCurrency = headerCur
            postRate = headerFxRate
          }
        }
        return erpAccountingAPI.createLedgerEntry(token, {
          date: jvHeader.date,
          description: entry.lineDesc ? `${sharedDesc} — ${entry.lineDesc}` : sharedDesc,
          notes: jvHeader.narration || '',
          referenceType: isBankJV ? 'bank_jv' : 'journal',
          referenceId: jvGroupId,
          currency: postCurrency,
          exchangeRate: postRate,
          debitAccountId: entry.debitAccountId,
          creditAccountId: entry.creditAccountId,
          amount: postAmount,
        })
      }))
      const isEdit = jvEditEntryIds.length > 0
      const voucherLabel = isBankJV ? 'Bank JV' : 'Journal Voucher'
      closeJvModal()
      await Promise.all([loadLedger(), loadDashboard()])
      showNotification(isEdit ? `✅ ${voucherLabel} updated — ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} reposted` : `✅ ${voucherLabel} saved — ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} posted`)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save Journal Voucher')
    } finally {
      setSaving(false)
    }
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
        setActiveTab={setActiveTab}
        onNavigateMain={onNavigateMain}
      />
      {/* CHART OF ACCOUNTS TAB */}
      <ERPAccountsTabContainer activeTab={activeTab}>
        <div>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ color: C.ink, fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>Chart of Accounts</h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: C.inkSoft }}>
              Hierarchical account tree — right-click any account for more options.
            </p>
          </div>
          <ChartOfAccountsTree canManageAccounts={canManageAccounts} onOpenSummary={handleOpenAccountSummaryFromTree} />
        </div>
      </ERPAccountsTabContainer>
      {/* LEDGER TAB */}
      {activeTab === 'customers' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
            <h3 style={{ marginBottom: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Customers</h3>
            {canManageCustomers && (
              <button
                onClick={() => setShowCustomerForm(!showCustomerForm)}
                style={{
                  padding: '0.5rem 1rem',
                  background: C.s1,
                  color: C.t1,
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                + Add Customer
              </button>
            )}
          </div>
          {showCustomerForm && (
            <form onSubmit={handleCreateCustomer} style={{ background: C.p1, padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
              <input placeholder="Customer Name" value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
              <input placeholder="Phone" value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
              <input placeholder="Email" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
              <input placeholder="Address" value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
              <input placeholder="GST/VAT" value={customerForm.gstVat} onChange={(e) => setCustomerForm({ ...customerForm, gstVat: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
              <input type="number" step="0.01" placeholder="Opening Balance" value={customerForm.openingBalance} onChange={(e) => setCustomerForm({ ...customerForm, openingBalance: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
              <input type="number" step="0.01" placeholder="Credit Limit" value={customerForm.creditLimit} onChange={(e) => setCustomerForm({ ...customerForm, creditLimit: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
              <input type="number" placeholder="Payment Terms (Days)" value={customerForm.paymentTermsDays} onChange={(e) => setCustomerForm({ ...customerForm, paymentTermsDays: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
              <input placeholder="Currency (e.g. USD)" value={customerForm.currency} onChange={(e) => setCustomerForm({ ...customerForm, currency: e.target.value.toUpperCase() })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
              <input placeholder="Notes" value={customerForm.notes} onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.75rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
              <button type="submit" disabled={saving} style={{ padding: '0.5rem 1rem', background: C.s1, color: '#FFFFFF', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', marginRight: '0.5rem' }}>
                {saving ? 'Saving...' : 'Create Customer'}
              </button>
              <button type="button" onClick={() => setShowCustomerForm(false)} style={{ padding: '0.5rem 1rem', background: C.p1, color: C.t2, border: `1px solid ${C.t2}`, borderRadius: '0.375rem', cursor: 'pointer' }}>
                Cancel
              </button>
            </form>
          )}
          <div style={{ overflowX: 'auto', background: C.p1, borderRadius: '0.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.p2}` }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Phone</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Email</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>GST/VAT</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', color: C.t1, fontWeight: '600' }}>Opening</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', color: C.t1, fontWeight: '600' }}>Outstanding</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', color: C.t1, fontWeight: '600' }}>0-30</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', color: C.t1, fontWeight: '600' }}>31-60</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', color: C.t1, fontWeight: '600' }}>61-90</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', color: C.t1, fontWeight: '600' }}>90+</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Debtor A/C</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer._id} style={{ borderBottom: `1px solid ${C.p2}` }}>
                    <td style={{ padding: '0.75rem', color: C.t1, fontWeight: '600' }}>{customer.name}</td>
                    <td style={{ padding: '0.75rem', color: C.t2 }}>{customer.phone || '-'}</td>
                    <td style={{ padding: '0.75rem', color: C.t2 }}>{customer.email || '-'}</td>
                    <td style={{ padding: '0.75rem', color: C.t2 }}>{customer.gstVat || '-'}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: C.t2 }}>{Number(customer.openingBalance || 0).toLocaleString()}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: Number(customer.outstandingBalance || 0) > 0 ? C.s1 : Number(customer.outstandingBalance || 0) < 0 ? '#DC2626' : C.t2, fontWeight: '600' }}>{Number(customer.outstandingBalance || 0).toLocaleString()}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: C.t2 }}>{Number(customer.aging?.bucket0to30 || 0).toLocaleString()}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: C.t2 }}>{Number(customer.aging?.bucket31to60 || 0).toLocaleString()}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: C.t2 }}>{Number(customer.aging?.bucket61to90 || 0).toLocaleString()}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: Number(customer.aging?.bucket90Plus || 0) > 0 ? '#F59E0B' : C.t2, fontWeight: Number(customer.aging?.bucket90Plus || 0) > 0 ? '700' : '400' }}>{Number(customer.aging?.bucket90Plus || 0).toLocaleString()}</td>
                    <td style={{ padding: '0.75rem', color: C.t2 }}>{customer.ledgerAccountId?.accountCode || '-'}{customer.ledgerAccountId?.accountName ? ` - ${customer.ledgerAccountId.accountName}` : ''}</td>
                    <td style={{ padding: '0.75rem', color: C.t2 }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button onClick={() => handleEditCustomer(customer)} style={{ padding: '0.35rem 0.7rem', background: '#0F766E', color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => handleDeleteCustomer(customer)} style={{ padding: '0.35rem 0.7rem', background: C.danger, color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer' }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {customers.length === 0 && <p style={{ color: C.inkSoft, marginTop: '1rem', textAlign: 'center' }}>No customers added yet.</p>}
        </div>
      )}
      {/* CUSTOMER MARGIN TAB */}
      {activeTab === 'customer-margin' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                onClick={() => setActiveTab('dashboard')}
                title="Back to ERP Dashboard"
                style={{ background: 'none', border: '1px solid #A7F3D0', borderRadius: '0.4rem', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '1rem', color: '#1a6647', display: 'flex', alignItems: 'center', lineHeight: 1, fontWeight: '700' }}
              >←</button>
              <h3 style={{ margin: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Customer Margin</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <select
                value={customerMarginSort}
                onChange={(e) => setCustomerMarginSort(e.target.value)}
                style={{ padding: '0.48rem 0.62rem', border: '1px solid #CBD5E1', borderRadius: '0.45rem', background: '#FFFFFF', color: C.ink, fontSize: '0.82rem' }}
              >
                <option value="margin-desc">Sort: Margin % (High to Low)</option>
                <option value="margin-asc">Sort: Margin % (Low to High)</option>
                <option value="name-asc">Sort: Name (A-Z)</option>
              </select>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.38rem', color: C.inkSoft, fontSize: '0.82rem', fontWeight: '600' }}>
                <input
                  type="checkbox"
                  checked={customerMarginCompactView}
                  onChange={(e) => setCustomerMarginCompactView(e.target.checked)}
                />
                Fixed List Area
              </label>
              <input
                placeholder="Search customer"
                value={customerMarginSearch}
                onChange={(e) => setCustomerMarginSearch(e.target.value)}
                style={{ width: 'min(320px, 100%)', padding: '0.5rem 0.65rem', border: '1px solid #CBD5E1', borderRadius: '0.45rem', background: '#FFFFFF', color: C.ink }}
              />
            </div>
          </div>
          <div style={{ border: '1px solid #BFD0E5', borderRadius: '0.45rem', overflow: 'hidden', background: '#FFFFFF' }}>
            <div style={{ background: 'linear-gradient(180deg, #E9F3FF 0%, #D7E9FF 100%)', borderBottom: '1px solid #BFD0E5', padding: '0.55rem 0.8rem', fontSize: '1rem', fontWeight: '700', color: '#1E3A8A' }}>
              Customer Margin
            </div>
            <div style={{ overflowX: 'auto', overflowY: customerMarginCompactView ? 'auto' : 'visible', maxHeight: customerMarginCompactView ? '380px' : 'none' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.88rem' }}>
                <colgroup>
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '8%' }} />
                </colgroup>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #D9E2EC' }}>
                    <th style={{ position: 'sticky', top: 0, zIndex: 2, background: '#F3F7FC', borderRight: '1px solid #DEE7F2', padding: '0.46rem 0.68rem', textAlign: 'left', color: '#111827', fontSize: '0.8rem', letterSpacing: '0.02em', fontWeight: '700' }}>Customer Name</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 2, background: '#F3F7FC', borderRight: '1px solid #DEE7F2', padding: '0.46rem 0.68rem', textAlign: 'right', color: '#111827', fontSize: '0.8rem', letterSpacing: '0.02em', fontWeight: '700', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>Gold Position</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 2, background: '#F3F7FC', borderRight: '1px solid #DEE7F2', padding: '0.46rem 0.68rem', textAlign: 'right', color: '#111827', fontSize: '0.8rem', letterSpacing: '0.02em', fontWeight: '700', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>Silver Position</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 2, background: '#F3F7FC', borderRight: '1px solid #DEE7F2', padding: '0.46rem 0.68rem', textAlign: 'right', color: '#111827', fontSize: '0.8rem', letterSpacing: '0.02em', fontWeight: '700', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>Equity</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 2, background: '#F3F7FC', borderRight: '1px solid #DEE7F2', padding: '0.46rem 0.68rem', textAlign: 'right', color: '#111827', fontSize: '0.8rem', letterSpacing: '0.02em', fontWeight: '700', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>Margin</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 2, background: '#F3F7FC', borderRight: '1px solid #DEE7F2', padding: '0.46rem 0.68rem', textAlign: 'right', color: '#111827', fontSize: '0.8rem', letterSpacing: '0.02em', fontWeight: '700', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>Excess</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 2, background: '#F3F7FC', borderRight: '1px solid #DEE7F2', padding: '0.46rem 0.68rem', textAlign: 'right', color: '#111827', fontSize: '0.8rem', letterSpacing: '0.02em', fontWeight: '700' }}>Status</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 2, background: '#F3F7FC', padding: '0.46rem 0.68rem', textAlign: 'right', color: '#111827', fontSize: '0.8rem', letterSpacing: '0.02em', fontWeight: '700', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {customerMarginRows.map((row, index) => {
                    const isNegative = row.status === 'NEGATIVE'
                    const valueColor = isNegative ? '#DC2626' : '#1D4ED8'
                    const excessColor = Number(row.excess || 0) < 0 ? '#DC2626' : '#1D4ED8'
                    return (
                      <tr
                        key={row.id || index}
                        onClick={(event) => handleCustomerMarginRowContextMenu(event, row)}
                        onContextMenu={(event) => handleCustomerMarginRowContextMenu(event, row)}
                        title="Click or right click to open details submenu"
                        style={{ borderBottom: '1px solid #EEF2F7', background: index % 2 === 0 ? '#FFFFFF' : '#FCFDFF', height: '30px', cursor: 'context-menu' }}
                      >
                        <td style={{ borderRight: '1px solid #EEF3F9', padding: '0.34rem 0.68rem', verticalAlign: 'middle', color: valueColor, fontWeight: '600', fontSize: '0.85rem', lineHeight: 1.08, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.customerName}</td>
                        <td style={{ borderRight: '1px solid #EEF3F9', padding: '0.34rem 0.68rem', verticalAlign: 'middle', textAlign: 'right', color: Number(row.goldPosition || 0) < 0 ? '#DC2626' : '#1D4ED8', fontWeight: '700', fontSize: '0.84rem', lineHeight: 1.08, fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginPosition(row.goldPosition)}</td>
                        <td style={{ borderRight: '1px solid #EEF3F9', padding: '0.34rem 0.68rem', verticalAlign: 'middle', textAlign: 'right', color: Number(row.silverPosition || 0) < 0 ? '#DC2626' : '#1D4ED8', fontWeight: '700', fontSize: '0.84rem', lineHeight: 1.08, fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginPosition(row.silverPosition)}</td>
                        <td style={{ borderRight: '1px solid #EEF3F9', padding: '0.34rem 0.68rem', verticalAlign: 'middle', textAlign: 'right', color: valueColor, fontWeight: '700', fontSize: '0.84rem', lineHeight: 1.08, fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginEquity(row)}</td>
                        <td style={{ borderRight: '1px solid #EEF3F9', padding: '0.34rem 0.68rem', verticalAlign: 'middle', textAlign: 'right', color: '#1D4ED8', fontWeight: '700', fontSize: '0.84rem', lineHeight: 1.08, fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginAmount(row.marginAmount)}</td>
                        <td style={{ borderRight: '1px solid #EEF3F9', padding: '0.34rem 0.68rem', verticalAlign: 'middle', textAlign: 'right', color: excessColor, fontWeight: '700', fontSize: '0.84rem', lineHeight: 1.08, fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginEquity({ equity: row.excess })}</td>
                        <td style={{ borderRight: '1px solid #EEF3F9', padding: '0.34rem 0.68rem', verticalAlign: 'middle', textAlign: 'right', color: valueColor, fontWeight: '700', fontSize: '0.8rem', letterSpacing: '0.035em', lineHeight: 1.08 }}>{row.status}</td>
                        <td style={{ padding: '0.34rem 0.68rem', verticalAlign: 'middle', textAlign: 'right', color: valueColor, fontWeight: '700', fontSize: '0.84rem', lineHeight: 1.08, fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginPercent(row.marginPercent)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {customerMarginContextMenu.open && customerMarginContextMenu.row && (
            <div
              onClick={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.preventDefault()}
              style={{
                position: 'fixed',
                top: `${customerMarginContextMenu.y}px`,
                left: `${customerMarginContextMenu.x}px`,
                width: '292px',
                background: '#FDFEFE',
                border: '1px solid #9DB5D5',
                boxShadow: '0 10px 24px rgba(15, 23, 42, 0.2)',
                zIndex: 2000,
                borderRadius: '0.2rem',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '0.35rem 0.5rem', borderBottom: '1px solid #D7E3F3', background: '#E7EFFA', color: '#15407E', fontSize: '0.76rem', fontWeight: '700', letterSpacing: '0.03em' }}>
                CUSTOMER MARGIN SUB MENU
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '132px 1fr', fontSize: '0.78rem' }}>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', borderRight: '1px solid #E8EEF7', color: '#1E3A8A', fontWeight: '700' }}>Account Code</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', color: '#111827' }}>{customerMarginContextMenu.row.accountCode || '-'}</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', borderRight: '1px solid #E8EEF7', color: '#1E3A8A', fontWeight: '700' }}>Description</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{customerMarginContextMenu.row.description || '-'}</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', borderRight: '1px solid #E8EEF7', color: '#1E3A8A', fontWeight: '700' }}>Gold Position</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', color: '#111827', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginPosition(customerMarginContextMenu.row.goldPosition)}</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', borderRight: '1px solid #E8EEF7', color: '#1E3A8A', fontWeight: '700' }}>Silver Position</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', color: '#111827', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginPosition(customerMarginContextMenu.row.silverPosition)}</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', borderRight: '1px solid #E8EEF7', color: '#1E3A8A', fontWeight: '700' }}>Excess/Short</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', color: '#111827', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginExcessShort(customerMarginContextMenu.row)}</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', borderRight: '1px solid #E8EEF7', color: '#1E3A8A', fontWeight: '700' }}>Margin</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', color: '#111827', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginAmount(customerMarginContextMenu.row.marginAmount)}</div>
                <div style={{ padding: '0.34rem 0.52rem', borderRight: '1px solid #E8EEF7', color: '#1E3A8A', fontWeight: '700' }}>Margin %</div>
                <div style={{ padding: '0.34rem 0.52rem', color: '#111827', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginPercent(customerMarginContextMenu.row.marginPercent)}</div>
              </div>
            </div>
          )}
          <div style={{ marginTop: '0.75rem', color: C.inkSoft, fontSize: '0.82rem' }}>
            Equity shows signed exposure: positive values are favorable, negative values are payable.
          </div>
          {customerMarginRows.length === 0 && <p style={{ color: C.inkSoft, marginTop: '1rem', textAlign: 'center' }}>No customers available for margin view.</p>}
        </div>
      )}
      {/* SUPPLIER MARGIN TAB */}
      {activeTab === 'supplier-margin' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                onClick={() => setActiveTab('dashboard')}
                title="Back to ERP Dashboard"
                style={{ background: 'none', border: '1px solid #A7F3D0', borderRadius: '0.4rem', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '1rem', color: '#1a6647', display: 'flex', alignItems: 'center', lineHeight: 1, fontWeight: '700' }}
              >â†</button>
              <h3 style={{ margin: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Supplier Margin</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <select
                value={supplierMarginSort}
                onChange={(e) => setSupplierMarginSort(e.target.value)}
                style={{ padding: '0.48rem 0.62rem', border: '1px solid #CBD5E1', borderRadius: '0.45rem', background: '#FFFFFF', color: C.ink, fontSize: '0.82rem' }}
              >
                <option value="margin-desc">Sort: Margin % (High to Low)</option>
                <option value="margin-asc">Sort: Margin % (Low to High)</option>
                <option value="name-asc">Sort: Name (A-Z)</option>
              </select>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.38rem', color: C.inkSoft, fontSize: '0.82rem', fontWeight: '600' }}>
                <input
                  type="checkbox"
                  checked={supplierMarginCompactView}
                  onChange={(e) => setSupplierMarginCompactView(e.target.checked)}
                />
                Fixed List Area
              </label>
              <input
                placeholder="Search supplier"
                value={supplierMarginSearch}
                onChange={(e) => setSupplierMarginSearch(e.target.value)}
                style={{ width: 'min(320px, 100%)', padding: '0.5rem 0.65rem', border: '1px solid #CBD5E1', borderRadius: '0.45rem', background: '#FFFFFF', color: C.ink }}
              />
            </div>
          </div>
          <div style={{ border: '1px solid #BFD0E5', borderRadius: '0.45rem', overflow: 'hidden', background: '#FFFFFF' }}>
            <div style={{ background: 'linear-gradient(180deg, #E9F3FF 0%, #D7E9FF 100%)', borderBottom: '1px solid #BFD0E5', padding: '0.55rem 0.8rem', fontSize: '1rem', fontWeight: '700', color: '#1E3A8A' }}>
              Supplier Margin
            </div>
            <div style={{ overflowX: 'auto', overflowY: supplierMarginCompactView ? 'auto' : 'visible', maxHeight: supplierMarginCompactView ? '380px' : 'none' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.88rem' }}>
                <colgroup>
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '8%' }} />
                </colgroup>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #D9E2EC' }}>
                    <th style={{ position: 'sticky', top: 0, zIndex: 2, background: '#F3F7FC', borderRight: '1px solid #DEE7F2', padding: '0.46rem 0.68rem', textAlign: 'left', color: '#111827', fontSize: '0.8rem', letterSpacing: '0.02em', fontWeight: '700' }}>Supplier Name</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 2, background: '#F3F7FC', borderRight: '1px solid #DEE7F2', padding: '0.46rem 0.68rem', textAlign: 'right', color: '#111827', fontSize: '0.8rem', letterSpacing: '0.02em', fontWeight: '700', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>Gold Position</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 2, background: '#F3F7FC', borderRight: '1px solid #DEE7F2', padding: '0.46rem 0.68rem', textAlign: 'right', color: '#111827', fontSize: '0.8rem', letterSpacing: '0.02em', fontWeight: '700', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>Silver Position</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 2, background: '#F3F7FC', borderRight: '1px solid #DEE7F2', padding: '0.46rem 0.68rem', textAlign: 'right', color: '#111827', fontSize: '0.8rem', letterSpacing: '0.02em', fontWeight: '700', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>Equity</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 2, background: '#F3F7FC', borderRight: '1px solid #DEE7F2', padding: '0.46rem 0.68rem', textAlign: 'right', color: '#111827', fontSize: '0.8rem', letterSpacing: '0.02em', fontWeight: '700', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>Margin</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 2, background: '#F3F7FC', borderRight: '1px solid #DEE7F2', padding: '0.46rem 0.68rem', textAlign: 'right', color: '#111827', fontSize: '0.8rem', letterSpacing: '0.02em', fontWeight: '700', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>Excess</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 2, background: '#F3F7FC', borderRight: '1px solid #DEE7F2', padding: '0.46rem 0.68rem', textAlign: 'right', color: '#111827', fontSize: '0.8rem', letterSpacing: '0.02em', fontWeight: '700' }}>Status</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 2, background: '#F3F7FC', padding: '0.46rem 0.68rem', textAlign: 'right', color: '#111827', fontSize: '0.8rem', letterSpacing: '0.02em', fontWeight: '700', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierMarginRows.map((row, index) => {
                    const isNegative = row.status === 'NEGATIVE'
                    const valueColor = isNegative ? '#DC2626' : '#1D4ED8'
                    const excessColor = Number(row.excess || 0) < 0 ? '#DC2626' : '#1D4ED8'
                    return (
                      <tr
                        key={row.id || index}
                        onClick={(event) => handleSupplierMarginRowContextMenu(event, row)}
                        onContextMenu={(event) => handleSupplierMarginRowContextMenu(event, row)}
                        title="Click or right click to open details submenu"
                        style={{ borderBottom: '1px solid #EEF2F7', background: index % 2 === 0 ? '#FFFFFF' : '#FCFDFF', height: '30px', cursor: 'context-menu' }}
                      >
                        <td style={{ borderRight: '1px solid #EEF3F9', padding: '0.34rem 0.68rem', verticalAlign: 'middle', color: valueColor, fontWeight: '600', fontSize: '0.85rem', lineHeight: 1.08, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.supplierName}</td>
                        <td style={{ borderRight: '1px solid #EEF3F9', padding: '0.34rem 0.68rem', verticalAlign: 'middle', textAlign: 'right', color: Number(row.goldPosition || 0) < 0 ? '#DC2626' : '#1D4ED8', fontWeight: '700', fontSize: '0.84rem', lineHeight: 1.08, fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginPosition(row.goldPosition)}</td>
                        <td style={{ borderRight: '1px solid #EEF3F9', padding: '0.34rem 0.68rem', verticalAlign: 'middle', textAlign: 'right', color: Number(row.silverPosition || 0) < 0 ? '#DC2626' : '#1D4ED8', fontWeight: '700', fontSize: '0.84rem', lineHeight: 1.08, fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginPosition(row.silverPosition)}</td>
                        <td style={{ borderRight: '1px solid #EEF3F9', padding: '0.34rem 0.68rem', verticalAlign: 'middle', textAlign: 'right', color: valueColor, fontWeight: '700', fontSize: '0.84rem', lineHeight: 1.08, fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginEquity(row)}</td>
                        <td style={{ borderRight: '1px solid #EEF3F9', padding: '0.34rem 0.68rem', verticalAlign: 'middle', textAlign: 'right', color: '#1D4ED8', fontWeight: '700', fontSize: '0.84rem', lineHeight: 1.08, fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginAmount(row.marginAmount)}</td>
                        <td style={{ borderRight: '1px solid #EEF3F9', padding: '0.34rem 0.68rem', verticalAlign: 'middle', textAlign: 'right', color: excessColor, fontWeight: '700', fontSize: '0.84rem', lineHeight: 1.08, fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginEquity({ equity: row.excess })}</td>
                        <td style={{ borderRight: '1px solid #EEF3F9', padding: '0.34rem 0.68rem', verticalAlign: 'middle', textAlign: 'right', color: valueColor, fontWeight: '700', fontSize: '0.8rem', letterSpacing: '0.035em', lineHeight: 1.08 }}>{row.status}</td>
                        <td style={{ padding: '0.34rem 0.68rem', verticalAlign: 'middle', textAlign: 'right', color: valueColor, fontWeight: '700', fontSize: '0.84rem', lineHeight: 1.08, fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginPercent(row.marginPercent)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {supplierMarginContextMenu.open && supplierMarginContextMenu.row && (
            <div
              onClick={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.preventDefault()}
              style={{
                position: 'fixed',
                top: `${supplierMarginContextMenu.y}px`,
                left: `${supplierMarginContextMenu.x}px`,
                width: '292px',
                background: '#FDFEFE',
                border: '1px solid #9DB5D5',
                boxShadow: '0 10px 24px rgba(15, 23, 42, 0.2)',
                zIndex: 2000,
                borderRadius: '0.2rem',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '0.35rem 0.5rem', borderBottom: '1px solid #D7E3F3', background: '#E7EFFA', color: '#15407E', fontSize: '0.76rem', fontWeight: '700', letterSpacing: '0.03em' }}>
                SUPPLIER MARGIN SUB MENU
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '132px 1fr', fontSize: '0.78rem' }}>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', borderRight: '1px solid #E8EEF7', color: '#1E3A8A', fontWeight: '700' }}>Account Code</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', color: '#111827' }}>{supplierMarginContextMenu.row.accountCode || '-'}</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', borderRight: '1px solid #E8EEF7', color: '#1E3A8A', fontWeight: '700' }}>Description</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{supplierMarginContextMenu.row.description || '-'}</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', borderRight: '1px solid #E8EEF7', color: '#1E3A8A', fontWeight: '700' }}>Gold Position</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', color: '#111827', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginPosition(supplierMarginContextMenu.row.goldPosition)}</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', borderRight: '1px solid #E8EEF7', color: '#1E3A8A', fontWeight: '700' }}>Silver Position</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', color: '#111827', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginPosition(supplierMarginContextMenu.row.silverPosition)}</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', borderRight: '1px solid #E8EEF7', color: '#1E3A8A', fontWeight: '700' }}>Excess/Short</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', color: '#111827', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginExcessShort(supplierMarginContextMenu.row)}</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', borderRight: '1px solid #E8EEF7', color: '#1E3A8A', fontWeight: '700' }}>Margin</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', color: '#111827', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginAmount(supplierMarginContextMenu.row.marginAmount)}</div>
                <div style={{ padding: '0.34rem 0.52rem', borderRight: '1px solid #E8EEF7', color: '#1E3A8A', fontWeight: '700' }}>Margin %</div>
                <div style={{ padding: '0.34rem 0.52rem', color: '#111827', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginPercent(supplierMarginContextMenu.row.marginPercent)}</div>
              </div>
            </div>
          )}
          <div style={{ marginTop: '0.75rem', color: C.inkSoft, fontSize: '0.82rem' }}>
            Equity shows signed exposure: positive values are favorable, negative values are payable.
          </div>
          {supplierMarginRows.length === 0 && <p style={{ color: C.inkSoft, marginTop: '1rem', textAlign: 'center' }}>No suppliers available for margin view.</p>}
        </div>
      )}
      <ERPFixingRegisterTab
        activeTab={activeTab}
        C={C}
        setActiveTab={setActiveTab}
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
        handleEditJv={handleEditJv}
        handleEditLedger={handleEditLedger}
        handleReconcileLedger={handleReconcileLedger}
        handleReverseLedger={handleReverseLedger}
        isFinance={isFinance}
        handleRepairJvFxPreview={handleRepairJvFxPreview}
        handleRepairJvFxApply={handleRepairJvFxApply}
      />
      {/* ACCOUNT MAPPINGS TAB */}
      {activeTab === 'mappings' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
            <h3 style={{ marginBottom: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Account Mappings</h3>
            {canManageAccounts && (
              <button
                onClick={() => setShowMappingForm(!showMappingForm)}
                style={{
                  padding: '0.5rem 1rem',
                  background: C.s1,
                  color: C.t1,
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                + Add Mapping
              </button>
            )}
          </div>
          <p style={{ color: C.inkSoft, marginBottom: '1rem', fontSize: '0.875rem' }}>
            📌 Auto-map accounts for transactions. When a user selects a transaction type, the system auto-fills debit and credit accounts.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 320px) auto', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
            <select
              value={mappingFilters.department}
              onChange={(e) => setMappingFilters((prev) => ({ ...prev, department: e.target.value }))}
              style={{ display: 'block', width: '100%', padding: '0.6rem 0.75rem', background: '#F9FAFB', border: '1px solid #D1D5DB', color: C.ink, borderRadius: '0.5rem' }}
            >
              <option value="">All departments</option>
              {LEDGER_DEPARTMENTS.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
            <div style={{ color: C.inkSoft, fontSize: '0.82rem', fontWeight: '700' }}>Filter scoped mappings by department</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <span style={{ padding: '0.3rem 0.55rem', borderRadius: '999px', background: '#EEF2FF', color: '#3730A3', fontSize: '0.76rem', fontWeight: '700' }}>Total: {Number(mappingSummary.total || 0).toLocaleString()}</span>
            <span style={{ padding: '0.3rem 0.55rem', borderRadius: '999px', background: '#F3F4F6', color: '#374151', fontSize: '0.76rem', fontWeight: '700' }}>Shared: {Number(mappingSummary.shared || 0).toLocaleString()}</span>
            {Object.entries(mappingSummary.byDepartment || {})
              .sort((left, right) => {
                const countDifference = Number(right[1] || 0) - Number(left[1] || 0)
                if (countDifference !== 0) return countDifference
                return String(left[0] || '').localeCompare(String(right[0] || ''))
              })
              .map(([department, count]) => (
              <span key={department} style={{ ...getDepartmentBadgeStyle(department), padding: '0.3rem 0.55rem', borderRadius: '999px', fontSize: '0.76rem', fontWeight: '700', textTransform: 'capitalize' }}>
                {department}: {Number(count || 0).toLocaleString()}
              </span>
            ))}
          </div>
          {showMappingForm && (
            <form onSubmit={handleCreateMapping} style={{ background: C.p1, padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
              <input
                placeholder="Mapping Type"
                value={mappingForm.mappingType}
                onChange={(e) => setMappingForm({ ...mappingForm, mappingType: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }}
              />
              <select
                value={mappingForm.debitAccountId}
                onChange={(e) => setMappingForm({ ...mappingForm, debitAccountId: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }}
              >
                <option value="">Select Debit Account</option>
                {accounts.map((account) => (
                  <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>
                ))}
              </select>
              <select
                value={mappingForm.creditAccountId}
                onChange={(e) => setMappingForm({ ...mappingForm, creditAccountId: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }}
              >
                <option value="">Select Credit Account</option>
                {accounts.map((account) => (
                  <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>
                ))}
              </select>
              <select
                value={mappingForm.department}
                onChange={(e) => setMappingForm({ ...mappingForm, department: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }}
              >
                <option value="">Shared / All Departments</option>
                {LEDGER_DEPARTMENTS.map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>
              <input
                placeholder="Description"
                value={mappingForm.description}
                onChange={(e) => setMappingForm({ ...mappingForm, description: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }}
              />
              <button type="submit" disabled={saving} style={{ padding: '0.5rem 1rem', background: C.s1, color: '#FFFFFF', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', marginRight: '0.5rem' }}>
                {saving ? 'Saving...' : 'Create Mapping'}
              </button>
              <button type="button" onClick={() => setShowMappingForm(false)} style={{ padding: '0.5rem 1rem', background: C.p1, color: C.t2, border: `1px solid ${C.t2}`, borderRadius: '0.375rem', cursor: 'pointer' }}>
                Cancel
              </button>
            </form>
          )}
          <div style={{ overflowX: 'auto', background: C.p1, borderRadius: '0.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.p2}` }}>
                  <th onClick={() => setSorting({...sorting, mappings: {by: 'type', asc: !sorting.mappings.asc}})} style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600', cursor: 'pointer', background: sorting.mappings.by === 'type' ? C.p2 : 'transparent' }}>Type {sorting.mappings.by === 'type' && (sorting.mappings.asc ? '▲' : '▼')}</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Debit Account</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Credit Account</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Department</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: C.t1, fontWeight: '600' }}>Usage</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: C.t1, fontWeight: '600' }}>Active</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappings
                  .sort((a, b) => {
                    if (sorting.mappings.by === 'type') {
                      return sorting.mappings.asc ? a.mappingType.localeCompare(b.mappingType) : b.mappingType.localeCompare(a.mappingType)
                    }
                    return 0
                  })
                  .slice((pagination.mappings - 1) * ITEMS_PER_PAGE, pagination.mappings * ITEMS_PER_PAGE)
                  .map((m) => (
                    <tr key={m._id} style={{ borderBottom: `1px solid ${C.p2}` }}>
                      <td style={{ padding: '0.75rem', color: C.t1, fontWeight: '600' }}>{m.mappingType}</td>
                      <td style={{ padding: '0.75rem', color: C.t2 }}>{m.debitAccountId?.accountCode} - {m.debitAccountId?.accountName}</td>
                      <td style={{ padding: '0.75rem', color: C.t2 }}>{m.creditAccountId?.accountCode} - {m.creditAccountId?.accountName}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ ...getDepartmentBadgeStyle(m.department), padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.74rem', fontWeight: '700', textTransform: 'capitalize' }}>
                          {m.department || 'shared'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', color: m.usageCount > 0 ? C.s1 : C.t3, fontWeight: '600' }}>{m.usageCount || 0}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <input type="checkbox" checked={m.isActive !== false} onChange={async () => {
                          try {
                            await erpAccountingAPI.updateMapping(token, m._id, {isActive: m.isActive === false})
                            await loadMappings()
                            showNotification(m.isActive === false ? '✅ Mapping activated' : '✅ Mapping deactivated')
                          } catch (e) {
                            setError(e.response?.data?.message || 'Failed to toggle mapping')
                          }
                        }} style={{cursor: 'pointer'}} />
                      </td>
                      <td style={{ padding: '0.75rem', color: C.t2 }}>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <button onClick={() => setTestMapping(m) || setShowMappingTest(true)} title="Preview" style={{ padding: '0.35rem 0.5rem', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.75rem' }}>Test</button>
                          <button onClick={() => handleEditMapping(m)} style={{ padding: '0.35rem 0.5rem', background: '#0F766E', color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.75rem' }}>Edit</button>
                          <button onClick={() => handleDeleteMapping(m)} style={{ padding: '0.35rem 0.5rem', background: C.danger, color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.75rem' }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {/* Pagination for Mappings */}
          {Math.ceil(mappings.length / ITEMS_PER_PAGE) > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button onClick={() => setPagination({...pagination, mappings: Math.max(1, pagination.mappings - 1)})} disabled={pagination.mappings === 1} style={{padding: '0.4rem 0.8rem', background: pagination.mappings === 1 ? '#D1D5DB' : C.s1, color: '#fff', border: 'none', cursor: pagination.mappings === 1 ? 'default' : 'pointer', borderRadius: '0.35rem'}}>← Prev</button>
              {Array.from({length: Math.ceil(mappings.length / ITEMS_PER_PAGE)}, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPagination({...pagination, mappings: p})} style={{padding: '0.4rem 0.6rem', background: p === pagination.mappings ? C.s1 : '#E5E7EB', color: p === pagination.mappings ? '#fff' : C.ink, border: 'none', cursor: 'pointer', borderRadius: '0.35rem', fontWeight: p === pagination.mappings ? '600' : '400'}}>{p}</button>
              ))}
              <button onClick={() => setPagination({...pagination, mappings: Math.min(Math.ceil(mappings.length / ITEMS_PER_PAGE), pagination.mappings + 1)})} disabled={pagination.mappings === Math.ceil(mappings.length / ITEMS_PER_PAGE)} style={{padding: '0.4rem 0.8rem', background: pagination.mappings === Math.ceil(mappings.length / ITEMS_PER_PAGE) ? '#D1D5DB' : C.s1, color: '#fff', border: 'none', cursor: pagination.mappings === Math.ceil(mappings.length / ITEMS_PER_PAGE) ? 'default' : 'pointer', borderRadius: '0.35rem'}}>Next →</button>
            </div>
          )}
          {mappings.length === 0 && <p style={{ color: C.inkSoft, marginTop: '1rem', textAlign: 'center' }}>No mappings configured yet.</p>}
        </div>
      )}
      {/* ACCOUNT SUMMARY TAB */}
      <ERPEnquiryTabContainer activeTab={activeTab}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ marginBottom: '0.35rem', color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Account Summary</h3>
              <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.9rem' }}>Search any chart-of-account code to view balances, account details, and exportable summary details.</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ padding: '0.4rem 0.7rem', borderRadius: '999px', background: '#ECFDF5', color: '#065F46', fontSize: '0.78rem', fontWeight: '700' }}>{isSuperAdmin ? 'Super Admin' : isFinance ? 'Finance' : 'Department Head'}</span>
              <span style={{ padding: '0.4rem 0.7rem', borderRadius: '999px', background: '#EFF6FF', color: '#1D4ED8', fontSize: '0.78rem', fontWeight: '700' }}>Role Based</span>
            </div>
          </div>
          {!canViewBalanceEnquiry ? (
            <div style={{ ...ERP_EMPTY_CARD_STYLE, borderStyle: 'solid', background: '#FEF2F2', color: '#991B1B' }}>Account summary access restricted. Ask an admin to enable the Account Summary ERP permission for this user.</div>
          ) : (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <form onSubmit={handleAccountEnquiry} style={{ background: '#FAFAF7', border: '1px solid #D6D3C4', borderRadius: '0.75rem', padding: '1rem', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.65)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                    <p style={{ margin: 0, color: '#3F4B2E', fontWeight: '800', letterSpacing: '0.02em' }}>Account Lookup</p>
                    <span style={{ fontSize: '0.78rem', color: '#6B7280' }}>Type account code</span>
                  </div>
                  <input
                    placeholder="Enter Account Number (e.g. 1000)"
                    value={accountEnquiryCode}
                    onChange={(e) => {
                      setAccountEnquiryCode(e.target.value)
                      setEnquiryStatus({ type: '', message: '' })
                    }}
                    style={{ display: 'block', width: '100%', padding: '0.7rem 0.8rem', marginBottom: '0.75rem', background: '#FFFFFF', border: '1px solid #B8BEA0', color: C.ink, borderRadius: '0.5rem' }}
                  />
                  {filteredGroupedSummaryAccounts.length > 0 && (
                    <div style={{ marginTop: '-0.35rem', marginBottom: '0.75rem', border: '1px solid #D6D3C4', borderRadius: '0.6rem', background: '#FFFFFF', maxHeight: '300px', overflowY: 'auto', boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)' }}>
                      {filteredGroupedSummaryAccounts.map((group) => (
                        <div key={group.type}>
                          <div style={{ position: 'sticky', top: 0, zIndex: 1, padding: '0.45rem 0.75rem', background: '#F5F7F0', borderBottom: '1px solid #E5E7EB', color: '#3F4B2E', fontSize: '0.76rem', fontWeight: '800', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            {group.type}
                          </div>
                          {group.accounts.map((account) => (
                            <button
                              key={account._id}
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault()
                                setAccountEnquiryCode(account.accountCode)
                                setEnquiryStatus({ type: '', message: '' })
                                fetchAccountEnquiryByCode(account.accountCode)
                              }}
                              style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.65rem 0.75rem', border: 'none', borderBottom: '1px solid #F3F4F6', background: '#FFFFFF', color: C.ink, cursor: 'pointer', textAlign: 'left' }}
                            >
                              <span style={{ fontWeight: '800', minWidth: '56px', color: '#111827' }}>{account.accountCode}</span>
                              <span style={{ flex: 1, color: '#4B5563', fontSize: '0.86rem' }}>{account.accountName}</span>
                              <span style={{ color: '#6B7280', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{account.accountType}</span>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button type="submit" disabled={enquiryLoading} style={{ padding: '0.6rem 1rem', background: 'var(--purple)', color: '#FFFFFF', border: 'none', borderRadius: '0.45rem', cursor: 'pointer', fontWeight: '700' }}>
                      {enquiryLoading ? 'Loading...' : 'Load Summary'}
                    </button>
                    <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>Live from ERP accounting balances</span>
                  </div>
                  {enquiryStatus.message && (
                    <p style={{ marginTop: '0.6rem', marginBottom: 0, color: enquiryStatus.type === 'success' ? '#047857' : C.danger, fontWeight: '600', fontSize: '0.85rem' }}>
                      {enquiryStatus.message}
                    </p>
                  )}
                  {summaryAccountsLoading && (
                    <p style={{ margin: '0.7rem 0 0', color: '#6B7280', fontSize: '0.82rem', fontWeight: '600' }}>
                      Loading account list…
                    </p>
                  )}
                  {!summaryAccountsLoading && !summaryAccounts.length && (
                    <p style={{ margin: '0.7rem 0 0', color: '#92400E', fontSize: '0.82rem', fontWeight: '600' }}>
                      No accounts available for your role. Department heads only see mapped accounts in Account Summary.
                    </p>
                  )}
                  <div style={{ marginTop: '0.9rem', paddingTop: '0.85rem', borderTop: '1px solid #E5E7EB' }}>
                    <p style={{ margin: '0 0 0.5rem', color: '#6B7280', fontWeight: '700', fontSize: '0.78rem' }}>Quick Accounts</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                      {summaryAccounts
                        .slice()
                        .sort((a, b) => a.accountCode.localeCompare(b.accountCode))
                        .slice(0, 8)
                        .map((account) => (
                          <button
                            key={account._id}
                            type="button"
                            onClick={() => {
                              setAccountEnquiryCode(account.accountCode)
                              fetchAccountEnquiryByCode(account.accountCode)
                            }}
                            style={{ padding: '0.35rem 0.6rem', borderRadius: '999px', border: '1px solid #C7D2FE', background: '#EEF2FF', color: '#3730A3', cursor: 'pointer', fontSize: '0.76rem', fontWeight: '700' }}
                            title={account.accountName}
                          >
                            {account.accountCode}
                          </button>
                        ))}
                    </div>
                  </div>
                </form>
              </div>
              {enquiryHistory.length > 0 && (
                <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem', marginBottom: '1rem' }}>
                  <p style={{ margin: 0, color: C.ink, fontWeight: '700', marginBottom: '0.55rem' }}>Recent Account Summary History</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {enquiryHistory.map((item) => (
                      <button
                        key={`${item.accountCode}-${item.searchedAt}`}
                        type="button"
                        onClick={() => fetchAccountEnquiryByCode(item.accountCode)}
                        style={{ padding: '0.35rem 0.6rem', borderRadius: '0.4rem', border: '1px solid #D1D5DB', background: '#F9FAFB', color: C.ink, cursor: 'pointer', fontSize: '0.8rem' }}
                        title={item.accountName || item.accountCode}
                      >
                        {item.accountCode}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ERPEnquiryTabContainer>
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
        loading={loading}
      />
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
        loading={loading}
        voucherSource={voucherSource}
        setVoucherSource={setVoucherSource}
        modalBackdropStyle={ERP_MODAL_BACKDROP_STYLE}
        modalCardStyle={ERP_MODAL_CARD_STYLE}
        voucherSourceLoading={voucherSourceLoading}
        handleOpenVoucherSource={handleOpenVoucherSource}
        handleJumpToTransaction={handleJumpToTransaction}
      />
      {/* VENDORS TAB */}
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
      {/* INVENTORY TAB */}
      <ERPInventoryTab
        activeTab={activeTab}
        C={C}
        modalInputStyle={ERP_MODAL_INPUT_STYLE}
        isSuperAdmin={isSuperAdmin}
        isFinance={isFinance}
        saving={saving}
        token={token}
        tenantKey={inventoryTenantKey}
        liveMetalSnapshot={liveMetalSnapshot}
        liveMetalError={liveMetalError}
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
      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
            <h3 style={{ marginBottom: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Settings</h3>
          </div>
          <div style={{ marginBottom: '1.25rem', background: C.p1, padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${C.p2}` }}>
            <h4 style={{ color: C.ink, marginTop: 0, marginBottom: '0.4rem', fontWeight: '700' }}>Logo Settings</h4>
            <p style={{ marginTop: 0, marginBottom: '0.75rem', color: C.inkSoft, fontSize: '0.82rem' }}>
              Upload one company logo here. It is used automatically by vouchers, statements, report printouts, and PDF exports for the active tenant.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.2fr) repeat(3, minmax(130px, 0.7fr)) auto', gap: '0.65rem', alignItems: 'center' }}>
              <select value={selectedBrandingKey} onChange={(e) => handleSelectBrandingProfile(e.target.value)} style={ERP_MODAL_INPUT_STYLE}>
                {brandingProfiles.map((profile) => (
                  <option key={profile.key} value={profile.key}>{brandingOptionLabel(profile)}{profile.isDefault ? ' (Default)' : ''}</option>
                ))}
              </select>
              <input
                type="number"
                min="80"
                max="260"
                placeholder="Width"
                value={brandingForm.logoWidth}
                onChange={(e) => setBrandingForm((prev) => ({ ...prev, logoWidth: e.target.value }))}
                style={ERP_MODAL_INPUT_STYLE}
              />
              <input
                type="number"
                min="32"
                max="120"
                placeholder="Height"
                value={brandingForm.logoHeight}
                onChange={(e) => setBrandingForm((prev) => ({ ...prev, logoHeight: e.target.value }))}
                style={ERP_MODAL_INPUT_STYLE}
              />
              <select
                value={brandingForm.logoFit}
                onChange={(e) => setBrandingForm((prev) => ({ ...prev, logoFit: e.target.value }))}
                style={ERP_MODAL_INPUT_STYLE}
              >
                <option value="contain">Contain</option>
                <option value="cover">Cover</option>
                <option value="fill">Fill</option>
              </select>
              <label style={{ ...ERP_MODAL_INPUT_STYLE, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: 0 }}>
                Upload Logo
                <input type="file" accept={LOGO_UPLOAD_ACCEPT} onChange={(e) => handleBrandingLogoFile(e.target.files?.[0])} style={{ display: 'none' }} />
              </label>
            </div>
            <p style={{ margin: '0.45rem 0 0', color: C.inkSoft, fontSize: '0.78rem' }}>Supported logo files: PNG and SVG up to 3 MB.</p>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.8rem' }}>
              <div style={{ width: '180px', height: '64px', border: '1px dashed #D1D5DB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {brandingForm.logoUrl ? <img src={brandingForm.logoUrl} alt="Current logo preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <span style={{ color: C.inkSoft, fontSize: '0.8rem' }}>No logo</span>}
              </div>
              <button type="button" disabled={saving || !canManageAccounts} onClick={handleSaveBranding} style={{ padding: '0.5rem 1rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: canManageAccounts ? 'pointer' : 'not-allowed', opacity: canManageAccounts ? 1 : 0.65 }}>
                {saving ? 'Saving...' : 'Save Logo Settings'}
              </button>
            </div>
          </div>
          <div style={{ marginBottom: '1.25rem', background: C.p1, padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${C.p2}` }}>
            <h4 style={{ color: C.ink, marginTop: 0, marginBottom: '0.4rem', fontWeight: '700' }}>Inventory Stock Code Format</h4>
            <p style={{ marginTop: 0, marginBottom: '0.75rem', color: C.inkSoft, fontSize: '0.82rem' }}>
              Configure auto stock-code format used in ERP Inventory mapping.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
              <select
                value={inventoryStockCodeSettings.format}
                onChange={(e) => setInventoryStockCodeSettings((prev) => ({ ...prev, format: e.target.value }))}
                style={ERP_MODAL_INPUT_STYLE}
              >
                <option value="metal-purity">GOLD-9999</option>
                <option value="prefix-metal-purity">RM-GOLD-9999</option>
              </select>
              <input
                placeholder="Prefix"
                value={inventoryStockCodeSettings.prefix}
                onChange={(e) => setInventoryStockCodeSettings((prev) => ({ ...prev, prefix: e.target.value.toUpperCase() }))}
                disabled={inventoryStockCodeSettings.format !== 'prefix-metal-purity'}
                style={inventoryStockCodeSettings.format !== 'prefix-metal-purity' ? { ...ERP_MODAL_INPUT_STYLE, background: '#F8FAFC', color: C.inkSoft } : ERP_MODAL_INPUT_STYLE}
              />
            </div>
            <p style={{ margin: '0.6rem 0 0', color: C.inkSoft, fontSize: '0.8rem' }}>
              Preview: {buildAutoStockCode({ mainStock: 'gold', customMainStock: '', metalType: 'gold', purity: '999.9' }, inventoryStockCodeSettings)}
            </p>
          </div>
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ color: C.ink, marginBottom: '1rem', fontWeight: '700' }}>Report Branding</h4>
            <form onSubmit={handleSaveBranding} style={{ background: C.p1, padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${C.p2}`, marginBottom: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.2fr) repeat(2, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <select value={selectedBrandingKey} onChange={(e) => handleSelectBrandingProfile(e.target.value)} style={ERP_MODAL_INPUT_STYLE}>
                  {brandingProfiles.map((profile) => (
                    <option key={profile.key} value={profile.key}>{brandingOptionLabel(profile)}{profile.isDefault ? ' (Default)' : ''}</option>
                  ))}
                </select>
                <input
                  placeholder="Profile Key"
                  value={brandingForm.key}
                  onChange={(e) => {
                    const nextKey = normalizeBrandingKey(e.target.value)
                    setSelectedBrandingKey(nextKey)
                    setBrandingForm((prev) => ({ ...prev, key: nextKey }))
                  }}
                  style={ERP_MODAL_INPUT_STYLE}
                />
                <label style={{ ...ERP_MODAL_INPUT_STYLE, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 0 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(brandingForm.isDefault)}
                    onChange={(e) => setBrandingForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
                  />
                  Set as default entity
                </label>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <button type="button" onClick={handleCreateBrandingDraft} style={{ padding: '0.45rem 0.85rem', background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '600' }}>
                  + New Entity Profile
                </button>
                <span style={{ color: C.inkSoft, fontSize: '0.82rem', alignSelf: 'center' }}>Each profile can represent a separate legal entity, branch, or reporting unit.</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <input
                  placeholder="Entity Name"
                  value={brandingForm.entityName}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, entityName: e.target.value }))}
                  style={ERP_MODAL_INPUT_STYLE}
                />
                <input
                  placeholder="Branch / Unit"
                  value={brandingForm.branchName}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, branchName: e.target.value }))}
                  style={ERP_MODAL_INPUT_STYLE}
                />
                <input
                  placeholder="Company Name"
                  value={brandingForm.companyName}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, companyName: e.target.value }))}
                  style={ERP_MODAL_INPUT_STYLE}
                />
                <input
                  placeholder="Legal Name"
                  value={brandingForm.legalName}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, legalName: e.target.value }))}
                  style={ERP_MODAL_INPUT_STYLE}
                />
                <input
                  placeholder="Company Address"
                  value={brandingForm.address}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, address: e.target.value }))}
                  style={ERP_MODAL_INPUT_STYLE}
                />
                <input
                  placeholder="Company Phone"
                  value={brandingForm.phone}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, phone: e.target.value }))}
                  style={ERP_MODAL_INPUT_STYLE}
                />
                <input
                  placeholder="TRN / Tax Registration"
                  value={brandingForm.trn}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, trn: e.target.value }))}
                  style={ERP_MODAL_INPUT_STYLE}
                />
                <input
                  placeholder="Report Subtitle"
                  value={brandingForm.reportSubtitle}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, reportSubtitle: e.target.value }))}
                  style={ERP_MODAL_INPUT_STYLE}
                />
                <input
                  placeholder="Footer Text"
                  value={brandingForm.reportFooter}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, reportFooter: e.target.value }))}
                  style={ERP_MODAL_INPUT_STYLE}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem', alignItems: 'start', marginBottom: '0.75rem' }}>
                <input
                  placeholder="Logo URL or paste data URL"
                  value={brandingForm.logoUrl}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, logoUrl: e.target.value }))}
                  style={ERP_MODAL_INPUT_STYLE}
                />
                <label style={{ ...ERP_MODAL_INPUT_STYLE, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: 0 }}>
                  Upload Logo
                  <input
                    type="file"
                    accept={LOGO_UPLOAD_ACCEPT}
                    onChange={(e) => handleBrandingLogoFile(e.target.files?.[0])}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
              <p style={{ margin: '-0.35rem 0 0.75rem', color: C.inkSoft, fontSize: '0.78rem' }}>Supported logo files: PNG and SVG up to 3 MB.</p>
              {brandingForm.logoUrl && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ padding: '0.75rem', border: `1px dashed ${C.p2}`, borderRadius: '0.5rem', background: '#FFFDF7' }}>
                    <p style={{ marginTop: 0, marginBottom: '0.5rem', color: C.ink, fontWeight: '600' }}>Source Logo</p>
                    <img src={brandingForm.logoUrl} alt="Brand logo source" style={{ maxHeight: '72px', maxWidth: '220px', objectFit: 'contain' }} />
                  </div>
                  <div style={{ padding: '0.75rem', border: `1px dashed ${C.p2}`, borderRadius: '0.5rem', background: '#FFFDF7' }}>
                    <p style={{ marginTop: 0, marginBottom: '0.5rem', color: C.ink, fontWeight: '600' }}>Header Crop Result</p>
                    <div style={{ width: `${clampBrandingDimension(brandingForm.logoWidth, DEFAULT_BRANDING.logoWidth, 80, 260)}px`, height: `${clampBrandingDimension(brandingForm.logoHeight, DEFAULT_BRANDING.logoHeight, 32, 120)}px`, border: '1px solid #D1D5DB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {brandingPreviewLogo ? <img src={brandingPreviewLogo} alt="Brand logo processed preview" style={{ width: '100%', height: '100%', objectFit: 'fill' }} /> : null}
                    </div>
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                <input
                  type="number"
                  min="80"
                  max="260"
                  placeholder="Logo Width"
                  value={brandingForm.logoWidth}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, logoWidth: e.target.value }))}
                  style={ERP_MODAL_INPUT_STYLE}
                />
                <input
                  type="number"
                  min="32"
                  max="120"
                  placeholder="Logo Height"
                  value={brandingForm.logoHeight}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, logoHeight: e.target.value }))}
                  style={ERP_MODAL_INPUT_STYLE}
                />
                <select
                  value={brandingForm.logoFit}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, logoFit: e.target.value }))}
                  style={ERP_MODAL_INPUT_STYLE}
                >
                  <option value="contain">Contain</option>
                  <option value="cover">Cover / Crop</option>
                  <option value="fill">Fill / Stretch</option>
                </select>
              </div>
              <div style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '0.75rem', border: `1px solid ${C.p2}`, background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)' }}>
                <p style={{ marginTop: 0, marginBottom: '0.75rem', color: C.ink, fontWeight: '700' }}>Company Profile Preview</p>
                <div style={{ height: '10px', background: 'var(--grad-brand)', borderRadius: '999px', marginBottom: '14px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', borderBottom: '2px solid #111827', paddingBottom: '0.9rem', marginBottom: '0.9rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: '260px', flex: '1 1 320px' }}>
                    <p style={{ margin: '0 0 0.35rem', color: '#065F46', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>{brandingPreview.companyName || DEFAULT_BRANDING.companyName}</p>
                    <p style={{ margin: '0 0 0.35rem', color: '#111827', fontSize: '1.3rem', fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 700 }}>ERP Financial Statement</p>
                    <p style={{ margin: '0 0 0.2rem', color: '#4B5563', fontSize: '0.8rem' }}>{brandingPreview.entityName || DEFAULT_BRANDING.entityName}{brandingPreview.branchName ? ` / ${brandingPreview.branchName}` : ''}</p>
                    {brandingPreview.legalName ? <p style={{ margin: '0 0 0.2rem', color: '#4B5563', fontSize: '0.8rem' }}>{brandingPreview.legalName}</p> : null}
                    {brandingPreview.address ? <p style={{ margin: '0 0 0.2rem', color: '#4B5563', fontSize: '0.8rem', whiteSpace: 'pre-line' }}>{brandingPreview.address}</p> : null}
                    {(brandingPreview.phone || brandingPreview.trn) ? <p style={{ margin: '0 0 0.2rem', color: '#4B5563', fontSize: '0.8rem' }}>{`${brandingPreview.phone || ''}${brandingPreview.phone && brandingPreview.trn ? ' | ' : ''}${brandingPreview.trn ? `TRN: ${brandingPreview.trn}` : ''}`}</p> : null}
                    <p style={{ margin: '0 0 0.2rem', color: '#4B5563', fontSize: '0.8rem' }}>{brandingPreview.reportSubtitle || DEFAULT_BRANDING.reportSubtitle} | Prepared for statutory / CA-style review</p>
                    <p style={{ margin: 0, color: '#4B5563', fontSize: '0.8rem' }}>Period: 01 Apr 2026 to 30 Apr 2026</p>
                  </div>
                  {brandingPreviewLogo ? (
                    <div style={{ width: `${clampBrandingDimension(brandingPreview.logoWidth, DEFAULT_BRANDING.logoWidth, 80, 260)}px`, height: `${clampBrandingDimension(brandingPreview.logoHeight, DEFAULT_BRANDING.logoHeight, 32, 120)}px`, borderRadius: '0.35rem', overflow: 'hidden', background: '#FFFFFF', border: '1px solid #E5E7EB', flex: '0 0 auto' }}>
                      <img src={brandingPreviewLogo} alt="Export header preview logo" style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }} />
                    </div>
                  ) : null}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '0.9rem' }}>
                  <div style={{ paddingTop: '0.85rem', borderTop: '1px solid #475569', color: '#374151', fontSize: '0.78rem' }}>{brandingPreview.preparedByTitle || DEFAULT_BRANDING.preparedByTitle}<br />{brandingPreview.preparedByName || DEFAULT_BRANDING.preparedByName}</div>
                  <div style={{ paddingTop: '0.85rem', borderTop: '1px solid #475569', color: '#374151', fontSize: '0.78rem' }}>{brandingPreview.reviewedByTitle || DEFAULT_BRANDING.reviewedByTitle}<br />{brandingPreview.reviewedByName || DEFAULT_BRANDING.reviewedByName}</div>
                  <div style={{ paddingTop: '0.85rem', borderTop: '1px solid #475569', color: '#374151', fontSize: '0.78rem' }}>{brandingPreview.approvedByTitle || DEFAULT_BRANDING.approvedByTitle}<br />{brandingPreview.approvedByName || DEFAULT_BRANDING.approvedByName}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', color: '#334155', fontSize: '0.74rem', flexWrap: 'wrap' }}>
                  <span>{brandingPreview.companyName || DEFAULT_BRANDING.companyName} Reporting Suite</span>
                  <span>{brandingPreview.reportFooter || DEFAULT_BRANDING.reportFooter}</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                <input
                  placeholder="Prepared By Title"
                  value={brandingForm.preparedByTitle}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, preparedByTitle: e.target.value }))}
                  style={ERP_MODAL_INPUT_STYLE}
                />
                <input
                  placeholder="Prepared By Name"
                  value={brandingForm.preparedByName}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, preparedByName: e.target.value }))}
                  style={ERP_MODAL_INPUT_STYLE}
                />
                <input
                  placeholder="Reviewed By Title"
                  value={brandingForm.reviewedByTitle}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, reviewedByTitle: e.target.value }))}
                  style={ERP_MODAL_INPUT_STYLE}
                />
                <input
                  placeholder="Reviewed By Name"
                  value={brandingForm.reviewedByName}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, reviewedByName: e.target.value }))}
                  style={ERP_MODAL_INPUT_STYLE}
                />
                <input
                  placeholder="Approved By Title"
                  value={brandingForm.approvedByTitle}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, approvedByTitle: e.target.value }))}
                  style={ERP_MODAL_INPUT_STYLE}
                />
                <input
                  placeholder="Approved By Name"
                  value={brandingForm.approvedByName}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, approvedByName: e.target.value }))}
                  style={ERP_MODAL_INPUT_STYLE}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="submit" disabled={saving || !canManageAccounts} style={{ padding: '0.5rem 1rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: canManageAccounts ? 'pointer' : 'not-allowed', opacity: canManageAccounts ? 1 : 0.65 }}>
                  {saving ? 'Saving...' : 'Save Branding'}
                </button>
                <button type="button" onClick={() => setBrandingForm(reportBranding)} style={{ padding: '0.5rem 1rem', background: '#fff', color: C.ink, border: `1px solid ${C.p2}`, borderRadius: '0.375rem', cursor: 'pointer' }}>
                  Reset Changes
                </button>
                <span style={{ color: C.inkSoft, fontSize: '0.82rem' }}>Use separate profiles per branch or legal entity. Uploaded logos give the most reliable PDF result.</span>
              </div>
            </form>
          </div>
          <div style={{ background: C.p1, padding: '1.5rem', borderRadius: '0.5rem', borderLeft: `4px solid ${C.s1}` }}>
            <h4 style={{ color: C.t1, marginBottom: '1rem', fontWeight: '600' }}>📋 System Information</h4>
            <ul style={{ color: C.t2, fontSize: '0.875rem', listStyle: 'none', padding: 0 }}>
              <li style={{ marginBottom: '0.5rem' }}>✓ Central Ledger System: Every transaction creates one ledger entry</li>
              <li style={{ marginBottom: '0.5rem' }}>✓ Auto Journal Logic: Debit/Credit pairs auto-populated based on mappings</li>
              <li style={{ marginBottom: '0.5rem' }}>✓ Role-Based Access: Finance and Super Admin only</li>
              <li style={{ marginBottom: '0.5rem' }}>✓ Multi-Currency: configurable base currency and exchange rates</li>
              <li style={{ marginBottom: '0.5rem' }}>✓ Reports: Trial Balance, Ledger, and Dashboard all from ledger data</li>
            </ul>
          </div>
        </div>
      )}
      {/* CURRENCIES TAB */}
      {activeTab === 'currencies' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Currency Master</h3>
              <p style={{ margin: '0.3rem 0 0', color: C.inkSoft, fontSize: '0.84rem' }}>
                {`Manage currency code master and conversion rates vs ${erpBaseCurrencyCode} for all ERP postings.`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {canManageAccounts && (
                <button
                  onClick={() => setShowCurrencyForm(!showCurrencyForm)}
                  style={{ padding: '0.5rem 1rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '600' }}
                >
                  {showCurrencyForm ? 'Close Form' : '+ Add Currency'}
                </button>
              )}
              {canManageAccounts && (
                <button
                  onClick={handleSyncCurrencyMaster}
                  disabled={saving}
                  style={{ padding: '0.5rem 1rem', background: '#0F766E', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '600' }}
                >
                  {saving ? 'Syncing...' : 'Sync USD/EUR/AED/UZS'}
                </button>
              )}
              <button
                onClick={() => setActiveTab('settings')}
                style={{ padding: '0.5rem 1rem', background: '#fff', color: C.ink, border: `1px solid ${C.p2}`, borderRadius: '0.375rem', cursor: 'pointer' }}
              >
                Back to Settings
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
              <h4 style={{ margin: 0, marginBottom: '0.45rem', color: C.ink, fontSize: '0.95rem' }}>Exchange Difference Accounts</h4>
              <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.82rem' }}>
                System auto-creates and uses <strong>Exchange Gain (4190)</strong> and <strong>Exchange Loss (5190)</strong> when posting foreign-currency payment/receipt adjustments.
              </p>
            </div>
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
              <h4 style={{ margin: 0, marginBottom: '0.45rem', color: C.ink, fontSize: '0.95rem' }}>{`Rate Direction (vs ${erpBaseCurrencyCode})`}</h4>
              <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.82rem' }}>
                Exchange rate stores the <strong>{erpBaseCurrencyCode}</strong> value of <strong>1 unit</strong> of that currency code (base units per 1 unit of FC). Example when base is USD: AED 0.2723 means 1 AED = 0.2723 USD. When base is INR: USD 83.5 means 1 USD = 83.5 INR. When adding or editing, you can instead fill <strong>1 {erpBaseCurrencyCode} = (units)</strong> — the app saves <code>1 ÷ that number</code> so the grid matches.
              </p>
            </div>
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
              <h4 style={{ margin: 0, marginBottom: '0.45rem', color: C.ink, fontSize: '0.95rem' }}>USD amount converter</h4>
              <p style={{ margin: '0 0 0.45rem', color: C.inkSoft, fontSize: '0.72rem' }}>
                {erpBaseCurrencyCode === 'USD'
                  ? 'Uses stored rates (USD per 1 unit of the target currency).'
                  : `Converts USD → ${erpBaseCurrencyCode} using the USD row, then → target using each row’s ${erpBaseCurrencyCode} per 1 unit.`}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="USD Amount"
                  value={usdConversion.usdAmount}
                  onChange={(e) => setUsdConversion((prev) => ({ ...prev, usdAmount: e.target.value }))}
                  style={ERP_MODAL_INPUT_STYLE}
                />
                <select
                  value={usdConversion.targetCode}
                  onChange={(e) => setUsdConversion((prev) => ({ ...prev, targetCode: e.target.value }))}
                  style={ERP_MODAL_INPUT_STYLE}
                >
                  {currencies.map((currency) => (
                    <option key={currency._id || currency.code} value={currency.code}>{currency.code} - {currency.name}</option>
                  ))}
                </select>
              </div>
              <p style={{ margin: '0.5rem 0 0', color: C.inkSoft, fontSize: '0.8rem' }}>
                {usdConversion.usdAmount || '0'} USD = <strong style={{ color: C.ink }}>{Number(usdToTargetAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</strong> {usdConversion.targetCode || '---'}
              </p>
              <p style={{ margin: '0.2rem 0 0', color: C.inkSoft, fontSize: '0.75rem' }}>
                1 {usdConversion.targetCode || '---'} = <strong style={{ color: C.ink }}>{Number(selectedUsdConversionRate || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}</strong> {erpBaseCurrencyCode}
              </p>
              <p style={{ margin: '0.2rem 0 0', color: C.inkSoft, fontSize: '0.72rem' }}>
                Rate used: {selectedUsdConversionRate > 0 ? selectedUsdConversionRate.toFixed(6) : 'N/A'} {erpBaseCurrencyCode} per {usdConversion.targetCode || 'unit'}
              </p>
            </div>
          </div>
          {showCurrencyForm && (
            <form onSubmit={handleCreateCurrency} style={{ background: C.p1, padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', border: `1px solid ${C.p2}` }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
                <input
                  placeholder="Currency Code"
                  value={currencyForm.code}
                  onChange={(e) => setCurrencyForm({ ...currencyForm, code: e.target.value.toUpperCase() })}
                  style={ERP_MODAL_INPUT_STYLE}
                />
                <input
                  placeholder="Currency Name"
                  value={currencyForm.name}
                  onChange={(e) => setCurrencyForm({ ...currencyForm, name: e.target.value })}
                  style={ERP_MODAL_INPUT_STYLE}
                />
                <input
                  placeholder="Symbol"
                  value={currencyForm.symbol}
                  onChange={(e) => setCurrencyForm({ ...currencyForm, symbol: e.target.value })}
                  style={ERP_MODAL_INPUT_STYLE}
                />
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="Exchange Rate"
                  value={currencyForm.exchangeRate}
                  onChange={(e) => setCurrencyForm({ ...currencyForm, exchangeRate: e.target.value, oneUsdEquals: '' })}
                  style={ERP_MODAL_INPUT_STYLE}
                  disabled={currencyForm.baseCurrency}
                />
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={`1 ${erpBaseCurrencyCode} = (units of this currency)`}
                  value={currencyForm.oneUsdEquals}
                  onChange={(e) => {
                    const v = e.target.value
                    const r = exchangeRateFromUnitsPerBase(v)
                    setCurrencyForm({
                      ...currencyForm,
                      oneUsdEquals: v,
                      exchangeRate: r !== null ? String(r) : currencyForm.exchangeRate,
                    })
                  }}
                  style={ERP_MODAL_INPUT_STYLE}
                  disabled={currencyForm.baseCurrency}
                />
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: C.ink, marginTop: '0.6rem' }}>
                <input
                  type="checkbox"
                  checked={currencyForm.baseCurrency}
                  onChange={(e) => {
                    const base = e.target.checked
                    setCurrencyForm({
                      ...currencyForm,
                      baseCurrency: base,
                      exchangeRate: base ? 1 : currencyForm.exchangeRate,
                      oneUsdEquals: base ? '' : currencyForm.oneUsdEquals,
                    })
                  }}
                />
                Set as base currency
              </label>
              <div style={{ marginTop: '0.75rem' }}>
                <button type="submit" disabled={saving} style={{ padding: '0.5rem 1rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', marginRight: '0.5rem' }}>
                  {saving ? 'Saving...' : 'Create Currency'}
                </button>
                <button type="button" onClick={() => setShowCurrencyForm(false)} style={{ padding: '0.5rem 1rem', background: '#fff', color: C.ink, border: `1px solid ${C.p2}`, borderRadius: '0.375rem', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
          <div style={{ overflowX: 'auto', background: C.p1, borderRadius: '0.5rem', border: `1px solid ${C.p2}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.p2}` }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Code</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Symbol</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Exchange Rate</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>{`1 ${erpBaseCurrencyCode} =`}</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Base</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Active</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currencies.map((c) => (
                  <tr key={c._id} style={{ borderBottom: `1px solid ${C.p2}` }}>
                    <td style={{ padding: '0.75rem', color: C.t1, fontWeight: '700' }}>{c.code}</td>
                    <td style={{ padding: '0.75rem', color: C.t2 }}>{c.name}</td>
                    <td style={{ padding: '0.75rem', color: C.t2 }}>{c.symbol || '-'}</td>
                    <td style={{ padding: '0.75rem', color: C.t2 }}>{Number(c.exchangeRate || 0).toFixed(6)}</td>
                    <td style={{ padding: '0.75rem', color: C.t2 }}>
                      {c.baseCurrency
                        ? '—'
                        : (Number(c.exchangeRate || 0) > 0
                          ? Number(1 / Number(c.exchangeRate || 1)).toLocaleString(undefined, { maximumFractionDigits: 4 })
                          : '-')}
                    </td>
                    <td style={{ padding: '0.75rem', color: c.baseCurrency ? C.s1 : C.t2 }}>{c.baseCurrency ? '✓ Base' : '-'}</td>
                    <td style={{ padding: '0.75rem', color: c.isActive ? '#065F46' : C.inkSoft }}>{c.isActive ? 'Active' : 'Inactive'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <button onClick={() => handleEditCurrency(c)} style={{ padding: '0.35rem 0.7rem', background: '#0F766E', color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => handleDeleteCurrency(c)} style={{ padding: '0.35rem 0.7rem', background: C.danger, color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer' }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {currencies.length === 0 && <p style={{ color: C.inkSoft, marginTop: '1rem', textAlign: 'center' }}>No currencies configured yet.</p>}
        </div>
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
      {/* DIRECT DEALS TAB */}
      {activeTab === 'direct-deals' && (
        <DirectDealsTab
          token={token}
          customers={customers}
          currencies={currencies}
          canManage={canManageDirectDeals}
          isSuperAdmin={isSuperAdmin}
        />
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
      {showEnquiryModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowEnquiryModal(false) }}
          style={{ position: 'fixed', inset: 0, background: enquiryBackdropColor, transition: 'background 120ms ease', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
        >
          <div style={{ background: '#fff', borderRadius: '8px', width: 'min(1100px, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 42px rgba(0,0,0,0.35)', transform: `translate(${enquiryModalOffset.x}px, ${enquiryModalOffset.y}px)` }}>
            {/* Header - Dark Green Bar */}
            <div
              onMouseDown={beginEnquiryModalDrag}
              style={{ background: '#3F4B2E', color: '#FFFFFF', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', cursor: enquiryModalDrag.active ? 'grabbing' : 'grab', userSelect: 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>Account Details — Statement of Account</span>
                {enquiryLoading && <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>(Loading…)</span>}
              </div>
              <button onClick={() => setShowEnquiryModal(false)} style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer', fontSize: '20px', padding: '0', lineHeight: 1 }}>✕</button>
            </div>
            {/* Scrollable Content Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.2rem 1.5rem' }}>
              {/* Account lookup row */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.95rem', color: '#374151', fontWeight: '600' }}>Account Number</label>
                  <div style={{ position: 'relative', width: '340px' }}>
                    <input
                      value={accountEnquiryCode}
                      onChange={(e) => {
                        setAccountEnquiryCode(e.target.value)
                        setShowEnquiryLookupMenu(true)
                        setEnquiryStatus({ type: '', message: '' })
                      }}
                      onFocus={() => setShowEnquiryLookupMenu(true)}
                      onBlur={() => {
                        window.setTimeout(() => setShowEnquiryLookupMenu(false), 120)
                      }}
                      placeholder="Type account code or pick from dropdown"
                      autoComplete="off"
                      style={{ border: '1px solid #CBD5E0', padding: '0.6rem 0.8rem', fontSize: '0.95rem', width: '100%', borderRadius: '0.5rem', background: '#FFFFFF' }}
                    />
                    {showEnquiryLookupMenu && filteredGroupedSummaryAccounts.length > 0 && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 0.35rem)', left: 0, right: 0, zIndex: 5, border: '1px solid #D6D3C4', borderRadius: '0.6rem', background: '#FFFFFF', maxHeight: '260px', overflowY: 'auto', boxShadow: '0 10px 24px rgba(15, 23, 42, 0.12)' }}>
                        {filteredGroupedSummaryAccounts.map((group) => (
                          <div key={group.type}>
                            <div style={{ position: 'sticky', top: 0, zIndex: 1, padding: '0.45rem 0.75rem', background: '#F5F7F0', borderBottom: '1px solid #E5E7EB', color: '#3F4B2E', fontSize: '0.76rem', fontWeight: '800', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                              {group.type}
                            </div>
                            {group.accounts.map((account) => (
                              <button
                                key={account._id}
                                type="button"
                                onMouseDown={(event) => {
                                  event.preventDefault()
                                  setShowEnquiryLookupMenu(false)
                                  setAccountEnquiryCode(account.accountCode)
                                  setEnquiryStatus({ type: '', message: '' })
                                  fetchAccountEnquiryByCode(account.accountCode)
                                }}
                                style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.65rem 0.75rem', border: 'none', borderBottom: '1px solid #F3F4F6', background: '#FFFFFF', color: C.ink, cursor: 'pointer', textAlign: 'left' }}
                              >
                                <span style={{ fontWeight: '800', minWidth: '56px', color: '#111827' }}>{account.accountCode}</span>
                                <span style={{ flex: 1, color: '#4B5563', fontSize: '0.86rem' }}>{account.accountName}</span>
                                <span style={{ color: '#6B7280', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{account.accountType}</span>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setShowEnquiryLookupMenu(false)
                      fetchAccountEnquiryByCode(accountEnquiryCode)
                    }}
                    disabled={enquiryLoading}
                    style={{ padding: '0.6rem 1.2rem', background: 'var(--purple)', color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: enquiryLoading ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '0.95rem', opacity: enquiryLoading ? 0.7 : 1 }}
                  >
                    {enquiryLoading ? 'Loading…' : 'Load Summary'}
                  </button>
                </div>
              </div>
              {enquiryStatus.message && !enquiryLoading && (
                <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: enquiryStatus.type === 'success' ? '#047857' : '#c0392b', fontWeight: '600' }}>{enquiryStatus.message}</p>
              )}
              {!accountEnquiryData ? (
                <div style={{ border: '1px solid #E5E7EB', borderRadius: '0.6rem', background: '#F9FAFB', padding: '1.5rem', color: '#6B7280', fontSize: '0.95rem', textAlign: 'center' }}>
                  {enquiryLoading ? '⟳ Loading account statement...' : '→ Enter account number and click Load Summary to view position'}
                </div>
              ) : (
                <>
                  {/* 2-Column Layout */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    {/* LEFT COLUMN - Account Details Box with Position Table */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                      {/* Account Details Panel */}
                      <div style={{ border: '2px solid #3F4B2E', borderRadius: '0.6rem', background: '#F5F7F0', padding: '1rem', position: 'relative' }}>
                        <div style={{ borderBottom: '1px solid #D1D5DB', paddingBottom: '0.8rem', marginBottom: '0.8rem' }}>
                          <h3 style={{ margin: '0 0 0.4rem', color: '#111827', fontWeight: '800', fontSize: '1.1rem' }}>{accountEnquiryData.account.accountName || 'Account'}</h3>
                          <p style={{ margin: 0, color: '#6B7280', fontSize: '0.9rem', lineHeight: '1.4' }}>{accountEnquiryData.account.description || accountEnquiryData.account.accountName}</p>
                          {accountEnquiryData.account.description && (
                            <p style={{ margin: '0.4rem 0 0', color: '#6B7280', fontSize: '0.85rem' }}>Code: {accountEnquiryData.account.accountCode}</p>
                          )}
                        </div>
                      </div>
                      {/* Metal position (grams) + unfixed activity */}
                      <div style={{ border: '1px solid #CBD5E0', borderRadius: '0.6rem', overflow: 'hidden', background: '#FFFFFF' }}>
                        <div style={{ background: '#3F4B2E', padding: '0.7rem 1rem', borderBottom: '1px solid #2D3620' }}>
                          <span style={{ color: '#FFFFFF', fontWeight: '700', fontSize: '0.95rem' }}>Position</span>
                          <span style={{ color: 'rgba(255,255,255,0.82)', fontSize: '0.78rem', marginLeft: '0.5rem', fontWeight: '600' }}>(pure weight, grams - includes unfixed trades and metal transfers)</span>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                              <tr style={{ background: '#E8EBE0', borderBottom: '2px solid #CBD5E0' }}>
                                <th style={{ padding: '0.7rem', textAlign: 'left', fontWeight: '700', color: '#374151' }}>Type</th>
                                <th style={{ padding: '0.7rem', textAlign: 'right', fontWeight: '700', color: '#374151' }}>Limits</th>
                                <th style={{ padding: '0.7rem', textAlign: 'right', fontWeight: '700', color: '#374151' }}>Balance</th>
                                <th style={{ padding: '0.7rem', textAlign: 'right', fontWeight: '700', color: '#374151' }}>Price</th>
                                <th style={{ padding: '0.7rem', textAlign: 'right', fontWeight: '700', color: '#374151' }}>Current Value</th>
                                <th style={{ padding: '0.7rem', textAlign: 'right', fontWeight: '700', color: '#374151' }}>Break Even</th>
                              </tr>
                            </thead>
                            <tbody>
                              {modalPositionRows.map((row, index) => (
                                <tr key={row.key} style={{ background: index % 2 === 0 ? '#FFFFFF' : '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                                  <td style={{ padding: '0.7rem', fontWeight: '700', color: '#111827' }}>{row.type}</td>
                                  <td style={{ padding: '0.7rem', textAlign: 'right', color: '#374151', fontSize: '0.85rem' }}>{formatStatementValue(row.limits, 0)}</td>
                                  <td style={{ padding: '0.7rem', textAlign: 'right', color: getSignedColor(row.balance), fontWeight: '600' }}>
                                    {formatDirectionalBalance(row.balance, { minDigits: 6, maxDigits: 6 })}
                                  </td>
                                  <td style={{ padding: '0.7rem', textAlign: 'right', color: '#374151', fontSize: '0.85rem' }}>{formatStatementValue(row.price, 4)}</td>
                                  <td style={{ padding: '0.7rem', textAlign: 'right', color: getSignedColor(row.currentValue), fontWeight: '700' }}>
                                    {formatDirectionalBalance(row.currentValue)}
                                  </td>
                                  <td style={{ padding: '0.7rem', textAlign: 'right', color: '#374151', fontSize: '0.85rem' }}>{formatStatementValue(row.breakEven, 4)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div style={{ borderTop: '1px solid #CBD5E0', background: '#FAFBFC', padding: '0.55rem 0.75rem' }}>
                          <p style={{ margin: 0, color: '#374151', fontWeight: '800', fontSize: '0.82rem' }}>Unfixed metal sales & purchases</p>
                          <p style={{ margin: '0.2rem 0 0', color: '#64748B', fontSize: '0.72rem', lineHeight: 1.4 }}>Rows below reflect the same filters as the statement. Amounts are absolute signed cash effect.</p>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                              <tr style={{ background: '#E8EBE0', borderBottom: '2px solid #CBD5E0' }}>
                                <th style={{ padding: '0.7rem', textAlign: 'left', fontWeight: '700', color: '#374151' }}>Date</th>
                                <th style={{ padding: '0.7rem', textAlign: 'left', fontWeight: '700', color: '#374151' }}>Deal</th>
                                <th style={{ padding: '0.7rem', textAlign: 'left', fontWeight: '700', color: '#374151' }}>Metal</th>
                                <th style={{ padding: '0.7rem', textAlign: 'right', fontWeight: '700', color: '#374151' }}>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {unfixedMetalEntries.length ? unfixedMetalEntries.slice(0, 8).map((row, index) => (
                                <tr key={row._id || `${row.date}-${index}`} style={{ background: index % 2 === 0 ? '#FFFFFF' : '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                                  <td style={{ padding: '0.7rem', color: '#111827' }}>{formatStatementDate(row.date)}</td>
                                  <td style={{ padding: '0.7rem', color: '#111827', fontWeight: '600', textTransform: 'capitalize' }}>{row.dealSide}</td>
                                  <td style={{ padding: '0.7rem', color: '#111827' }}>{row.metalCode}</td>
                                  <td style={{ padding: '0.7rem', textAlign: 'right', color: '#111827', fontWeight: '700' }}>{formatStatementValue(row.amount, 2)}</td>
                                </tr>
                              )) : (
                                <tr>
                                  <td colSpan={4} style={{ padding: '0.8rem', textAlign: 'center', color: '#6B7280', fontSize: '0.86rem' }}>
                                    No unfixed metal sale/purchase rows match the selected filters.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div style={{ border: '1px solid #CBD5E0', borderRadius: '0.6rem', background: '#F8FAFC', padding: '0.85rem 0.95rem' }}>
                        <p style={{ margin: 0, color: '#111827', fontWeight: '800', fontSize: '0.92rem' }}>Fixing / Unfixing Metal Sales & Purchases</p>
                        <p style={{ margin: '0.3rem 0 0', color: '#475569', fontSize: '0.8rem', lineHeight: 1.45 }}>
                          Fixed means price locked and finalized. Unfixed means price is still pending; those flows are included in the Position balance and listed above under unfixed activity.
                        </p>
                        <div style={{ marginTop: '0.65rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                          <div style={{ border: '1px solid #BBF7D0', background: '#ECFDF5', borderRadius: '0.45rem', padding: '0.55rem' }}>
                            <p style={{ margin: 0, color: '#166534', fontWeight: '800', fontSize: '0.8rem' }}>Fixed</p>
                            <p style={{ margin: '0.2rem 0 0', color: '#166534', fontSize: '0.76rem' }}>Sales: {fixedMetalSummary.saleCount} ({formatStatementValue(fixedMetalSummary.saleAmount, 2)})</p>
                            <p style={{ margin: '0.15rem 0 0', color: '#166534', fontSize: '0.76rem' }}>Purchases: {fixedMetalSummary.purchaseCount} ({formatStatementValue(fixedMetalSummary.purchaseAmount, 2)})</p>
                          </div>
                          <div style={{ border: '1px solid #FDE68A', background: '#FFFBEB', borderRadius: '0.45rem', padding: '0.55rem' }}>
                            <p style={{ margin: 0, color: '#92400E', fontWeight: '800', fontSize: '0.8rem' }}>Unfixed</p>
                            <p style={{ margin: '0.2rem 0 0', color: '#92400E', fontSize: '0.76rem' }}>Sales: {unfixedMetalSummary.saleCount} ({formatStatementValue(unfixedMetalSummary.saleAmount, 2)})</p>
                            <p style={{ margin: '0.15rem 0 0', color: '#92400E', fontSize: '0.76rem' }}>Purchases: {unfixedMetalSummary.purchaseCount} ({formatStatementValue(unfixedMetalSummary.purchaseAmount, 2)})</p>
                          </div>
                        </div>
                        {unknownFixMetalEntries.length > 0 && (
                          <p style={{ margin: '0.55rem 0 0', color: '#6B7280', fontSize: '0.75rem' }}>
                            {unknownFixMetalEntries.length} metal sale/purchase entries are missing explicit fixing keywords.
                          </p>
                        )}
                      </div>
                    </div>
                    {/* RIGHT COLUMN - Financial Metrics */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', background: '#F9FAFB', borderRadius: '0.6rem', border: '1px solid #E5E7EB' }}>
                      {/* Total Funds */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid #E5E7EB' }}>
                        <span style={{ color: '#374151', fontSize: '0.95rem', fontWeight: '600' }}>Total Funds</span>
                        <span style={{ color: '#111827', fontWeight: '700', fontSize: '1rem' }}>
                          {formatDirectionalBalance(modalTotalFundsDisplay, { preferredDirection: accountEnquiryData?.balances?.netDirection })}
                        </span>
                      </div>
                      {/* Revaluation */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid #E5E7EB' }}>
                        <span style={{ color: '#374151', fontSize: '0.95rem', fontWeight: '600' }}>Revaluation</span>
                        <span style={{ color: getSignedColor(modalRevaluation), fontWeight: '700', fontSize: '1rem' }}>{formatStatementValue(modalRevaluation, 2)}</span>
                      </div>
                      {/* Net Equity */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid #E5E7EB' }}>
                        <span style={{ color: '#374151', fontSize: '0.95rem', fontWeight: '600' }}>Net Equity</span>
                        <span style={{ color: getAccountEnquirySignedMetricColor(modalNetEquityDisplay, { marginAmount: modalMarginAmt, netDirection: accountEnquiryData?.balances?.netDirection }), fontWeight: '700', fontSize: '1rem' }}>
                          {formatDirectionalBalance(modalNetEquityDisplay, { preferredDirection: resolveExposureDirection(modalNetEquityDisplay) })}
                        </span>
                      </div>
                      {/* Margin Amt @ 2% */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid #E5E7EB' }}>
                        <span style={{ color: '#374151', fontSize: '0.95rem', fontWeight: '600' }}>Margin Amt @ 2.0%</span>
                        <span style={{ color: getSignedColor(modalMarginAmt), fontWeight: '700', fontSize: '1rem' }}>{formatStatementValue(modalMarginAmt, 2)}</span>
                      </div>
                      {/* Excess with Currency Dropdown */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid #E5E7EB' }}>
                        <label style={{ color: '#374151', fontSize: '0.95rem', fontWeight: '600' }}>Excess</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <select
                            value={excessCurrency || baseCurrencyCode}
                            onChange={(e) => setExcessCurrency(e.target.value)}
                            style={{ border: '1px solid #CBD5E0', borderRadius: '0.4rem', background: '#FFFFFF', fontSize: '0.85rem', padding: '0.3rem 0.5rem', fontWeight: '600' }}
                          >
                            {(statementDisplayCurrencyOptions.length ? statementDisplayCurrencyOptions : [baseCurrencyCode]).map((currencyCode) => (
                              <option key={currencyCode} value={currencyCode}>{currencyCode}</option>
                            ))}
                          </select>
                          <span style={{ color: getAccountEnquirySignedMetricColor(modalExcessDisplay, { marginAmount: modalMarginAmt, netDirection: accountEnquiryData?.balances?.netDirection }), fontWeight: '800', fontSize: '1.05rem', minWidth: '80px', textAlign: 'right' }}>
                            {formatAccountEnquiryExcessDisplay({
                              excess: modalExcessDisplay,
                              marginAmount: modalMarginAmt,
                              netDirection: accountEnquiryData?.balances?.netDirection,
                              formatValue: (value) => formatStatementValue(value, 2),
                            })}
                          </span>
                        </div>
                      </div>
                      {/* Margin % */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.4rem' }}>
                        <span style={{ color: '#374151', fontSize: '0.95rem', fontWeight: '600' }}>Margin %</span>
                        <span style={{ color: '#1565c0', fontWeight: '800', fontSize: '1.1rem' }}>{formatStatementValue(modalMarginPctDisplay, 2)}%</span>
                      </div>
                      <p style={{ margin: '0.45rem 0 0', color: '#6B7280', fontSize: '0.72rem', lineHeight: 1.45 }}>
                        Customer credit balances are treated as favorable in Customer Margin; supplier credit balances remain payable.
                        {enquirySuppressMetalSpotMtm && (
                          <span>
                            {' '}
                            For creditor/vendor payables, Total Funds uses the ledger payable balance; revaluation uses live spot on the net unfixed metal position (grams).
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  {/* Full Statement Table */}
                  <div style={{ marginTop: '1.25rem', border: '1px solid #CBD5E0', borderRadius: '0.65rem', overflow: 'hidden', background: '#FFFFFF' }}>
                    <div style={{ padding: '0.85rem 1rem', background: '#F5F7F0', borderBottom: '1px solid #D1D5DB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.95rem', color: '#111827', fontWeight: '800' }}>Full Statement of Account</p>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#6B7280' }}>{filteredStatementEntries.length} entries shown</p>
                      </div>
                      {recentPaymentReceiptEntry && (
                        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '0.45rem', padding: '0.45rem 0.6rem' }}>
                          <p style={{ margin: 0, fontSize: '0.73rem', color: '#065F46', fontWeight: '700' }}>Recent Payment/Receipt</p>
                          <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#065F46', fontWeight: '700' }}>
                            {formatStatementDate(recentPaymentReceiptEntry.date)} · {String(recentPaymentReceiptEntry.referenceType || '').toUpperCase()} · #{resolveStatementReceiptNo(recentPaymentReceiptEntry)}
                          </p>
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #E5E7EB', background: '#FAFBFC' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.55rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filter</span>
                        <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem', marginBottom: '0.75rem' }}>
                        <label style={{ display: 'grid', gap: '0.28rem', color: '#64748B', fontSize: '0.78rem', fontWeight: '700' }}>
                          <span>Date From</span>
                          <input
                            type="date"
                            value={statementFilters.startDate}
                            onChange={(e) => setStatementFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                            style={ERP_MODAL_INPUT_STYLE}
                          />
                        </label>
                        <label style={{ display: 'grid', gap: '0.28rem', color: '#64748B', fontSize: '0.78rem', fontWeight: '700' }}>
                          <span>Date To</span>
                          <input
                            type="date"
                            value={statementFilters.endDate}
                            onChange={(e) => setStatementFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                            style={ERP_MODAL_INPUT_STYLE}
                          />
                        </label>
                        <label style={{ display: 'grid', gap: '0.28rem', color: '#64748B', fontSize: '0.78rem', fontWeight: '700' }}>
                          <span>All Types</span>
                          <select
                            value={statementFilters.referenceType}
                            onChange={(e) => setStatementFilters((prev) => ({ ...prev, referenceType: e.target.value }))}
                            style={ERP_MODAL_INPUT_STYLE}
                          >
                            <option value="">All Types</option>
                            {statementReferenceTypes.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: 'grid', gap: '0.28rem', color: '#64748B', fontSize: '0.78rem', fontWeight: '700' }}>
                          <span>All Departments</span>
                          <select
                            value={statementFilters.department}
                            onChange={(e) => setStatementFilters((prev) => ({ ...prev, department: e.target.value }))}
                            style={ERP_MODAL_INPUT_STYLE}
                          >
                            <option value="">All Departments</option>
                            {statementDepartments.map((department) => (
                              <option key={department} value={department}>{department}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: 'grid', gap: '0.28rem', color: '#64748B', fontSize: '0.78rem', fontWeight: '700' }}>
                          <span>All Fixing Status</span>
                          <select
                            value={statementFilters.fixStatus}
                            onChange={(e) => setStatementFilters((prev) => ({ ...prev, fixStatus: e.target.value }))}
                            style={ERP_MODAL_INPUT_STYLE}
                          >
                            <option value="">All Fixing Status</option>
                            <option value="fixed">Fixed Only</option>
                            <option value="unfixed">Unfixed Only</option>
                            <option value="unknown">Unknown Only</option>
                          </select>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setStatementFilters({ startDate: '', endDate: '', referenceType: '', department: '', fixStatus: '', foreignCurrency: '', metalCommodity: '', showAmountIn: '' })
                            setStatementMetalCommodityEnabled(false)
                          }}
                          style={{ padding: '0.65rem 0.75rem', background: '#E5E7EB', color: C.ink, border: '1px solid #D1D5DB', borderRadius: '0.5rem', cursor: 'pointer', height: 'fit-content', alignSelf: 'end', fontWeight: '600', fontSize: '0.78rem' }}
                        >
                          Reset
                        </button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '0.1rem 0 0.55rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Display</span>
                        <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem', marginBottom: '0.75rem' }}>
                        <label style={{ display: 'grid', gap: '0.28rem', color: '#64748B', fontSize: '0.78rem', fontWeight: '700' }}>
                          <span>Foreign Currency</span>
                          <select
                            value={statementFilters.foreignCurrency}
                            onChange={(e) => setStatementFilters((prev) => ({ ...prev, foreignCurrency: e.target.value }))}
                            style={ERP_MODAL_INPUT_STYLE}
                          >
                            {statementFilterCurrencyOptions.map((currencyCode) => (
                              <option key={currencyCode} value={currencyCode === 'ALL' ? '' : currencyCode}>
                                {currencyCode === 'ALL' ? 'All' : currencyCode}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: 'grid', gap: '0.28rem', color: '#64748B', fontSize: '0.78rem', fontWeight: '700' }}>
                          <span>Metal/Commodities</span>
                          <div style={{ display: 'grid', gap: '0.45rem' }}>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: '#334155', fontSize: '0.78rem', fontWeight: '700' }}>
                              <input
                                type="checkbox"
                                checked={statementMetalCommodityEnabled}
                                onChange={(e) => {
                                  const enabled = e.target.checked
                                  setStatementMetalCommodityEnabled(enabled)
                                  if (!enabled) {
                                    setStatementFilters((prev) => ({ ...prev, metalCommodity: '' }))
                                  } else if (!statementFilters.metalCommodity) {
                                    setStatementFilters((prev) => ({ ...prev, metalCommodity: 'Gold' }))
                                  }
                                }}
                                style={{ cursor: 'pointer' }}
                              />
                              Enable metal filter
                            </label>
                            <select
                              value={statementFilters.metalCommodity || ''}
                              onChange={(e) => setStatementFilters((prev) => ({ ...prev, metalCommodity: e.target.value }))}
                              style={{ ...ERP_MODAL_INPUT_STYLE, marginBottom: 0, opacity: statementMetalCommodityEnabled ? 1 : 0.55 }}
                              disabled={!statementMetalCommodityEnabled}
                            >
                              <option value="">All Metals</option>
                              {statementMetalOptions.map((metalOption) => (
                                <option key={metalOption} value={metalOption}>{metalOption}</option>
                              ))}
                            </select>
                          </div>
                        </label>
                        <label style={{ display: 'grid', gap: '0.28rem', color: '#64748B', fontSize: '0.78rem', fontWeight: '700' }}>
                          <span>Show Amount In</span>
                          <select
                            value={statementFilters.showAmountIn || statementDisplayCurrency}
                            onChange={(e) => setStatementFilters((prev) => ({ ...prev, showAmountIn: e.target.value }))}
                            style={ERP_MODAL_INPUT_STYLE}
                          >
                            {statementDisplayCurrencyOptions.map((currencyCode) => (
                              <option key={currencyCode} value={currencyCode}>{currencyCode}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: '#334155', fontSize: '0.82rem', fontWeight: '600', background: '#F8FAFC', border: '1px solid #D1D5DB', borderRadius: '0.5rem', padding: '0.62rem 0.7rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showStatementAuditIds}
                          onChange={(e) => setShowStatementAuditIds(e.target.checked)}
                          style={{ cursor: 'pointer' }}
                        />
                        Show Transaction ID
                      </label>
                    </div>
                    <div ref={statementTableRef} tabIndex={-1} style={{ overflowX: 'auto' }} data-statement-table="true">
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                        <thead>
                          <tr style={{ background: '#E8EBE0', borderBottom: '1px solid #CBD5E0' }}>
                            <th style={{ padding: '0.6rem', textAlign: 'left', color: '#374151', fontWeight: '700' }}>Date</th>
                            <th style={{ padding: '0.6rem', textAlign: 'left', color: '#374151', fontWeight: '700' }}>Receipt No</th>
                            {showStatementAuditIds && <th style={{ padding: '0.6rem', textAlign: 'left', color: '#374151', fontWeight: '700' }}>Transaction ID</th>}
                            <th style={{ padding: '0.6rem', textAlign: 'left', color: '#374151', fontWeight: '700' }}>Deal</th>
                            <th style={{ padding: '0.6rem', textAlign: 'left', color: '#374151', fontWeight: '700' }}>Fixing</th>
                            <th style={{ padding: '0.6rem', textAlign: 'left', color: '#374151', fontWeight: '700' }}>Offset Account</th>
                            <th colSpan={3} style={{ padding: '0.6rem', textAlign: 'center', color: '#111827', fontWeight: '800', borderLeft: '1px solid #CBD5E0' }}>Amount In {statementDisplayCurrency}</th>
                            <th colSpan={3} style={{ padding: '0.6rem', textAlign: 'center', color: '#111827', fontWeight: '800', borderLeft: '1px solid #CBD5E0' }}>Pure WT In Grams</th>
                          </tr>
                          <tr style={{ background: '#EEF1E8', borderBottom: '2px solid #CBD5E0' }}>
                            <th colSpan={showStatementAuditIds ? 6 : 5} style={{ padding: 0, border: 0 }} />
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: '#374151', fontWeight: '700', borderLeft: '1px solid #CBD5E0' }}>Debit</th>
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: '#374151', fontWeight: '700' }}>Credit</th>
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: '#374151', fontWeight: '700' }}>Balance</th>
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: '#374151', fontWeight: '700', borderLeft: '1px solid #CBD5E0' }}>Debit</th>
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: '#374151', fontWeight: '700' }}>Credit</th>
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: '#374151', fontWeight: '700' }}>Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStatementEntries.length === 0 ? (
                            <tr>
                              <td colSpan={showStatementAuditIds ? 13 : 12} style={{ padding: '1rem', textAlign: 'center', color: '#6B7280', fontStyle: 'italic' }}>
                                No statement entries found for selected filters.
                              </td>
                            </tr>
                          ) : (
                            filteredStatementEntries.map((entry, index) => {
                              const receiptNo = resolveStatementReceiptNo(entry)
                              // Account enquiry statement amounts are already in base currency from API.
                              const debitUsd = Number(entry.debitAmount || 0)
                              const creditUsd = Number(entry.creditAmount || 0)
                              const balanceUsd = Number(entry.runningBalance || 0)
                              const debitDisplay = convertStatementDisplayAmount(debitUsd)
                              const creditDisplay = convertStatementDisplayAmount(creditUsd)
                              const balanceDisplay = convertStatementDisplayAmount(balanceUsd)
                              const sourceType = String(entry.sourceTransactionType || entry.referenceType || '').toLowerCase()
                              const entryMetalCode = resolveMetalCode(entry)
                              const isMetalRow = isMetalStatementEntry(entry) && entryMetalCode === statementSelectedMetalCode
                              const signedPureWeight = Number(entry.metalSignedWeight || 0)
                              const debitPureWeight = isMetalRow && signedPureWeight > 0 ? signedPureWeight : (isMetalRow ? 0 : null)
                              const creditPureWeight = isMetalRow && signedPureWeight < 0 ? Math.abs(signedPureWeight) : (isMetalRow ? 0 : null)
                              const balancePureWeight = isMetalRow ? (pureWeightRunningByEntryKey.get(entry._id) ?? null) : null
                              return (
                                <tr key={entry._id || `${entry.date}-${index}`} style={{ background: index % 2 === 0 ? '#FFFFFF' : '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                                  <td style={{ padding: '0.6rem', color: '#374151' }}>{formatStatementDate(entry.date)}</td>
                                  <td style={{ padding: '0.6rem', color: '#111827', fontFamily: 'monospace', fontSize: '0.8rem' }}>{receiptNo}</td>
                                  {showStatementAuditIds && <td style={{ padding: '0.6rem', color: '#475569', fontFamily: 'monospace', fontSize: '0.78rem' }}>{entry.sourceTransactionId || '-'}</td>}
                                  <td style={{ padding: '0.6rem', color: '#374151', textTransform: 'capitalize' }}>{entry.metalDealType || '-'}</td>
                                  <td style={{ padding: '0.6rem' }}>
                                    {(sourceType === 'sale' || sourceType === 'purchase') && (entry.metalFixStatus === 'fixed' || entry.metalFixStatus === 'unfixed') ? (
                                      <span style={{ background: entry.metalFixStatus === 'fixed' ? '#DCFCE7' : '#FEF3C7', color: entry.metalFixStatus === 'fixed' ? '#166534' : '#92400E', borderRadius: '999px', padding: '0.12rem 0.45rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'capitalize' }}>
                                        {entry.metalFixStatus}
                                      </span>
                                    ) : '-'}
                                  </td>
                                  <td style={{ padding: '0.6rem', color: '#374151' }}>
                                    {entry.offsetAccountCode ? `${entry.offsetAccountCode}${entry.offsetAccountName ? ` - ${entry.offsetAccountName}` : ''}` : '-'}
                                  </td>
                                  <td style={{ padding: '0.6rem', textAlign: 'right', color: '#065F46', fontWeight: '600', borderLeft: '1px solid #E5E7EB' }}>{formatStatementValue(debitDisplay, 2)}</td>
                                  <td style={{ padding: '0.6rem', textAlign: 'right', color: '#B91C1C', fontWeight: '600' }}>{formatStatementValue(creditDisplay, 2)}</td>
                                  <td style={{ padding: '0.6rem', textAlign: 'right', color: getSignedColor(balanceDisplay), fontWeight: '700' }}>
                                    {formatDirectionalBalance(balanceDisplay)}
                                  </td>
                                  <td style={{ padding: '0.6rem', textAlign: 'right', color: '#065F46', fontWeight: '600', borderLeft: '1px solid #E5E7EB' }}>{formatStatementNullableValue(debitPureWeight, 2)}</td>
                                  <td style={{ padding: '0.6rem', textAlign: 'right', color: '#B91C1C', fontWeight: '600' }}>{formatStatementNullableValue(creditPureWeight, 2)}</td>
                                  <td style={{ padding: '0.6rem', textAlign: 'right', color: getSignedColor(balancePureWeight), fontWeight: '700' }}>
                                    {balancePureWeight === null ? '-' : formatDirectionalBalance(balancePureWeight)}
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
            {/* Footer */}
            <div style={{ background: '#F9FAFB', borderTop: '1px solid #E5E7EB', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              {canExportAccountSummary && accountEnquiryData && (
                <>
                  <button onClick={handleViewStatement} style={{ padding: '0.6rem 1.2rem', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: '0.5rem', fontSize: '0.95rem', cursor: 'pointer', fontWeight: '700' }}>👁 View Statement</button>
                  <button onClick={handleExportEnquiryPdf} style={{ padding: '0.6rem 1.2rem', background: 'var(--purple)', color: '#fff', border: 'none', borderRadius: '0.5rem', fontSize: '0.95rem', cursor: 'pointer', fontWeight: '700' }}>Export PDF</button>
                </>
              )}
              <button onClick={() => setShowEnquiryModal(false)} style={{ padding: '0.6rem 1.2rem', background: '#6B7280', color: '#fff', border: 'none', borderRadius: '0.5rem', fontSize: '0.95rem', cursor: 'pointer', fontWeight: '700' }}>Close</button>
            </div>
          </div>
        </div>
      )}
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
