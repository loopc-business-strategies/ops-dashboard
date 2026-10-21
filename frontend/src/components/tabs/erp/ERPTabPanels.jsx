import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { isMasterDocumentSettingsEnabled } from '../../../config/tenantBranding'
import LazyChunkGate from '../../LazyChunkGate'
import {
  ERPAccountsTabContainer,
  ERPVouchersTabContainer,
} from './ERPTabContainers'
import { importVoucherTab, prefetchVoucherTabChunk } from './voucherTabChunk'
import { loadSharedAccountChart } from '../../../utils/erpSharedAccountChart'
import { loadSharedCurrencies } from '../../../utils/erpSharedCurrencies'
import { loadSharedCustomers, loadSharedVendors } from '../../../utils/erpSharedParties'
import { loadSharedVoucherList } from '../../../utils/erpSharedVoucherList'
import { loadSharedSummaryReport } from './useErpReportsController'
import { loadSharedLedgerPage } from '../../../utils/erpSharedLedger'
import { resetDashboardConnectionsIssued, resetLiveMetalFetchStarted, whenDashboardConnectionsOpened, whenLiveMetalFetchSettled } from '../../../utils/liveMetalRates'
import {
  hasExpenseRegisterFinished,
  resetExpenseRegisterStarted,
  whenExpenseRegisterSettled,
} from './useExpenseRegister'

const loadErpDashboardTab = () => import('./tabs/ERPDashboardTab')
const loadErpEditRecordModal = () => import('./ErpEditRecordModal')
const loadChartOfAccountsTree = () => import('../ChartOfAccountsTree')
const loadDirectDealsTab = () => import('../DirectDealsTab')
const loadErpInventoryTab = () => import('./tabs/ERPInventoryTab')
const loadErpVendorsTab = () => import('./tabs/ERPVendorsTab')
const loadErpLedgerTab = () => import('./tabs/ERPLedgerTab')
const loadErpPeriodClosingTab = () => import('./tabs/ERPPeriodClosingTab')
const loadErpTransactionsTab = () => import('./tabs/ERPTransactionsTab')
const loadErpReportsTab = () => import('./tabs/ERPReportsTab')
const loadErpFixingRegisterTab = () => import('./tabs/ERPFixingRegisterTab')
const loadErpCustomersTab = () => import('./tabs/ERPCustomersTab')
const loadErpCustomerMarginTab = () => import('./tabs/ERPCustomerMarginTab')
const loadErpSupplierMarginTab = () => import('./tabs/ERPSupplierMarginTab')
const loadErpMappingsTab = () => import('./tabs/ERPMappingsTab')
const loadErpEnquiryTab = () => import('./tabs/ERPEnquiryTab')
const loadErpSettingsTab = () => import('./tabs/ERPSettingsTab')
const loadErpCurrenciesTab = () => import('./tabs/ERPCurrenciesTab')

const ERPDashboardTab = lazy(loadErpDashboardTab)
const ErpEditRecordModal = lazy(loadErpEditRecordModal)
const ChartOfAccountsTree = lazy(loadChartOfAccountsTree)
const DirectDealsTab = lazy(loadDirectDealsTab)
const ERPInventoryTab = lazy(loadErpInventoryTab)
const ERPVendorsTab = lazy(loadErpVendorsTab)
const ERPLedgerTab = lazy(loadErpLedgerTab)
const ERPPeriodClosingTab = lazy(loadErpPeriodClosingTab)
const ERPTransactionsTab = lazy(loadErpTransactionsTab)
const ERPReportsTab = lazy(loadErpReportsTab)
const ERPFixingRegisterTab = lazy(loadErpFixingRegisterTab)
const ERPCustomersTab = lazy(loadErpCustomersTab)
const ERPCustomerMarginTab = lazy(loadErpCustomerMarginTab)
const ERPSupplierMarginTab = lazy(loadErpSupplierMarginTab)
const ERPMappingsTab = lazy(loadErpMappingsTab)
const ERPEnquiryTab = lazy(loadErpEnquiryTab)
const ERPSettingsTab = lazy(loadErpSettingsTab)
const ERPCurrenciesTab = lazy(loadErpCurrenciesTab)
const VoucherTab = lazy(() => importVoucherTab())

