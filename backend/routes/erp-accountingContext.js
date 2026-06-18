const { protect } = require('../middleware/auth')
const { validateBody, validateBodyStrict, validateParams } = require('../middleware/validate')
const Ledger = require('../models/Ledger')
const ChartOfAccount = require('../models/ChartOfAccount')
const AccountMapping = require('../models/AccountMapping')
const Currency = require('../models/Currency')
const ReportBranding = require('../models/ReportBranding')
const MetalRate = require('../models/MetalRate')
const InventoryItem = require('../models/InventoryItem')
const StockMovement = require('../models/StockMovement')
const Supplier = require('../models/Supplier')
const Vendor = require('../models/Vendor')
const Transaction = require('../models/Transaction')
const DirectDeal = require('../models/DirectDeal')
const Employee = require('../models/Employee')
const Customer = require('../models/Customer')
const { createAccountCodeService } = require('../services/erpAccounting/accountCodeService')
const {
  DEFAULT_METAL_RATES,
  DEFAULT_REPORT_BRANDING,
  normalizeBrandingKey,
  createReportBrandingService,
} = require('../services/erpAccounting/reportBrandingService')
const { createVoucherVatService } = require('../services/erpAccounting/voucherVatService')
const { createVoucherInventoryImpactService } = require('../services/erpAccounting/voucherInventoryImpactService')
const { createVendorComplianceService } = require('../services/erpAccounting/vendorComplianceService')
const {
  createTransactionAccountResolutionService,
  createVendorAdvanceConfirmationHelpers,
} = require('../services/erpAccounting/transactionAccountResolutionService')
const { applyPartyAccountPriority } = require('../utils/transactionPartyAccounts')
const { parseOffsetPagination } = require('../utils/pagination')
const { isMetalTransferType } = require('../utils/metalStockVoucherTypes')
const { getNextPrefixedCode } = require('../utils/sequentialPartyCode')
const {
  idParam,
  accountCreateSchema,
  accountPatchSchema,
  mappingCreateSchema,
  mappingPatchSchema,
  currencyCreateSchema,
  currencyPatchSchema,
  customerCreateSchema,
  customerPatchSchema,
  vendorCreateSchema,
  vendorPatchSchema,
  transactionPatchSchema,
  transactionCreateSchema,
  ledgerEntrySchema,
  hardDeleteSchema,
} = require('./erp-accounting/schemas')
const {
  normalizeTransactionNote,
  appendTransactionComment,
  appendTransactionAudit,
  respondWorkflowError,
  getTransactionWorkflowErrorStatus,
} = require('../utils/transactionWorkflowHelpers')
const { registerAccountsRoutes } = require('./erp-accounting/accountsRoutes')
const { registerLedgerRoutes } = require('./erp-accounting/ledgerRoutes')
const { registerReportRoutes } = require('./erp-accounting/reportRoutes')
const { registerMappingsRoutes } = require('./erp-accounting/mappingsRoutes')
const { registerCurrencyRoutes } = require('./erp-accounting/currencyRoutes')
const { registerTransactionRoutes } = require('./erp-accounting/transactionRoutes')
const { registerCustomerRoutes } = require('./erp-accounting/customerRoutes')
const { registerVendorRoutes } = require('./erp-accounting/vendorRoutes')
const { registerInventoryRoutes } = require('./erp-accounting/inventoryRoutes')
const { registerDirectDealsRoutes } = require('./erp-accounting/directDealsRoutes')
const { registerAttachmentRoutes } = require('./erp-accounting/attachmentRoutes')
const {
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  BASE_CURRENCY_CODE,
  MAX_TRANSACTION_AMOUNT,
  MAX_EXCHANGE_RATE,
  toMoney,
  toQty,
  parseNumber,
  sanitizeOptionalRef,
  normalizeMetalFixStatus,
  normalizeMoneyValue,
  normalizeExchangeRateValue,
  getRoleTransactionTypes,
  getDisabledVoucherTypeMessage,
  validateTransactionPayload,
} = require('./erp-accounting/transactionHelpers')
const { createFxRevaluationService } = require('../services/erpAccounting/fxRevaluationService')
const { createTransactionPostingService } = require('../services/erpAccounting/transactionPostingService')
const { createLedgerBalanceService } = require('../services/erpAccounting/ledgerBalanceService')
const { createErpAccountingDirectDealAndExchangeService } = require('../services/erpAccounting/erpAccountingDirectDealAndExchangeService')
const {
  populateTransactionListQuery,
  populateTransactionQuery,
  createTransactionWorkflowAction,
} = require('../services/erpAccounting/transactionWorkflowService')
const { createCurrencyBootstrapService } = require('../services/erpAccounting/currencyBootstrapService')
const { createReportSummaryService } = require('../services/erpAccounting/reportSummaryService')
const {
  normalizeDirectDealStockCode,
  directDealEqOzFromQtyAndStock,
} = require('../services/erpAccounting/directDealUnits')
const {
  TRANSACTION_ATTACHMENT_MIME_TYPES,
  validateAttachmentContent,
} = require('../services/erpAccounting/attachmentValidationService')
const { createErpUploadMiddleware } = require('../services/erpAccounting/uploadMiddleware')
const {
  storeUploadedAttachment,
  storeTransactionAttachment,
  removeStoredAttachment,
  sendStoredAttachment,
} = require('../services/erpAccounting/attachmentStorageService')
const {
  isSuperAdmin,
  isDepartmentHead,
  isFinance,
  isSales,
  isOperations,
  isProduction,
  isHR,
  roleName,
  canViewAccounts,
  canManageAccounts,
  canViewMappings,
  canManageMappings,
  canViewAccountSummary,
  canViewLedger,
  canViewCustomers,
  canManageCustomers,
  canCreateTransaction,
  canCreateTransactionFor,
  canAccessReports,
  canAccessVendors,
  canManageVendors,
  canUpdateVendorOperational,
  canAccessInventory,
  canAccessTransactions,
  canAccessOperationalTransactions,
  canReadErpReferenceData,
  canReadErpParties,
  canReadErpDashboardReport,
  canReadErpInventory,
  canReadDirectDeals,
  canUpdateMetalRates,
  canAccessDirectDeals,
  canManageDirectDeals,
  hasExplicitErpPermissions,
  canManageTransactionWorkflow,
  canWriteInventory,
  canManageInventorySettings,
  canCloseLedgerPeriod,
  canEditLedgerEntry,
} = require('../services/erpAccounting/accessPolicy')


