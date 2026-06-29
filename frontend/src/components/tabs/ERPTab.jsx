import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { isLocalTenantHost } from '../../config/tenantBranding'
import { resolveErpUserTenantBranding, resolveErpUserTenantKey } from './erp/resolveErpUserTenant'
import {
  buildDashboardSearchParams,
  buildEnquiryHref,
} from '../../utils/dashboardNavigation'
import erpAccountingAPI from '../../api/erp-accounting'
import { buildEntryAccountOptions, filterActiveAccounts } from './erp/accountDropdownHelpers'
import { ACCOUNT_TYPES } from '../../constants/accountTypes'
import {
  LEDGER_REFERENCE_TYPES,
  LEDGER_DEPARTMENTS,
  ENQUIRY_DETAILS_PANEL_STORAGE_KEY,
  ENQUIRY_STATEMENT_AUDIT_TOGGLE_STORAGE_KEY,
  INVENTORY_STOCK_CODE_SETTINGS_STORAGE_KEY,
  ACCOUNT_TYPE_ORDER,
  ERP_DASH_ALL_WIDGETS,
  DEFAULT_METAL_RATES,
} from './erpTabConstants'
import { formatTransactionAuditEntry, formatTransactionCommentKind, getTransactionBulkSelectionLabel } from './transactionWorkflow'
import { useERPTabStateAdapter } from './erp/useERPTabStateAdapter'
import { useErpDashUiState } from './erp/useErpDashUiState'
import { useErpDashWidgetData } from './erp/useErpDashWidgetData'
import { useFixingRegisterPanelDrag } from './erp/useFixingRegisterPanelDrag'
import { useFixingRegisterState } from './erp/useFixingRegisterState'
import { useJvFormState } from './erp/useJvFormState'
import { useJvModalChrome } from './erp/useJvModalChrome'
import { useFixingRegisterStockTypeOptions } from './erp/useFixingRegisterStockTypeOptions'
import { ERP_TAB_COLORS as C, TRANSACTION_STATUS_STYLES, ERP_EMPTY_CARD_STYLE, ERP_MODAL_BACKDROP_STYLE, ERP_MODAL_CARD_STYLE, ERP_MODAL_INPUT_STYLE } from './erp/erpTabPresentation'
import { useTransactionComposer } from './erp/useTransactionComposer'
import { useJournalVoucher } from './erp/useJournalVoucher'
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
  DEFAULT_INVENTORY_STOCK_CODE_SETTINGS,
  createInventoryMappingForm,
  createInventoryProductForm,
  decodeInventoryCategoryMeta,
  decodeInventoryCategoryPairs,
  formatVatPercent,
  getTransactionActionLabels,
  getTransactionTypeLabels,
  resolveMainStockValueFromForm,
  resolveTransactionAttachmentUrl,
  titleCaseWords,
} from './erp/erpTabUtils'
import { useErpEnquiryMetalRatesSync } from './erp/useErpMetalRatesRealtime'
import { useErpLiveMetalSpotPrices } from './erp/useErpLiveMetalSpotPrices'
import useLiveMetalRates from '../../hooks/useLiveMetalRates'
import { useErpCustomers } from './erp/useErpCustomers'
import { useErpMappings } from './erp/useErpMappings'
import { useErpCurrencies } from './erp/useErpCurrencies'
import { useErpCustomerMargin, useErpSupplierMargin, useErpMarginContextMenuDismissal } from './erp/useErpMarginTabs'
import { useErpReportsController } from './erp/useErpReportsController'
import { useErpTransactionWorkflow } from './erp/useErpTransactionWorkflow'
import { useErpVoucherSource } from './erp/useErpVoucherSource'