const ERP_MENU_CHUNK_LOADERS = [
  loadChartOfAccountsTree,
  importVoucherTab,
  loadErpLedgerTab,
  loadErpReportsTab,
  loadErpTransactionsTab,
  loadErpCustomersTab,
  loadErpVendorsTab,
  loadErpMappingsTab,
  loadErpEnquiryTab,
  loadErpDashboardTab,
  loadErpInventoryTab,
  loadDirectDealsTab,
  loadErpPeriodClosingTab,
  loadErpFixingRegisterTab,
  loadErpCustomerMarginTab,
  loadErpSupplierMarginTab,
  loadErpSettingsTab,
  loadErpCurrenciesTab,
]

function ErpSubTabFallback() {
  return (
    <div style={{ padding: '1rem', color: '#6B7280', fontSize: '0.875rem' }}>
      Loading…
    </div>
  )
}

export default function ERPTabPanels({
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
  canCloseOnBackdropClick,
  branding: _branding,
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
  dashExpandedWidget,
  dashHoveredWid,
  dashPickSelected,
  dashWidgetCols,
  dashWidgets,
  dashboard,
  dashboardReportSettled,
  decodeInventoryCategoryMeta,
  editState,
  editingInventoryProductId,
  editingProductId,
  editingVendorId,
  enquiryHistory,
  enquiryLoading,
  enquiryStatus,
  erpBaseCurrencyCode,
  erpAdvancedListFiltersEnabled,
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
  reportPdfDownloadEnabled,
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
  loadReportBranding,
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
  setDashExpandedWidget,
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
}) {
  const masterDocumentSettingsEnabled = isMasterDocumentSettingsEnabled(
    String(user?.company || user?.tenant?.key || '').trim().toLowerCase(),
  )
  const [voucherChunkKey, setVoucherChunkKey] = useState(0)
  const [visitedTabs, setVisitedTabs] = useState(() => new Set([activeTab]))

  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev
      const next = new Set(prev)
      next.add(activeTab)
      return next
    })
  }, [activeTab])

  const keepTab = (id) => activeTab === id || visitedTabs.has(id)
  const hiddenTabStyle = { display: 'none' }

  useEffect(() => {
    if (activeTab === 'vouchers' || jumpToVoucher) {
      prefetchVoucherTabChunk()
    }
  }, [activeTab, jumpToVoucher])

  useEffect(() => {
    let cancelled = false
    const timers = ERP_MENU_CHUNK_LOADERS.map((load, index) => window.setTimeout(() => {
      if (!cancelled) load().catch(() => {})
    }, 400 + index * 80))
    return () => {
      cancelled = true
      timers.forEach((id) => window.clearTimeout(id))
    }
  }, [])

  const backgroundWarmRef = useRef(false)
  const seenTokenRef = useRef(token)
  if (seenTokenRef.current !== token) {
    seenTokenRef.current = token
    backgroundWarmRef.current = false
    resetExpenseRegisterStarted()
    resetLiveMetalFetchStarted()
    resetDashboardConnectionsIssued()
  }

  useEffect(() => {
    if (!token || backgroundWarmRef.current) return undefined
    let timer = 0
    let capTimer = 0
    let cancelled = false
    let cancelWait = () => {}
    const run = () => {
      window.clearTimeout(timer)
      cancelWait()
      if (backgroundWarmRef.current) return
      backgroundWarmRef.current = true
      const loads = [
        () => loadSharedAccountChart(token),
        () => loadSharedCustomers(token),
        () => loadSharedVendors(token),
        () => loadSharedCurrencies(token),
        () => loadSharedVoucherList(token, { type: 'payment', limit: 200 }),
        () => loadSharedSummaryReport(token),
        () => loadSharedLedgerPage(token),
      ]
      let index = 0
      const next = () => {
        if (cancelled || index >= loads.length) return
        const load = loads[index]
        index += 1
        let hopped = false
        const hop = () => {
          if (hopped || cancelled) return
          hopped = true
          window.clearTimeout(capTimer)
          next()
        }
        capTimer = window.setTimeout(hop, 8000)
        Promise.resolve().then(load).catch(() => {}).then(hop)
      }
      next()
    }
    const afterConnectionsOpened = () => {
      cancelWait = whenDashboardConnectionsOpened(run)
    }
    const afterPricesSettled = () => {
      cancelWait = whenLiveMetalFetchSettled(afterConnectionsOpened)
    }
    const onDashboard = activeTab === 'dashboard'
    if (!onDashboard) {
      timer = window.setTimeout(run, 0)
    } else if (!dashboardReportSettled) {
      timer = window.setTimeout(run, 8000)
    } else if (hasExpenseRegisterFinished()) {
      afterPricesSettled()
    } else {
      cancelWait = whenExpenseRegisterSettled(afterPricesSettled)
    }
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.clearTimeout(capTimer)
      cancelWait()
    }
  }, [token, activeTab, dashboardReportSettled])

  return (
    <>
      {keepTab('dashboard') && (
      <div style={activeTab === 'dashboard' ? undefined : hiddenTabStyle} aria-hidden={activeTab !== 'dashboard'}>
      <Suspense fallback={<ErpSubTabFallback />}>
      <ERPDashboardTab
        activeTab={activeTab}
        persistDashboard={visitedTabs.has('dashboard')}
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
        dashExpandedWidget={dashExpandedWidget}
        setDashExpandedWidget={setDashExpandedWidget}
        dashDragSrc={dashDragSrc}
        ERP_DASH_ALL_WIDGETS={ERP_DASH_ALL_WIDGETS}
        dashboard={dashboard}
        dashboardReportSettled={dashboardReportSettled}
        dashChatMessages={dashChatMessages}
        setActiveTab={setActiveTabGuarded}
        onNavigateMain={onNavigateMain}
        dashboardLiveRecalcEnabled={activeTab === 'dashboard'}
        token={token}
        accounts={accounts}
        setLedgerFilters={setLedgerFilters}
        baseCurrencyCode={baseCurrencyCode}
      />
      </Suspense>
      </div>
      )}
      {/* CHART OF ACCOUNTS TAB */}
      {keepTab('accounts') && (
      <div style={activeTab === 'accounts' ? undefined : hiddenTabStyle} aria-hidden={activeTab !== 'accounts'}>
      <ERPAccountsTabContainer activeTab={activeTab} persist={visitedTabs.has('accounts')}>
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
      </div>
      )}
      {/* LEDGER TAB */}
      {keepTab('customers') && (
      <div style={activeTab === 'customers' ? undefined : hiddenTabStyle} aria-hidden={activeTab !== 'customers'}>
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
            baseCurrencyCode={baseCurrencyCode}
          />
        </Suspense>
      </div>
      )}
      {/* CUSTOMER MARGIN TAB */}
      {keepTab('customer-margin') && (
      <div style={activeTab === 'customer-margin' ? undefined : hiddenTabStyle} aria-hidden={activeTab !== 'customer-margin'}>
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
      </div>
      )}
      {/* SUPPLIER MARGIN TAB */}
      {keepTab('supplier-margin') && (
      <div style={activeTab === 'supplier-margin' ? undefined : hiddenTabStyle} aria-hidden={activeTab !== 'supplier-margin'}>
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
      </div>
      )}
      {keepTab('fixing-register') && (
      <div style={activeTab === 'fixing-register' ? undefined : hiddenTabStyle} aria-hidden={activeTab !== 'fixing-register'}>
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
      </div>
      )}
      {(keepTab('ledger') || showLedgerForm) && (
      <div style={(activeTab === 'ledger' || showLedgerForm) ? undefined : hiddenTabStyle} aria-hidden={!(activeTab === 'ledger' || showLedgerForm)}>
        <Suspense fallback={<ErpSubTabFallback />}>
          <ERPLedgerTab
        activeTab={activeTab}
        C={C}
        inventoryTenantKey={inventoryTenantKey}
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
        canCloseOnBackdropClick={canCloseOnBackdropClick}
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
        jvError={jvError}
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
        erpAdvancedListFiltersEnabled={erpAdvancedListFiltersEnabled}
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
      </div>
      )}
      {keepTab('period-closing') && (
      <div style={activeTab === 'period-closing' ? undefined : hiddenTabStyle} aria-hidden={activeTab !== 'period-closing'}>
        <Suspense fallback={<ErpSubTabFallback />}>
          <ERPPeriodClosingTab C={C} />
        </Suspense>
      </div>
      )}
      {/* ACCOUNT MAPPINGS TAB */}
      {keepTab('mappings') && (
      <div style={activeTab === 'mappings' ? undefined : hiddenTabStyle} aria-hidden={activeTab !== 'mappings'}>
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
      </div>
      )}
      {/* ACCOUNT SUMMARY TAB */}
      {keepTab('enquiry') && (
      <div style={activeTab === 'enquiry' ? undefined : hiddenTabStyle} aria-hidden={activeTab !== 'enquiry'}>
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
            persistEnquiry={visitedTabs.has('enquiry')}
            buildAccountEnquiryHref={buildAccountEnquiryHref}
          />
        </Suspense>
      </div>
      )}
      {(keepTab('transactions') || jumpToTransactionId) && (
      <div style={(activeTab === 'transactions' || jumpToTransactionId) ? undefined : hiddenTabStyle} aria-hidden={!(activeTab === 'transactions' || jumpToTransactionId)}>
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
        erpAdvancedListFiltersEnabled={erpAdvancedListFiltersEnabled}
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
        baseCurrencyCode={baseCurrencyCode}
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
      </div>
      )}
      {keepTab('reports') && (
      <div style={activeTab === 'reports' ? undefined : hiddenTabStyle} aria-hidden={activeTab !== 'reports'}>
        <Suspense fallback={<ErpSubTabFallback />}>
          <ERPReportsTab
        activeTab={activeTab}
        token={token}
        C={C}
        modalInputStyle={ERP_MODAL_INPUT_STYLE}
        reportFilters={reportFilters}
        setReportFilters={setReportFilters}
        ACCOUNT_TYPES={ACCOUNT_TYPES}
        LEDGER_REFERENCE_TYPES={LEDGER_REFERENCE_TYPES}
        handleExportReportCsv={handleExportReportCsv}
        handleExportReportXlsx={handleExportReportXlsx}
        handleExportReportPdf={handleExportReportPdf}
        reportPdfDownloadEnabled={reportPdfDownloadEnabled}
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
        baseCurrencyCode={baseCurrencyCode}
        currencies={currencies}
        fixingRegisterStockTypeOptions={fixingRegisterStockTypeOptions}
        loadInventory={loadInventory}
          />
        </Suspense>
      </div>
      )}
      {/* VENDORS TAB */}
      {keepTab('vendors') && (
      <div style={activeTab === 'vendors' ? undefined : hiddenTabStyle} aria-hidden={activeTab !== 'vendors'}>
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
        baseCurrencyCode={baseCurrencyCode}
          />
        </Suspense>
      </div>
      )}
      {/* INVENTORY TAB */}
      {keepTab('inventory') && (
      <div style={activeTab === 'inventory' ? undefined : hiddenTabStyle} aria-hidden={activeTab !== 'inventory'}>
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
        baseCurrencyCode={baseCurrencyCode}
        currencies={currencies}
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
      </div>
      )}
      {/* SETTINGS TAB */}
      {keepTab('settings') && (
      <div style={activeTab === 'settings' ? undefined : hiddenTabStyle} aria-hidden={activeTab !== 'settings'}>
        <Suspense fallback={<ErpSubTabFallback />}>
          <ERPSettingsTab
            C={C}
            masterDocumentSettingsEnabled={masterDocumentSettingsEnabled}
            inventoryStockCodeSettings={inventoryStockCodeSettings}
            setInventoryStockCodeSettings={setInventoryStockCodeSettings}
            {...(masterDocumentSettingsEnabled ? {} : {
              selectedBrandingKey,
              setSelectedBrandingKey,
              handleSelectBrandingProfile,
              brandingProfiles,
              brandingForm,
              setBrandingForm,
              reportBranding,
              handleBrandingLogoFile,
              saving,
              canManageAccounts,
              handleSaveBranding,
              handleCreateBrandingDraft,
              brandingPreviewLogo,
              brandingPreview,
            })}
          />
        </Suspense>
      </div>
      )}
      {/* CURRENCIES TAB */}
      {keepTab('currencies') && (
      <div style={activeTab === 'currencies' ? undefined : hiddenTabStyle} aria-hidden={activeTab !== 'currencies'}>
        <Suspense fallback={<ErpSubTabFallback />}>
          <ERPCurrenciesTab
            C={C}
            erpBaseCurrencyCode={erpBaseCurrencyCode}
            canManageAccounts={canManageAccounts}
            showCurrencyForm={showCurrencyForm}
            setShowCurrencyForm={setShowCurrencyForm}
            handleSyncCurrencyMaster={handleSyncCurrencyMaster}
            saving={saving}
            tenantKey={inventoryTenantKey}
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
      </div>
      )}
      <Suspense fallback={null}>
        <ErpEditRecordModal
          editState={editState}
          setEditState={setEditState}
          accounts={accounts}
          ledgerDepartments={LEDGER_DEPARTMENTS}
          erpBaseCurrencyCode={erpBaseCurrencyCode}
          saving={saving}
          onClose={closeEditModal}
          onSubmit={handleSaveEdit}
          colors={C}
        />
      </Suspense>
      {/* VOUCHERS TAB */}
      {(keepTab('vouchers') || jumpToVoucher) && (
      <div style={(activeTab === 'vouchers' || jumpToVoucher) ? undefined : hiddenTabStyle} aria-hidden={!(activeTab === 'vouchers' || jumpToVoucher)}>
      <ERPVouchersTabContainer activeTab={activeTab} persist={visitedTabs.has('vouchers')}>
        <LazyChunkGate
          key={voucherChunkKey}
          resetKey={voucherChunkKey}
          label="Loading vouchers..."
          color={C.inkSoft}
          onRetry={() => setVoucherChunkKey((k) => k + 1)}
        >
          <VoucherTab
            token={token}
            user={user}
            accounts={accounts}
            customers={customers}
            vendors={vendors}
            currencies={currencies}
            reportBranding={reportBranding}
            loadReportBranding={loadReportBranding}
            erpAdvancedListFiltersEnabled={erpAdvancedListFiltersEnabled}
            pendingOpenTransactionId={jumpToVoucher?.id || null}
            pendingOpenTransactionType={jumpToVoucher?.type || null}
            onPendingOpenTransactionConsumed={onJumpToVoucherConsumed}
          />
        </LazyChunkGate>
      </ERPVouchersTabContainer>
      </div>
      )}
      {/* DIRECT DEALS TAB */}
      {keepTab('direct-deals') && (
      <div style={activeTab === 'direct-deals' ? undefined : hiddenTabStyle} aria-hidden={activeTab !== 'direct-deals'}>
        <Suspense fallback={<ErpSubTabFallback />}>
          <DirectDealsTab
            token={token}
            customers={customers}
            currencies={currencies}
            canManage={canManageDirectDeals}
            isSuperAdmin={isSuperAdmin}
            user={user}
            reportBranding={reportBranding}
          />
        </Suspense>
      </div>
      )}
    </>
  )
}