// ==========================================
// ROLE-BASED ACCESS CONTROL
// ==========================================

const FX_REVALUATION_EPSILON = 0.01

const fxRevaluationService = createFxRevaluationService({
  parseNumber,
  toMoney,
  Ledger,
  FX_REVALUATION_EPSILON,
  appendTransactionAudit,
  Currency,
  BASE_CURRENCY_CODE,
})

const resolveReferenceExchangeRate = fxRevaluationService.resolveReferenceExchangeRate
const resolveVoucherFxLineBaseAmount = fxRevaluationService.resolveVoucherFxLineBaseAmount
const resolvePrimaryVoucherFxLine = fxRevaluationService.resolvePrimaryVoucherFxLine
const resolveVoucherFxMetrics = fxRevaluationService.resolveVoucherFxMetrics
const buildFxJournalRevaluationPreview = fxRevaluationService.buildFxJournalRevaluationPreview
const applyFxJournalRevaluation = fxRevaluationService.applyFxJournalRevaluation
const validateFxReferenceRateRequirement = fxRevaluationService.validateFxReferenceRateRequirement

let transactionPostingService = null

const MAX_ACCOUNT_CODE_GENERATION_ATTEMPTS = Number(process.env.MAX_ACCOUNT_CODE_GENERATION_ATTEMPTS || 1000)
const MAX_ACCOUNT_HIERARCHY_DEPTH = Number(process.env.MAX_ACCOUNT_HIERARCHY_DEPTH || 10)

const currencyBootstrapService = createCurrencyBootstrapService({
  Currency,
  BASE_CURRENCY_CODE,
})
const ensureBaseCurrencyConfig = currencyBootstrapService.ensureBaseCurrencyConfig
const ensureDefaultCurrencyMaster = currencyBootstrapService.ensureDefaultCurrencyMaster

const {
  ensureAccountByCode,
  nextGeneratedAccountCode,
  validateAccountParentAssignment,
  ensureChildAccountByName,
  nextCustomerAccountCode,
  nextVendorAccountCode,
  nextInventoryAccountCode,
} = createAccountCodeService({ ChartOfAccount, BASE_CURRENCY_CODE })

