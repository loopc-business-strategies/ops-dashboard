import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../../context/AuthContext'
import { useLanguage } from '../../../../context/LanguageContext'
import { isLocalTenantHost } from '../../../../config/tenantBranding'
import { resolveErpUserTenantKey } from '../resolveErpUserTenant'
import { buildDashboardSearchParams, buildEnquiryHref } from '../../../../utils/dashboardNavigation'
import { filterActiveAccounts } from '../accountDropdownHelpers'
import { ENQUIRY_STATEMENT_AUDIT_TOGGLE_STORAGE_KEY, INVENTORY_STOCK_CODE_SETTINGS_STORAGE_KEY, DEFAULT_METAL_RATES } from '../../erpTabConstants'
import { useERPTabStateAdapter } from '../useERPTabStateAdapter'
import { useErpDashUiState } from '../useErpDashUiState'
import { useErpDashWidgetData } from '../useErpDashWidgetData'
import { useFixingRegisterState } from '../useFixingRegisterState'
import { useJvFormState } from '../useJvFormState'
import { useJvModalChrome } from '../useJvModalChrome'

import { deriveErpAccessPolicy } from '../accessPolicy'
import { DEFAULT_INVENTORY_STOCK_CODE_SETTINGS, createInventoryMappingForm, createInventoryProductForm, getTransactionActionLabels, getTransactionTypeLabels } from '../erpTabUtils'
import { useErpEnquiryMetalRatesSync } from '../useErpMetalRatesRealtime'
import { useErpLiveMetalSpotPrices } from '../useErpLiveMetalSpotPrices'
import useLiveMetalRates from '../../../../hooks/useLiveMetalRates'
import { useErpCustomers } from '../useErpCustomers'
import { useErpMappings } from '../useErpMappings'
import { useErpCurrencies } from '../useErpCurrencies'

import { liveRatesToMetalRatesState } from '../../../../utils/liveMetalRates'
import { canViewErpSubTab } from '../../../../utils/erpSubTabPermissions'
import { buildJvDocNo as buildNextJvDocNo, convertJvAmountBetweenCurrencies } from '../journalVoucherHelpers'
import { DEFAULT_BRANDING, DEFAULT_BRANDING_PROFILES } from '../ERPBrandingUtils'
import { useErpAccounts } from '../useErpAccounts'
import { EMPTY_VENDOR_DOCUMENT_FORM, EMPTY_VENDOR_FORM } from '../vendorFormDefaults'