import {
  liveRatesToMetalRatesState,
  resolveInventoryValuationUnitCost,
} from '../../utils/liveMetalRates'
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
  normalizeJvCurrencyCode,
  resolveJvModeMeta,
} from './erp/journalVoucherHelpers'
import {
  DEFAULT_BRANDING,
  DEFAULT_BRANDING_PROFILES,
  clampBrandingDimension,
} from './erp/ERPBrandingUtils'
import { resolveDocumentBranding } from './erp/documentBranding'
import { exchangeRateFromUnitsPerBase, resolveCurrencyRowByCode } from './erp/erpCurrencyRowHelpers'
import { buildBrandingLogoTag as buildBrandingLogoTagHelper, openPrintWindow as openPrintWindowHelper } from './erp/erpPrintHelpers'
import { useErpAccountEnquiryController } from './erp/useErpAccountEnquiryController'
import { useErpTabRouter } from './erp/useErpTabRouter'
import { useErpLedger } from './erp/useErpLedger'
import { useErpLedgerActions } from './erp/useErpLedgerActions'
import { useErpVendors } from './erp/useErpVendors'
import { useErpInventory } from './erp/useErpInventory'
import { useErpAccounts } from './erp/useErpAccounts'
import { useErpVendorActions } from './erp/useErpVendorActions'
import { useErpInventoryActions } from './erp/useErpInventoryActions'
import { useErpBranding } from './erp/useErpBranding'
import { useErpTransactions } from './erp/useErpTransactions'
import { useErpExportActions } from './erp/useErpExportActions'
import { useErpReferenceCrud } from './erp/useErpReferenceCrud'
import { useErpTransactionNavigation } from './erp/useErpTransactionNavigation'
import ERPTabPanels from './erp/ERPTabPanels'
import ERPTabModals from './erp/ERPTabModals'
import { useErpTabPanelProps } from './erp/useErpTabPanelProps'
import { useErpTabModalProps } from './erp/useErpTabModalProps'
import { EMPTY_VENDOR_DOCUMENT_FORM, EMPTY_VENDOR_FORM } from './erp/vendorFormDefaults'

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
  const inventoryTenantKey = resolveErpUserTenantKey(user)
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
  const {
    jvLines,
    setJvLines,
    jvHeader,
    setJvHeader,
    nextJvLineId,
    setNextJvLineId,
    jvMode,
    setJvMode,
    ledgerVoucherTab,
    setLedgerVoucherTab,
    jvEditEntryIds,
    setJvEditEntryIds,
    jvReadOnly,
    setJvReadOnly,
    showLedgerForm,
    setShowLedgerForm,
  } = useJvFormState()
  const {
    jvModalOffset,
    setJvModalOffset,
    jvModalDrag,
    setJvModalDrag,
    jvModalSize,
    setJvModalSize,
    jvModalResize,
    setJvModalResize,
    beginJvModalDrag,
    beginJvModalResize,
    jvModalDefaultSize,
  } = useJvModalChrome(showLedgerForm)
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
  const { snapshot: liveMetalSnapshot, error: liveMetalContextError } = useLiveMetalRates()
  const {
    goldPriceUSD: erpGoldPriceUSD,
    silverPriceUSD: erpSilverPriceUSD,
  } = useErpLiveMetalSpotPrices()
  const metalRates = useMemo(() => {
    const synced = liveRatesToMetalRatesState(liveMetalSnapshot)
    return synced || DEFAULT_METAL_RATES
  }, [liveMetalSnapshot])
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
  const [vendorForm, setVendorForm] = useState({ ...EMPTY_VENDOR_FORM })
  const [vendorFilters, setVendorFilters] = useState({ search: '', status: '', approvalStatus: '', riskLevel: '', category: '', includeInactive: false })
  const [vendorSummary, setVendorSummary] = useState({ totalVendors: 0, totalOutstanding: 0, overLimit: 0, blacklisted: 0, onHold: 0, nonCompliant: 0 })
  const [vendorPermissions, setVendorPermissions] = useState({ canManage: false, canUpdateOperational: false })
  const [selectedVendorId, setSelectedVendorId] = useState('')
  const [selectedVendorDetails, setSelectedVendorDetails] = useState(null)
  const [vendorWorkflowReason, setVendorWorkflowReason] = useState('')
  const [vendorDocumentForm, setVendorDocumentForm] = useState({ ...EMPTY_VENDOR_DOCUMENT_FORM })
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
  const [inventoryProductModalOffset, setInventoryProductModalOffset] = useState({ x: 0, y: 0 })
  const [inventoryProductModalDragging, setInventoryProductModalDragging] = useState(false)
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
  const erpAccountsTenantKey = user?.tenant || user?.company || 'default'
  const { loadAccounts } = useErpAccounts({
    token,
    tenantKey: erpAccountsTenantKey,
    canViewAccounts,
    canViewBalanceEnquiry,
    canAccessTransactions,
    canAccessVouchers,
    canViewLedger,
    canAccessReports,
    canAccessCurrencies,
    canAccessErpSettings,
    canAccessFixingRegister,
    setLoading: setAccountsLoading,
    setSummaryAccountsLoading,
    setAccounts,
    setSummaryAccounts,
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
  useErpEnquiryMetalRatesSync({
    snapshot: liveMetalSnapshot,
    activeTabRef,
    showEnquiryModalRef,
    accountEnquiryDataRef,
    onEnquiryMetalRatesPatch: patchAccountEnquiryMetalRates,
  })
  const [liveMetalFetchError, setLiveMetalFetchError] = useState(null)
  const erpLiveMetalSnapshot = useMemo(() => ({
    gold: Number(liveMetalSnapshot.gold || 0),
    silver: Number(liveMetalSnapshot.silver || 0),
    platinum: Number(liveMetalSnapshot.platinum || 0),
    unit: liveMetalSnapshot.unit || 'TOZ',
    currency: liveMetalSnapshot.currency || 'USD',
    source: liveMetalSnapshot.source || '',
    updatedAt: liveMetalSnapshot.updatedAt,
  }), [
    liveMetalSnapshot.gold,
    liveMetalSnapshot.silver,
    liveMetalSnapshot.platinum,
    liveMetalSnapshot.unit,
    liveMetalSnapshot.currency,
    liveMetalSnapshot.source,
    liveMetalSnapshot.updatedAt,
  ])
  useEffect(() => {
    if (!liveMetalContextError) {
      setLiveMetalFetchError(null)
      return
    }
    setLiveMetalFetchError(liveMetalContextError?.message || 'Live metal rates unavailable')
  }, [liveMetalContextError])
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
    enquiryLiveRecalcEnabled,
    hasMetalExposure,
  } = useAccountEnquiryStatement({
    activeTab,
    showEnquiryModal,
    accountEnquiryData,
    statementFilters,
    statementMetalCommodityEnabled,
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
    goldPriceUSD: erpGoldPriceUSD,
    silverPriceUSD: erpSilverPriceUSD,
    liveRecalcEnabled: activeTab === 'customer-margin',
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
  } = useErpSupplierMargin({
    activeTab,
    vendors,
    goldPriceUSD: erpGoldPriceUSD,
    silverPriceUSD: erpSilverPriceUSD,
    liveRecalcEnabled: activeTab === 'supplier-margin',
  })
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
  const {
    fixingRegPanelOffset,
    fixingRegPanelDrag,
    beginFixingRegPanelDrag,
  } = useFixingRegisterPanelDrag(activeTab)
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
  }, [baseCurrencyCode, setJvHeader])
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
  const {
    loadReportBranding,
    handleBrandingLogoFile,
    handleSaveBranding,
    handleSelectBrandingProfile,
    handleCreateBrandingDraft,
    brandingPreview,
  } = useErpBranding({
    token,
    selectedBrandingKey,
    brandingForm,
    setBrandingProfiles,
    setSelectedBrandingKey,
    setReportBranding,
    setBrandingForm,
    setBrandingPreviewLogo,
    setSaving,
    setError,
    showNotification,
  })
  const {
    reports,
    reportsLoading,
    reportView,
    setReportView,
    reportFilters,
    setReportFilters,
    selectedReportAccountId,
    setSelectedReportAccountId,
    selectedReportAccountCode,
    setSelectedReportAccountCode,
    ledgerReportRows,
    handleTrialAccountDrilldown,
    handleReportAccountDrilldown,
  } = useErpReportsController({
    token,
    activeTab,
    canAccessERP,
    canAccessReports,
    accounts,
    loadAccounts,
    loadReportBranding,
    setError,
    api: erpAccountingAPI,
  })
  const {
    voucherSource,
    setVoucherSource,
    voucherSourceLoading,
    handleOpenVoucherSource,
  } = useErpVoucherSource({
    token,
    setError,
    api: erpAccountingAPI,
  })
  const { loadLedger } = useErpLedger({
    token,
    canViewLedger,
    canLoadReferenceData,
    canViewMappings,
    ledgerFilters,
    ledgerVoucherTab,
    ledgerMeta,
    setLoading: setLedgerLoading,
    setLedger,
    setLedgerMeta,
    setAccounts,
    setCurrencies,
    setMappings,
    setError,
  })
  const {
    loadVendors,
    loadVendorDetails,
    loadVendorPaymentCalendar,
    loadVendorComplianceSummary,
    loadVendorOverdueQueue,
  } = useErpVendors({
    token,
    canLoadParties,
    setLoading: setVendorsLoading,
    setVendors,
    setVendorSummary,
    setVendorPermissions,
    setSelectedVendorDetails,
    setVendorPaymentCalendar,
    setVendorComplianceSummary,
    setVendorOverdueQueue,
    setError,
  })
  const { loadInventory, loadStockLedger } = useErpInventory({
    token,
    canAccessInventory,
    canAccessFixingRegister,
    setLoading: setInventoryLoading,
    setInventoryProducts,
    setStockMovements,
    setStockMovementsLoading,
    setError,
  })
  const { loadTransactions, loadTransactionReferenceData } = useErpTransactions({
    token,
    canAccessTransactions,
    canAccessVouchers,
    canAccessFixingRegister,
    canLoadParties,
    canLoadInventoryData,
    canLoadReferenceData,
    canViewMappings,
    transactionFilters,
    transactionMeta,
    setLoading: setTransactionsLoading,
    setTransactions,
    setTransactionSummary,
    setTransactionMeta,
    setCustomers,
    setVendors,
    setInventoryProducts,
    setMappings,
    setAccounts,
    setCurrencies,
    setError,
  })
  const { handleJumpToTransaction } = useErpTransactionNavigation({
    setSelectedTransactionId,
    setVoucherSource,
    setActiveTabGuarded,
    loadTransactions,
    showNotification,
  })
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
  const {
    selectedTransactionIds,
    setSelectedTransactionIds,
    transactionWorkflowNote,
    setTransactionWorkflowNote,
    transactionCommentDraft,
    setTransactionCommentDraft,
    transactionAttachmentInputKey,
    allVisibleTransactionsSelected,
    toggleTransactionSelection,
    toggleVisibleTransactionSelection,
    handleDeleteTransaction,
    handleTransactionAction,
    handleAddTransactionComment,
    handleSendTransactionChat,
    handleUploadTransactionAttachment,
    handleDeleteTransactionAttachment,
    handleBulkTransactionAction,
  } = useErpTransactionWorkflow({
    token,
    transactions,
    setTransactions,
    selectedTransactionId,
    setSelectedTransactionId,
    editingTransactionId,
    resetTransactionComposer,
    transactionForm,
    loadTransactions,
    loadDashboard,
    setError,
    setSaving,
    showNotification,
    api: erpAccountingAPI,
  })
  const {
    handleEditLedger,
    handleReverseLedger,
    handleReconcileLedger,
    handleSaveEditLedger,
  } = useErpLedgerActions({
    token,
    editState,
    setEditState,
    setSaving,
    setError,
    loadLedger,
    showNotification,
  })
  const {
    openEditModal: _openEditModal,
    closeEditModal,
    handleCreateCustomer,
    handleSaveEdit,
    handleCreateCurrency,
    handleSyncCurrencyMaster,
    handleCreateMapping,
    handleEditMapping,
    handleEditCurrency,
    handleEditCustomer,
    handleDeleteMapping,
    handleDeleteCurrency,
    handleDeleteCustomer,
  } = useErpReferenceCrud({
    token,
    erpBaseCurrencyCode,
    customerForm,
    currencyForm,
    mappingForm,
    editState,
    currencies,
    setCustomerForm,
    setCurrencyForm,
    setMappingForm,
    setShowCustomerForm,
    setShowCurrencyForm,
    setShowMappingForm,
    setEditState,
    setSaving,
    setError,
    showNotification,
    loadCustomers,
    loadAccounts,
    loadCurrencies,
    loadMappings,
    handleSaveEditLedger,
  })
  const {
    handleCreateVendor,
    handleVendorFilterSearch,
    handleVendorSelect,
    handleEditVendor,
    handleDeleteVendor,
    handleVendorWorkflowStatus,
    handleAddVendorDocument,
    handleVendorTableDocumentUpload,
    handleDeleteVendorDocument,
  } = useErpVendorActions({
    token,
    canManageVendors,
    vendorPermissions,
    vendorForm,
    editingVendorId,
    vendorFilters,
    vendorWorkflowReason,
    vendorDocumentForm,
    selectedVendorId,
    setVendorForm,
    setShowVendorForm,
    setEditingVendorId,
    setSelectedVendorId,
    setSelectedVendorDetails,
    setVendorWorkflowReason,
    setVendorDocumentForm,
    setSaving,
    setError,
    showNotification,
    loadVendors,
    loadVendorDetails,
    loadVendorPaymentCalendar,
    loadVendorComplianceSummary,
    loadVendorOverdueQueue,
  })
  const {
    resetInventoryMappingForm,
    resetInventoryProductForm,
    handleInventoryModalDragStart,
    handleInventoryProductModalDragStart,
    handleCreateProduct,
    handleEditProduct,
    handleDeleteProduct,
    handleCreateInventoryCatalogProduct,
    handleEditInventoryCatalogProduct,
    handleDeleteInventoryCatalogProduct,
  } = useErpInventoryActions({
    token,
    isSuperAdmin,
    inventoryMappingForm,
    inventoryProductForm,
    inventoryMappingProducts,
    inventoryCatalogProducts,
    inventoryStockCodeSettings,
    inventoryStockCodeManualOverride,
    editingProductId,
    editingInventoryProductId,
    selectedInventoryStockType,
    showInventoryMappingModal,
    inventoryModalOffset,
    inventoryProductModalOffset,
    setInventoryMappingForm,
    setInventoryProductForm,
    setInventoryStockCodeManualOverride,
    setInventoryModalOffset,
    setInventoryModalDragging,
    setInventoryProductModalOffset,
    setInventoryProductModalDragging,
    setEditingProductId,
    setEditingInventoryProductId,
    setShowInventoryMappingModal,
    setShowInventoryProductModal,
    setSaving,
    setError,
    showNotification,
    loadInventory,
  })
  const {
    loadEnquiryHistory,
    fetchAccountEnquiryByCode,
    handleOpenAccountSummaryFromTree,
    handleAccountEnquiry,
  } = useErpAccountEnquiryController({
    user,
    token,
    safeSummaryAccounts,
    accountEnquiryCode,
    accountEnquiryData,
    enquiryHistory,
    setAccountEnquiryCode,
    setAccountEnquiryData,
    setEnquiryLoading,
    setShowEnquiryLookupMenu,
    setEnquiryStatus,
    setShowEnquiryModal,
    setPendingStatementPreview,
    setStatementFilters,
    setStatementMetalCommodityEnabled,
    setEnquiryHistory,
    setError,
    showNotification,
    syncEnquiryUrl,
    lastEnquiryDeepLinkKeyRef,
    setActiveTabGuarded,
  })
  useErpTabRouter({
    activeTab,
    activeTabRef,
    token,
    user,
    canAccessERP,
    canAccessTransactions,
    canAccessVouchers,
    canAccessFixingRegister,
    accounts,
    customers,
    currencies,
    inventoryProducts,
    fixingRegisterStockTypeOptions,
    fixingRegFilter,
    setFixingRegFilter,
    ledgerFilters,
    ledgerVoucherTab,
    mappingFilters,
    selectedTransactionId,
    selectedVendorId,
    transactions,
    setError,
    setSelectedTransactionId,
    setSelectedTransactionIds,
    loadAccounts,
    loadCustomers,
    loadVendors,
    loadVendorDetails,
    loadVendorPaymentCalendar,
    loadVendorComplianceSummary,
    loadVendorOverdueQueue,
    loadTransactions,
    loadReportBranding,
    loadInventory,
    loadStockLedger,
    loadCurrencies,
    loadLedger,
    loadMappings,
  })
  useEffect(() => {
    loadEnquiryHistory()
  }, [loadEnquiryHistory])
  useEffect(() => {
    accountEnquiryDataRef.current = accountEnquiryData
  }, [accountEnquiryData])
  useEffect(() => {
    showEnquiryModalRef.current = showEnquiryModal
  }, [showEnquiryModal])
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
  const tenantBranding = resolveErpUserTenantBranding(user)
  const branding = resolveDocumentBranding({ reportBranding, user, tenantBranding })
  const buildBrandingLogoTag = buildBrandingLogoTagHelper
  const openPrintWindow = (title, bodyHtml) => openPrintWindowHelper(title, bodyHtml, setError)
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
    jvError,
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
    JV_MODAL_DEFAULT_SIZE: jvModalDefaultSize,
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
  const {
    handleViewStatement,
    handlePrintStatement,
    handleDownloadStatementPdf,
    handleExportEnquiryPdf,
    handleExportTransactionsCsv,
    handleExportTransactionsXlsx,
    handleExportTransactionsPdf,
    handleExportReportCsv,
    handleExportReportXlsx,
    handlePrintCurrentReport,
    handleExportReportPdf,
  } = useErpExportActions({
    accountEnquiryData,
    accountEnquiryCode,
    syncEnquiryUrl,
    generateStatementHtml,
    setStatementPreviewHtml,
    setStatementPreviewTitle,
    setStatementPreviewLoading,
    setShowStatementPreview,
    setExportOptionsOpen,
    setError,
    showNotification,
    transactions,
    selectedTransactionIds,
    transactionTypeLabels: TRANSACTION_TYPE_LABELS,
    reports,
    reportView,
    branding,
    defaultBranding: DEFAULT_BRANDING,
    user,
    ledgerReportRows,
    selectedReportAccountCode,
    formatMoney,
    formatMoneyAbs,
    formatReportDirectionalBalance,
    buildBrandingLogoTag,
    openPrintWindow,
  })

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

  const panelProps = useErpTabPanelProps({
    C,
    ACCOUNT_TYPES,
    ERP_DASH_ALL_WIDGETS,
    ERP_EMPTY_CARD_STYLE,
    ERP_MODAL_BACKDROP_STYLE,
    ERP_MODAL_CARD_STYLE,
    ERP_MODAL_INPUT_STYLE,
    ITEMS_PER_PAGE,
    JV_MODE_META,
    LEDGER_DEPARTMENTS,
    LEDGER_REFERENCE_TYPES,
    TRANSACTION_ACTION_LABELS,
    TRANSACTION_STATUS_STYLES,
    TRANSACTION_TYPE_LABELS,
    accountEnquiryCode,
    accounts,
    activeTab,
    addJvLine,
    allVisibleTransactionsSelected,
    availableTransactionTypes,
    bankJvComboGroups,
    baseCurrencyCode,
    beginFixingRegPanelDrag,
    beginJvModalDrag,
    beginJvModalResize,
    branding,
    brandingForm,
    brandingPreview,
    brandingPreviewLogo,
    brandingProfiles,
    buildAccountEnquiryHref,
    canManageAccounts,
    canManageCustomers,
    canManageDirectDeals,
    canManageVendors,
    canViewBalanceEnquiry,
    closeEditModal,
    closeJvModal,
    createInventoryMappingForm,
    currencies,
    currencyForm,
    customerForm,
    customerMarginCompactView,
    customerMarginContextMenu,
    customerMarginRows,
    customerMarginSearch,
    customerMarginSort,
    customers,
    dashChatMessages,
    dashCustomizeOpen,
    dashDragSrc,
    dashEditMode,
    dashHoveredWid,
    dashPickSelected,
    dashWidgetCols,
    dashWidgets,
    dashboard,
    decodeInventoryCategoryMeta,
    editState,
    editingInventoryProductId,
    editingProductId,
    editingVendorId,
    enquiryHistory,
    enquiryLoading,
    enquiryStatus,
    erpBaseCurrencyCode,
    erpLiveMetalSnapshot,
    fetchAccountEnquiryByCode,
    filteredGroupedSummaryAccounts,
    fixingRegError,
    fixingRegFilter,
    fixingRegFmtAmt,
    fixingRegFmtQty,
    fixingRegFmtRate,
    fixingRegLoading,
    fixingRegOpening,
    fixingRegPanelDrag,
    fixingRegPanelOffset,
    fixingRegResults,
    fixingRegShown,
    fixingRegisterStockTypeOptions,
    formatDirectionalBalance,
    formatMoney,
    formatMoneyAbs,
    formatTransactionAuditEntry,
    formatTransactionCommentKind,
    formatVatPercent,
    getDepartmentBadgeStyle,
    getJvValidation,
    getReportPeriodLabel,
    getTransactionBulkSelectionLabel,
    handleAccountEnquiry,
    handleAddTransactionComment,
    handleAddVendorDocument,
    handleBrandingLogoFile,
    handleBulkTransactionAction,
    handleCreateBrandingDraft,
    handleCreateCurrency,
    handleCreateCustomer,
    handleCreateInventoryCatalogProduct,
    handleCreateMapping,
    handleCreateProduct,
    handleCreateTransaction,
    handleCreateVendor,
    handleCustomerMarginRowContextMenu,
    handleDeleteCurrency,
    handleDeleteCustomer,
    handleDeleteInventoryCatalogProduct,
    handleDeleteMapping,
    handleDeleteProduct,
    handleDeleteTransaction,
    handleDeleteTransactionAttachment,
    handleDeleteVendor,
    handleDeleteVendorDocument,
    handleEditCurrency,
    handleEditCustomer,
    handleEditInventoryCatalogProduct,
    handleEditJv,
    handleEditLedger,
    handleEditMapping,
    handleEditProduct,
    handleEditVendor,
    handleExportReportCsv,
    handleExportReportPdf,
    handleExportReportXlsx,
    handleExportTransactionsCsv,
    handleExportTransactionsPdf,
    handleExportTransactionsXlsx,
    handleFixingRegProceed,
    handleInventoryModalDragStart,
    handleInventoryProductModalDragStart,
    handleJumpToTransaction,
    handleJvAccountKeyDown,
    handleJvLineKeyDown,
    handleOpenAccountSummaryFromTree,
    handleOpenJv,
    handleOpenVoucherSource,
    handlePrintCurrentReport,
    handlePrintJvVoucher,
    handleReconcileLedger,
    handleRepairJvFxApply,
    handleRepairJvFxPreview,
    handleReportAccountDrilldown,
    handleReverseLedger,
    handleSaveBranding,
    handleSaveEdit,
    handleSaveMultiLineJV,
    handleSelectBrandingProfile,
    handleSendTransactionChat,
    handleSupplierMarginRowContextMenu,
    handleSyncCurrencyMaster,
    handleTransactionAction,
    handleTrialAccountDrilldown,
    handleUploadTransactionAttachment,
    handleVendorFilterSearch,
    handleVendorSelect,
    handleVendorTableDocumentUpload,
    handleVendorWorkflowStatus,
    inventoryCatalogProducts,
    inventoryLowStockCount,
    inventoryMappingForm,
    inventoryMappingProducts,
    inventoryMetalBreakdown,
    inventoryModalDragging,
    inventoryModalOffset,
    inventoryProductForm,
    inventoryProductModalDragging,
    inventoryProductModalOffset,
    inventoryProductPurityWeight,
    inventoryProducts,
    inventoryProductsByMetal,
    inventoryReportProducts,
    inventoryStockCodeSettings,
    inventoryStockTypeOptions,
    inventoryTenantKey,
    inventoryTopProducts,
    inventoryTotalQuantity,
    inventoryTotalValue,
    inventoryVatFilter,
    inventoryVatSortDir,
    isFinance,
    isSuperAdmin,
    isTransactionEditMode,
    jumpToTransactionId,
    jumpToVoucher,
    jvComboGroups,
    jvEditEntryIds,
    jvError,
    jvHeader,
    jvLines,
    jvModalDrag,
    jvModalOffset,
    jvModalResize,
    jvModalSize,
    jvMode,
    jvReadOnly,
    ledger,
    ledgerFilters,
    ledgerMeta,
    ledgerReportRows,
    ledgerVoucherTab,
    legacyInventoryProducts,
    liveMetalFetchError,
    loadInventory,
    loadLedger,
    loadMappings,
    loadStockLedger,
    loadTransactions,
    loadVendorOverdueQueue,
    mappingFilters,
    mappingForm,
    mappingSummary,
    mappings,
    onJumpToVoucherConsumed,
    onNavigateMain,
    openJvModal,
    pagination,
    populateTransactionForm,
    removeJvLine,
    reportBranding,
    reportFilters,
    reportView,
    reports,
    reportsLoading,
    resetInventoryMappingForm,
    resetInventoryProductForm,
    resetTransactionComposer,
    resolveJvLineAccount,
    resolveJvModeMeta,
    resolveMainStockValueFromForm,
    resolveTransactionAttachmentUrl,
    safeSummaryAccounts,
    saving,
    selectedBrandingKey,
    selectedReportAccountCode,
    selectedReportAccountId,
    selectedTransaction,
    selectedTransactionId,
    selectedTransactionIds,
    selectedUsdConversionRate,
    selectedVendorDetails,
    selectedVendorId,
    setAccountEnquiryCode,
    setActiveTabGuarded,
    setBrandingForm,
    setCurrencyForm,
    setCustomerForm,
    setCustomerMarginCompactView,
    setCustomerMarginSearch,
    setCustomerMarginSort,
    setDashCustomizeOpen,
    setDashEditMode,
    setDashHoveredWid,
    setDashPickSelected,
    setDashWidgetCols,
    setDashWidgets,
    setEditState,
    setEditingInventoryProductId,
    setEditingProductId,
    setEditingVendorId,
    setEnquiryStatus,
    setError,
    setFixingRegError,
    setFixingRegFilter,
    setFixingRegResults,
    setFixingRegShown,
    setInventoryMappingForm,
    setInventoryModalOffset,
    setInventoryProductForm,
    setInventoryProductModalOffset,
    setInventoryStockCodeManualOverride,
    setInventoryStockCodeSettings,
    setInventoryVatFilter,
    setInventoryVatSortDir,
    setJvHeader,
    setLedgerFilters,
    setLedgerVoucherTab,
    setMappingFilters,
    setMappingForm,
    setPagination,
    setReportFilters,
    setReportView,
    setSelectedBrandingKey,
    setSelectedReportAccountCode,
    setSelectedReportAccountId,
    setSelectedTransactionId,
    setSelectedTransactionIds,
    setShowCurrencyForm,
    setShowCustomerForm,
    setShowInventoryMappingModal,
    setShowInventoryProductModal,
    setShowMappingForm,
    setShowMappingTest,
    setShowVendorForm,
    setSorting,
    setStockMovementsFilter,
    setStockTypeModalTab,
    setSupplierMarginCompactView,
    setSupplierMarginSearch,
    setSupplierMarginSort,
    setTestMapping,
    setTransactionCommentDraft,
    setTransactionFilters,
    setTransactionForm,
    setTransactionWorkflowNote,
    setUsdConversion,
    setVendorDocumentForm,
    setVendorFilters,
    setVendorForm,
    setVendorWorkflowReason,
    setVoucherSource,
    showCurrencyForm,
    showCustomerForm,
    showInventoryMappingModal,
    showInventoryProductModal,
    showLedgerForm,
    showMappingForm,
    showNotification,
    showVendorForm,
    sortedInventoryTableRows,
    sorting,
    stockMovements,
    stockMovementsFilter,
    stockMovementsLoading,
    stockTypeModalTab,
    summaryAccountsLoading,
    supplierMarginCompactView,
    supplierMarginContextMenu,
    supplierMarginRows,
    supplierMarginSearch,
    supplierMarginSort,
    switchJvMode,
    titleCaseWords,
    toggleTransactionSelection,
    toggleVisibleTransactionSelection,
    token,
    transactionAttachmentInputKey,
    transactionCommentDraft,
    transactionFilters,
    transactionForm,
    transactionMeta,
    transactionPageCount,
    transactionSummary,
    transactionWorkflowNote,
    transactions,
    transactionsLoading,
    updateJvLine,
    usdConversion,
    usdToTargetAmount,
    user,
    vendorComplianceSummary,
    vendorDocumentForm,
    vendorFilters,
    vendorForm,
    vendorOverdueQueue,
    vendorPaymentCalendar,
    vendorPermissions,
    vendorSummary,
    vendorWorkflowReason,
    vendors,
    voucherSource,
    voucherSourceLoading,
  })
  const modalProps = useErpTabModalProps({
    showMappingTest,
    setShowMappingTest,
    testMapping,
    colors: C,
    showEnquiryModal,
    setShowEnquiryModal,
    enquiryBackdropColor,
    enquiryModalOffset,
    enquiryModalDrag,
    beginEnquiryModalDrag,
    enquiryLoading,
    accountEnquiryCode,
    setAccountEnquiryCode,
    setShowEnquiryLookupMenu,
    showEnquiryLookupMenu,
    filteredGroupedSummaryAccounts,
    setEnquiryStatus,
    fetchAccountEnquiryByCode,
    enquiryStatus,
    accountEnquiryData,
    modalPositionRows,
    formatStatementValue,
    getSignedColor,
    formatDirectionalBalance,
    unfixedMetalEntries,
    formatStatementDate,
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
    enquiryLiveRecalcEnabled,
    hasMetalExposure,
    excessCurrency,
    setExcessCurrency,
    baseCurrencyCode,
    statementDisplayCurrencyOptions,
    filteredStatementEntries,
    recentPaymentReceiptEntry,
    resolveStatementReceiptNo,
    statementFilters,
    setStatementFilters,
    statementReferenceTypes,
    statementDepartments,
    setStatementMetalCommodityEnabled,
    statementMetalCommodityEnabled,
    statementFilterCurrencyOptions,
    statementMetalOptions,
    statementDisplayCurrency,
    showStatementAuditIds,
    setShowStatementAuditIds,
    statementTableRef,
    convertStatementDisplayAmount,
    resolveMetalCode,
    statementSelectedMetalCode,
    pureWeightRunningByEntryKey,
    formatStatementNullableValue,
    canExportAccountSummary,
    handleViewStatement,
    buildAccountEnquiryHref,
    handleExportEnquiryPdf,
    getAccountEnquirySignedMetricColor,
    formatAccountEnquiryExcessDisplay,
    resolveExposureDirection,
    isMetalStatementEntry,
    showStatementPreview,
    setShowStatementPreview,
    statementPreviewTitle,
    statementPreviewHtml,
    statementPreviewLoading,
    exportOptionsOpen,
    setExportOptionsOpen,
    handlePrintStatement,
    handleDownloadStatementPdf,
  })

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
      <ERPTabPanels {...panelProps} />
      <ERPTabModals {...modalProps} />
    </div>
  )
}
export default ERPTab