const reportBrandingService = createReportBrandingService({ MetalRate })
const { buildBrandingPayload, buildBrandingProfiles, getLatestMetalRate } = reportBrandingService

const voucherVatService = createVoucherVatService({
  ensureAccountByCode,
  AccountMapping,
  Ledger,
  BASE_CURRENCY_CODE,
  toMoney,
})
const {
  resolveVoucherVatAmount,
  resolveVoucherNetLineAmount,
  resolveVatPostingAccounts,
  applyVoucherVatImpact,
} = voucherVatService

const voucherInventoryService = createVoucherInventoryImpactService({
  ensureAccountByCode,
  InventoryItem,
  StockMovement,
  Ledger,
  toQty,
  toMoney,
  BASE_CURRENCY_CODE,
})
const {
  resolveTransferPostingAmount,
  prepareVoucherInventoryImpact,
  applyVoucherInventoryImpact,
} = voucherInventoryService

const {
  ensureExchangeDifferenceAccounts,
  nextDirectDealDocNo,
  getMappedAccountIds,
  getAccountSummaryScope,
  metalDisplayName,
  resolveDirectDealCustomer,
  normalizeDirectDealLine,
  syncDirectDealLedger,
  nextVendorCode,
  resolveExchangeAdjustmentAccounts,
} = createErpAccountingDirectDealAndExchangeService({
  ensureAccountByCode,
  ensureChildAccountByName,
  BASE_CURRENCY_CODE,
  ChartOfAccount,
  AccountMapping,
  Customer,
  Vendor,
  Ledger,
  DirectDeal,
  toQty,
  toMoney,
  sanitizeOptionalRef,
  normalizeDirectDealStockCode,
  directDealEqOzFromQtyAndStock,
  getNextPrefixedCode,
  isSuperAdmin,
  isFinance,
  isDepartmentHead,
  canViewAccountSummary,
  hasExplicitErpPermissions,
})

const {
  bankSlipUpload,
  transactionUpload,
  vendorDocumentUpload,
  vendorDocumentUploadDir,
  transactionUploadDir,
} = createErpUploadMiddleware({
  transactionAttachmentMimeTypes: TRANSACTION_ATTACHMENT_MIME_TYPES,
})

const applyTransactionWorkflowAction = createTransactionWorkflowAction({
  normalizeTransactionNote,
  appendTransactionComment,
  appendTransactionAudit,
  canManageTransactionWorkflow,
  getTransactionPostingService: () => transactionPostingService,
})

const parsePagination = parseOffsetPagination

const transactionAccountResolutionService = createTransactionAccountResolutionService({
  ChartOfAccount,
  AccountMapping,
  Customer,
  Vendor,
  InventoryItem,
  Currency,
  Ledger,
  BASE_CURRENCY_CODE,
  normalizeExchangeRateValue,
  normalizeMoneyValue,
  toMoney,
  ensureAccountByCode,
  resolveVoucherNetLineAmount,
  resolveVoucherVatAmount,
  resolveReferenceExchangeRate,
  resolvePrimaryVoucherFxLine,
  resolveVoucherFxMetrics,
  resolveExchangeAdjustmentAccounts,
  FX_REVALUATION_EPSILON,
})

const {
  normalizeCurrencyCode,
  findPreferredBankAccountByCurrency,
  normalizeVoucherSettlementType,
  ensureCashBankAccount,
  resolveVoucherSettlementAccount,
  resolveTransactionAccounts,
  createLedgerFromTransaction,
} = transactionAccountResolutionService

const { getOutstandingForAccount, getAgingForAccount, getEnquiryNetBalanceForAccount } = createLedgerBalanceService({
  Ledger,
  ChartOfAccount,
})

const vendorComplianceService = createVendorComplianceService({
  Transaction,
  Ledger,
  toMoney,
  getOutstandingForAccount,
  getAgingForAccount,
})

const {
  evaluateVendorCompliance,
  buildDocumentExpiryBuckets,
  buildVendorPaymentCalendar,
  batchVendorPaymentCalendars,
  buildVendorSummary,
  batchVendorSummaries,
} = vendorComplianceService

const { buildVendorAdvanceConfirmationError, ensurePaymentAdvanceConfirmed } = createVendorAdvanceConfirmationHelpers({
  ChartOfAccount,
  Currency,
  BASE_CURRENCY_CODE,
  normalizeExchangeRateValue,
  normalizeMoneyValue,
  toMoney,
  getOutstandingForAccount,
})