export function useErpTabCoreSlice(props) {
  const {
    focusTab,
    onNavigateMain,
    onErpSubTabChange,
    jumpToTransactionId,
    onJumpToTransactionConsumed,
    jumpToVoucher,
    onJumpToVoucherConsumed,
    jumpToEnquiryAccountCode,
    onJumpToEnquiryConsumed,
  } = props

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

  return {
    accountEnquiryCode,
    accountEnquiryData,
    accountEnquiryDataRef,
    accounts,
    activeTab,
    activeTabRef,
    beginJvModalDrag,
    beginJvModalResize,
    brandingForm,
    brandingPreviewLogo,
    brandingProfiles,
    buildAccountEnquiryHref,
    buildJvDocNo,
    canAccessCurrencies,
    canAccessDirectDeals,
    canAccessERP,
    canAccessErpSettings,
    canAccessFixingRegister,
    canAccessInventory,
    canAccessReports,
    canAccessTransactions,
    canAccessVendors,
    canAccessVouchers,
    canCloseLedgerPeriod,
    canCreateTransaction: _canCreateTransaction,
    canExportAccountSummary,
    canLoadDashboard,
    canLoadInventoryData,
    canLoadParties,
    canLoadReferenceData,
    canManageAccounts,
    canManageCustomers,
    canManageDirectDeals,
    canManageTransactionWorkflow: _canManageTransactionWorkflow,
    canManageVendors,
    canUpdateMetalRates: _canUpdateMetalRates,
    canUpdateVendorOperational: _canUpdateVendorOperational,
    canViewAccounts,
    canViewBalanceEnquiry,
    canViewCurrentErpSubTab,
    canViewCustomers,
    canViewLedger,
    canViewMappings,
    convertJvAmount,
    currencies,
    currencyForm,
    customerForm,
    customers,
    dashboard,
    dashChatMessages,
    dashCustomizeOpen,
    dashDragSrc,
    dashEditMode,
    dashHoveredWid,
    dashPickSelected,
    dashWidgetCols,
    dashWidgets,
    detailsPanel,
    editingInventoryProductId,
    editingProductId,
    editingVendorId,
    editState,
    enquiryCompany,
    enquiryHistory,
    enquiryIncludeCompany,
    enquiryLoading,
    enquiryStatus,
    erpAccountsTenantKey,
    erpBaseCurrencyCode,
    erpGoldPriceUSD,
    erpLiveMetalSnapshot,
    erpSilverPriceUSD,
    error,
    excessCurrency,
    exportOptionsOpen,
    fixingRegError,
    fixingRegFilter,
    fixingRegLoading,
    fixingRegOpening,
    fixingRegResults,
    fixingRegShown,
    focusTab,
    goldPriceUSD: erpGoldPriceUSD,
    handleFixingRegProceed,
    inventoryMappingForm,
    inventoryModalDragging,
    inventoryModalOffset,
    inventoryProductForm,
    inventoryProductModalDragging,
    inventoryProductModalOffset,
    inventoryProducts,
    inventoryStockCodeManualOverride,
    inventoryStockCodeSettings,
    inventoryStockCodeSettingsKey,
    inventoryTenantKey,
    inventoryVatFilter,
    inventoryVatSortDir,
    isDepartmentHead: _isDepartmentHead,
    isFinance,
    isHRRole: _isHRRole,
    isManagementRole: _isManagementRole,
    isOperationsRole: _isOperationsRole,
    isSalesRole: _isSalesRole,
    isSuperAdmin,
    ITEMS_PER_PAGE,
    jumpToEnquiryAccountCode,
    jumpToTransactionId,
    jumpToVoucher,
    jvEditEntryIds,
    jvHeader,
    jvLines,
    jvModalDefaultSize,
    jvModalDrag,
    jvModalOffset,
    jvModalResize,
    jvModalSize,
    jvMode,
    jvReadOnly,
    lastEnquiryDeepLinkKeyRef,
    ledger,
    ledgerFilters,
    ledgerMeta,
    ledgerVoucherTab,
    liveMetalContextError,
    liveMetalFetchError,
    liveMetalSnapshot,
    loadAccounts,
    loadCurrencies,
    loadCustomers,
    loadDashboard,
    loadMappings,
    mappingFilters,
    mappingForm,
    mappings,
    mappingSummary,
    metalRates,
    nextJvLineId,
    onErpSubTabChange,
    onJumpToEnquiryConsumed,
    onJumpToTransactionConsumed,
    onJumpToVoucherConsumed,
    onNavigateMain,
    pagination,
    patchAccountEnquiryMetalRates,
    pendingStatementPreview,
    reportBranding,
    safeSummaryAccounts,
    saving,
    searchParams,
    selectedBrandingKey,
    selectedTransactionId,
    selectedVendorDetails,
    selectedVendorId,
    setAccountEnquiryCode,
    setAccountEnquiryData,
    setAccounts,
    setAccountsLoading,
    setActiveTab,
    setActiveTabGuarded,
    setBrandingForm,
    setBrandingPreviewLogo,
    setBrandingProfiles,
    setCurrencies,
    setCurrenciesLoading,
    setCurrencyForm,
    setCustomerForm,
    setCustomers,
    setCustomersLoading,
    setDashCustomizeOpen,
    setDashEditMode,
    setDashHoveredWid,
    setDashPickSelected,
    setDashWidgetCols,
    setDashWidgets,
    setDetailsPanel,
    setEditingInventoryProductId,
    setEditingProductId,
    setEditingVendorId,
    setEditState,
    setEnquiryHistory,
    setEnquiryLoading,
    setEnquiryStatus,
    setError,
    setExcessCurrency,
    setExportOptionsOpen,
    setFixingRegError,
    setFixingRegFilter,
    setFixingRegResults,
    setFixingRegShown,
    setInventoryLoading,
    setInventoryMappingForm,
    setInventoryModalDragging,
    setInventoryModalOffset,
    setInventoryProductForm,
    setInventoryProductModalDragging,
    setInventoryProductModalOffset,
    setInventoryProducts,
    setInventoryStockCodeManualOverride,
    setInventoryStockCodeSettings,
    setInventoryVatFilter,
    setInventoryVatSortDir,
    setJvEditEntryIds,
    setJvHeader,
    setJvLines,
    setJvModalDrag,
    setJvModalOffset,
    setJvModalResize,
    setJvModalSize,
    setJvMode,
    setJvReadOnly,
    setLedger,
    setLedgerFilters,
    setLedgerLoading,
    setLedgerMeta,
    setLedgerVoucherTab,
    setLiveMetalFetchError,
    setMappingFilters,
    setMappingForm,
    setMappings,
    setMappingsLoading,
    setMappingSummary,
    setNextJvLineId,
    setPagination,
    setPendingStatementPreview,
    setReportBranding,
    setSaving,
    setSearchParams,
    setSelectedBrandingKey,
    setSelectedTransactionId,
    setSelectedVendorDetails,
    setSelectedVendorId,
    setShowCurrencyForm,
    setShowCustomerForm,
    setShowEnquiryLookupMenu,
    setShowEnquiryModal,
    setShowInventoryMappingModal,
    setShowInventoryProductModal,
    setShowLedgerForm,
    setShowMappingForm,
    setShowMappingTest,
    setShowStatementAuditIds,
    setShowStatementPreview,
    setShowVendorForm,
    setSorting,
    setStatementAuditPreferenceReady,
    setStatementFilters,
    setStatementMetalCommodityEnabled,
    setStatementPreviewHtml,
    setStatementPreviewLoading,
    setStatementPreviewTitle,
    setStockMovements,
    setStockMovementsFilter,
    setStockMovementsLoading,
    setStockTypeModalTab,
    setSuccess,
    setSummaryAccounts,
    setSummaryAccountsLoading,
    setTestMapping,
    setTransactionFilters,
    setTransactionMeta,
    setTransactions,
    setTransactionsLoading,
    setTransactionSummary,
    setUsdConversion,
    setVendorComplianceSummary,
    setVendorDocumentForm,
    setVendorFilters,
    setVendorForm,
    setVendorOverdueQueue,
    setVendorPaymentCalendar,
    setVendorPermissions,
    setVendors,
    setVendorsLoading,
    setVendorSummary,
    setVendorWorkflowReason,
    showCurrencyForm,
    showCustomerForm,
    showEnquiryLookupMenu,
    showEnquiryModal,
    showEnquiryModalRef,
    showInventoryMappingModal,
    showInventoryProductModal,
    showLedgerForm,
    showMappingForm,
    showMappingTest,
    showNotification,
    showStatementAuditIds,
    showStatementPreview,
    showVendorForm,
    silverPriceUSD: erpSilverPriceUSD,
    snapshot: liveMetalSnapshot,
    sorting,
    statementAuditPreferenceKey,
    statementAuditPreferenceReady,
    statementFilters,
    statementMetalCommodityEnabled,
    statementPreviewHtml,
    statementPreviewLoading,
    statementPreviewTitle,
    statementTableRef,
    stockMovements,
    stockMovementsFilter,
    stockMovementsLoading,
    stockTypeModalTab,
    success,
    summaryAccounts,
    summaryAccountsLoading,
    syncEnquiryUrl,
    t,
    testMapping,
    token,
    TRANSACTION_ACTION_LABELS,
    TRANSACTION_TYPE_LABELS,
    transactionFilters,
    transactionMeta,
    transactions,
    transactionsLoading,
    transactionSummary,
    usdConversion,
    user,
    vendorComplianceSummary,
    vendorDocumentForm,
    vendorFilters,
    vendorForm,
    vendorOverdueQueue,
    vendorPaymentCalendar,
    vendorPermissions,
    vendors,
    vendorSummary,
    vendorWorkflowReason,
  }
}