transactionPostingService = createTransactionPostingService({
  canManageTransactionWorkflow,
  Currency,
  BASE_CURRENCY_CODE,
  validateFxReferenceRateRequirement,
  Customer,
  getOutstandingForAccount,
  getEnquiryNetBalanceForAccount,
  prepareVoucherInventoryImpact,
  resolveTransactionAccounts,
  ensurePaymentAdvanceConfirmed,
  Ledger,
  ChartOfAccount,
  createLedgerFromTransaction,
  applyVoucherVatImpact,
  applyVoucherInventoryImpact,
  resolveVatPostingAccounts,
  isMetalTransferType,
  appendTransactionComment,
  appendTransactionAudit,
})


function registerErpAccountingRoutes(router) {
  registerCustomerRoutes({
    router,
    protect,
    validateBody,
    validateBodyStrict,
    validateParams,
    customerCreateSchema,
    customerPatchSchema,
    idParam,
    Customer,
    Ledger,
    ChartOfAccount,
    Transaction,
    DirectDeal,
    getLatestMetalRate,
    DEFAULT_METAL_RATES,
    canViewCustomers,
    canManageCustomers,
    canReadErpParties,
    parsePagination,
    getAgingForAccount,
    nextCustomerAccountCode,
    toMoney,
    getTransactionWorkflowErrorStatus,
  })
  
  // ==========================================
  // CHART OF ACCOUNTS ENDPOINTS
  // ==========================================
  registerAccountsRoutes({
    router,
    protect,
    validateBody,
    validateParams,
    accountCreateSchema,
    accountPatchSchema,
    idParam,
    Ledger,
    ChartOfAccount,
    AccountMapping,
    Currency,
    InventoryItem,
    Vendor,
    Transaction,
    DirectDeal,
    Customer,
    BASE_CURRENCY_CODE,
    DEFAULT_METAL_RATES,
    toMoney,
    parsePagination,
    getLatestMetalRate,
    getAccountSummaryScope,
    validateAccountParentAssignment,
    canViewAccounts,
    canViewAccountSummary,
    canReadErpReferenceData,
    canManageAccounts,
    isSuperAdmin,
  })
  
  // ==========================================
  // LEDGER ENDPOINTS
  // ==========================================
  registerLedgerRoutes({
    router,
    protect,
    validateBody,
    canViewLedger,
    canCreateTransaction,
    canCreateTransactionFor,
    canEditLedgerEntry,
    canCloseLedgerPeriod,
    bankSlipUpload,
    ledgerEntrySchema,
    Ledger,
    Transaction,
    Currency,
    BASE_CURRENCY_CODE,
  })
  
  // ==========================================
  // ACCOUNT MAPPINGS ENDPOINTS
  // ==========================================
  registerMappingsRoutes({
    router,
    protect,
    validateBody,
    validateParams,
    mappingCreateSchema,
    mappingPatchSchema,
    idParam,
    AccountMapping,
    Ledger,
    canViewMappings,
    canManageMappings,
    parsePagination,
  })
  
  // ==========================================
  // CURRENCY ENDPOINTS
  // ==========================================
  registerCurrencyRoutes({
    router,
    protect,
    validateBody,
    validateParams,
    currencyCreateSchema,
    currencyPatchSchema,
    idParam,
    Currency,
    ReportBranding,
    MetalRate,
    InventoryItem,
    canViewAccounts,
    canReadErpReferenceData,
    canUpdateMetalRates,
    canManageAccounts,
    ensureDefaultCurrencyMaster,
    ensureBaseCurrencyConfig,
    normalizeBrandingKey,
    buildBrandingPayload,
    buildBrandingProfiles,
    DEFAULT_REPORT_BRANDING,
    getLatestMetalRate,
    DEFAULT_METAL_RATES,
    BASE_CURRENCY_CODE,
  })
  
  registerVendorRoutes({
    router,
    protect,
    validateBody,
    validateBodyStrict,
    validateParams,
    vendorCreateSchema,
    vendorPatchSchema,
    idParam,
    Vendor,
    Ledger,
    Transaction,
    ChartOfAccount,
    getLatestMetalRate,
    DEFAULT_METAL_RATES,
    canAccessVendors,
    canManageVendors,
    canUpdateVendorOperational,
    canReadErpParties,
    parsePagination,
    batchVendorSummaries,
    evaluateVendorCompliance,
    buildDocumentExpiryBuckets,
    buildVendorPaymentCalendar,
    batchVendorPaymentCalendars,
    buildVendorSummary,
    nextVendorCode,
    nextVendorAccountCode,
    vendorDocumentUpload,
    vendorDocumentUploadDir,
    storeUploadedAttachment,
    removeStoredAttachment,
    sendStoredAttachment,
    validateAttachmentContent,
    toMoney,
  })
  
  registerInventoryRoutes({
    router,
    protect,
    InventoryItem,
    StockMovement,
    Vendor,
    Ledger,
    ChartOfAccount,
    canAccessInventory,
    canReadErpInventory,
    canWriteInventory,
    canManageInventorySettings,
    parsePagination,
    nextInventoryAccountCode,
    toMoney,
  })
  
  registerDirectDealsRoutes({
    router,
    protect,
    DirectDeal,
    Ledger,
    canAccessDirectDeals,
    canReadDirectDeals,
    canManageDirectDeals,
    parsePagination,
    nextDirectDealDocNo,
    normalizeDirectDealLine,
    syncDirectDealLedger,
    isSuperAdmin,
    toQty,
    toMoney,
  })
  
  // ==========================================
  // TRANSACTIONS MODULE (CORE ENGINE)
  // ==========================================
  registerTransactionRoutes({
    router,
    protect,
    validateBody,
    validateBodyStrict,
    transactionCreateSchema,
    transactionPatchSchema,
    transactionUpload,
    transactionUploadDir,
    TRANSACTION_STATUSES,
    Transaction,
    Ledger,
    Currency,
    Customer,
    Vendor,
    populateTransactionListQuery,
    populateTransactionQuery,
    normalizeMoneyValue,
    normalizeExchangeRateValue,
    validateTransactionPayload,
    validateFxReferenceRateRequirement,
    normalizeMetalFixStatus,
    sanitizeOptionalRef,
    normalizeTransactionNote,
    appendTransactionAudit,
    appendTransactionComment,
    respondWorkflowError,
    applyTransactionWorkflowAction,
    buildFxJournalRevaluationPreview,
    applyFxJournalRevaluation,
    storeTransactionAttachment,
    removeStoredAttachment,
    validateAttachmentContent,
    canAccessReports,
    isSuperAdmin,
    toMoney,
    parsePagination,
    canCreateTransactionFor,
    canAccessOperationalTransactions,
    canCreateTransaction,
    canManageTransactionWorkflow,
    isFinance,
    getRoleTransactionTypes,
    getDisabledVoucherTypeMessage,
    BASE_CURRENCY_CODE,
    applyPartyAccountPriority,
    StockMovement,
    InventoryItem,
    toQty,
  })
  
  registerAttachmentRoutes({
    router,
    protect,
    Transaction,
    Ledger,
    canAccessOperationalTransactions,
    canViewLedger,
    canCreateTransaction,
    sendStoredAttachment,
  })
  
  const {
    parseBool,
    buildDateQuery,
    buildPreviousPeriod,
    buildProfitLossSummary,
    buildProfitLossComparisons,
    buildBalanceSheetSummary,
    buildBalanceSheetComparisons,
  } = createReportSummaryService({
    Ledger,
    ChartOfAccount,
    toMoney,
  })
  
  registerReportRoutes({
    router,
    protect,
    Ledger,
    ChartOfAccount,
    AccountMapping,
    Customer,
    Vendor,
    Transaction,
    DirectDeal,
    InventoryItem,
    StockMovement,
    MetalRate,
    Currency,
    getLatestMetalRate,
    DEFAULT_METAL_RATES,
    toMoney,
    parseBool,
    buildDateQuery,
    buildPreviousPeriod,
    buildProfitLossSummary,
    buildProfitLossComparisons,
    buildBalanceSheetSummary,
    buildBalanceSheetComparisons,
    getAgingForAccount,
    getOutstandingForAccount,
    buildDocumentExpiryBuckets,
    evaluateVendorCompliance,
    canAccessReports,
    canReadErpDashboardReport,
  })
}

module.exports = {
  registerErpAccountingRoutes,
}
