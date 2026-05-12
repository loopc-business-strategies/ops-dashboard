const fs = require('fs')
const path = require('path')
const multer = require('multer')
const { protect } = require('../middleware/auth')
const { Joi, validateBody, validateBodyStrict, validateParams } = require('../middleware/validate')
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
const { applyPartyAccountPriority } = require('../utils/transactionPartyAccounts')
const { ACCOUNT_TYPES } = require('../constants/accountTypes')
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
const { createFxRevaluationService } = require('../services/erpAccounting/fxRevaluationService')
const { createTransactionPostingService } = require('../services/erpAccounting/transactionPostingService')
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
  canCreateTransaction,
  canCreateTransactionFor,
  canAccessReports,
  canAccessVendors,
  canManageVendors,
  canUpdateVendorOperational,
  canAccessInventory,
  canAccessTransactions,
  canAccessDirectDeals,
  canManageDirectDeals,
} = require('../services/erpAccounting/accessPolicy')


// ─── Joi Schemas ────────────────────────────────────────────────────────────
const ACC_TYPES = ACCOUNT_TYPES
const TX_TYPES  = ['expense', 'sale', 'purchase', 'receipt', 'payment', 'payroll']

const idParam = Joi.object({ id: Joi.string().hex().length(24).required() })

const accountCreateSchema = Joi.object({
  accountName:     Joi.string().trim().min(1).max(200).required(),
  accountCode:     Joi.string().trim().min(1).max(20).required(),
  accountType:     Joi.string().valid(...ACC_TYPES).required(),
  parentAccountId: Joi.string().hex().length(24).allow('', null).optional(),
  currency:        Joi.string().trim().allow('').max(10).optional(),
  description:     Joi.string().trim().allow('').max(500).optional(),
})

const accountPatchSchema = Joi.object({
  accountName:     Joi.string().trim().min(1).max(200).optional(),
  accountCode:     Joi.string().trim().min(1).max(20).optional(),
  accountType:     Joi.string().valid(...ACC_TYPES).optional(),
  parentAccountId: Joi.string().hex().length(24).allow('', null).optional(),
  currency:        Joi.string().trim().allow('').max(10).optional(),
  description:     Joi.string().trim().allow('').max(500).optional(),
  isActive:        Joi.boolean().optional(),
}).min(1)

const mappingCreateSchema = Joi.object({
  mappingType:     Joi.string().trim().min(1).max(100).required(),
  debitAccountId:  Joi.string().hex().length(24).required(),
  creditAccountId: Joi.string().hex().length(24).required(),
  description:     Joi.string().trim().allow('').max(300).optional(),
  department:      Joi.string().trim().allow('').max(80).optional(),
})

const mappingPatchSchema = Joi.object({
  mappingType:     Joi.string().trim().min(1).max(100).optional(),
  debitAccountId:  Joi.string().hex().length(24).optional(),
  creditAccountId: Joi.string().hex().length(24).optional(),
  description:     Joi.string().trim().allow('').max(300).optional(),
  department:      Joi.string().trim().allow('').max(80).optional(),
  isActive:        Joi.boolean().optional(),
}).min(1)

const currencyCreateSchema = Joi.object({
  code:         Joi.string().trim().min(2).max(10).required(),
  name:         Joi.string().trim().min(1).max(100).required(),
  symbol:       Joi.string().trim().allow('').max(20).optional(),
  exchangeRate: Joi.number().positive().required(),
  isActive:     Joi.boolean().optional(),
  baseCurrency: Joi.boolean().optional(),
})

const currencyPatchSchema = Joi.object({
  code:         Joi.string().trim().min(2).max(10).optional(),
  name:         Joi.string().trim().min(1).max(100).optional(),
  symbol:       Joi.string().trim().allow('').max(20).optional(),
  exchangeRate: Joi.number().positive().optional(),
  isActive:     Joi.boolean().optional(),
  baseCurrency: Joi.boolean().optional(),
}).min(1)

const customerCreateSchema = Joi.object({
  name:             Joi.string().trim().min(1).max(200).required(),
  phone:            Joi.string().trim().allow('').max(30).optional(),
  email:            Joi.string().email({ tlds: { allow: false } }).allow('').optional(),
  address:          Joi.string().trim().allow('').max(300).optional(),
  gstVat:           Joi.string().trim().allow('').max(60).optional(),
  openingBalance:   Joi.number().optional(),
  creditLimit:      Joi.number().min(0).optional(),
  paymentTermsDays: Joi.number().integer().min(0).optional(),
  currency:         Joi.string().trim().allow('').max(10).optional(),
  notes:            Joi.string().trim().allow('').max(2000).optional(),
})

const customerPatchSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  phone: Joi.string().trim().allow('').max(30).optional(),
  email: Joi.string().email({ tlds: { allow: false } }).allow('').optional(),
  address: Joi.string().trim().allow('').max(300).optional(),
  gstVat: Joi.string().trim().allow('').max(60).optional(),
  creditLimit: Joi.number().min(0).optional(),
  paymentTermsDays: Joi.number().integer().min(0).optional(),
  currency: Joi.string().trim().allow('').max(10).optional(),
  notes: Joi.string().trim().allow('').max(2000).optional(),
  isActive: Joi.boolean().optional(),
  ledgerAccountId: Joi.string().hex().length(24).allow('', null).optional(),
}).min(1)

const vendorCreateSchema = Joi.object({
  vendorCode:         Joi.string().trim().allow('').max(30).optional(),
  name:               Joi.string().trim().min(1).max(200).required(),
  contactPerson:      Joi.string().trim().allow('').max(120).optional(),
  phone:              Joi.string().trim().allow('').max(30).optional(),
  email:              Joi.string().email({ tlds: { allow: false } }).allow('').optional(),
  address:            Joi.string().trim().allow('').max(300).optional(),
  city:               Joi.string().trim().allow('').max(80).optional(),
  country:            Joi.string().trim().allow('').max(80).optional(),
  postalCode:         Joi.string().trim().allow('').max(20).optional(),
  gstVat:             Joi.string().trim().allow('').max(60).optional(),
  taxRegistrationNo:  Joi.string().trim().allow('').max(60).optional(),
  openingBalance:     Joi.number().optional(),
  paymentTermsDays:   Joi.number().integer().min(0).optional(),
  creditLimit:        Joi.number().min(0).optional(),
  category:           Joi.string().trim().allow('').max(80).optional(),
  rating:             Joi.number().integer().min(1).max(5).optional(),
  riskLevel:          Joi.string().valid('Low', 'Medium', 'High').optional(),
  status:             Joi.string().trim().allow('').max(30).optional(),
  notes:              Joi.string().trim().allow('').max(2000).optional(),
  tags:               Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
  preferredCurrency:  Joi.string().trim().allow('').max(10).optional(),
  bankName:           Joi.string().trim().allow('').max(120).optional(),
  bankAccountNumber:  Joi.string().trim().allow('').max(60).optional(),
  iban:               Joi.string().trim().allow('').max(34).optional(),
  swiftCode:          Joi.string().trim().allow('').max(20).optional(),
  currency:           Joi.string().trim().allow('').max(10).optional(),
})

const vendorPatchSchema = Joi.object({
  vendorCode: Joi.string().trim().allow('').max(30).optional(),
  name: Joi.string().trim().min(1).max(200).optional(),
  contactPerson: Joi.string().trim().allow('').max(120).optional(),
  phone: Joi.string().trim().allow('').max(30).optional(),
  email: Joi.string().email({ tlds: { allow: false } }).allow('').optional(),
  address: Joi.string().trim().allow('').max(300).optional(),
  city: Joi.string().trim().allow('').max(80).optional(),
  country: Joi.string().trim().allow('').max(80).optional(),
  postalCode: Joi.string().trim().allow('').max(20).optional(),
  gstVat: Joi.string().trim().allow('').max(60).optional(),
  taxRegistrationNo: Joi.string().trim().allow('').max(60).optional(),
  paymentTermsDays: Joi.number().integer().min(0).optional(),
  creditLimit: Joi.number().min(0).optional(),
  category: Joi.string().trim().allow('').max(80).optional(),
  rating: Joi.number().integer().min(1).max(5).optional(),
  riskLevel: Joi.string().valid('low', 'medium', 'high', 'Low', 'Medium', 'High').optional(),
  status: Joi.string().trim().allow('').max(30).optional(),
  notes: Joi.string().trim().allow('').max(2000).optional(),
  tags: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim().max(50)).max(20),
    Joi.string().allow('').max(500)
  ).optional(),
  preferredCurrency: Joi.string().trim().allow('').max(10).optional(),
  bankName: Joi.string().trim().allow('').max(120).optional(),
  bankAccountNumber: Joi.string().trim().allow('').max(60).optional(),
  iban: Joi.string().trim().allow('').max(34).optional(),
  swiftCode: Joi.string().trim().allow('').max(20).optional(),
  currency: Joi.string().trim().allow('').max(10).optional(),
  isActive: Joi.boolean().optional(),
}).min(1)

const transactionPatchSchema = Joi.object({
  type: Joi.string().valid(...TX_TYPES).optional(),
  amount: Joi.number().optional(),
  date: Joi.string().allow('', null).optional(),
  description: Joi.string().trim().allow('').max(1000).optional(),
  currency: Joi.string().trim().allow('').max(10).optional(),
  exchangeRate: Joi.number().positive().optional(),
  customerId: Joi.string().hex().length(24).allow('', null).optional(),
  vendorId: Joi.string().hex().length(24).allow('', null).optional(),
  inventoryItemId: Joi.string().hex().length(24).allow('', null).optional(),
  mappingId: Joi.string().hex().length(24).allow('', null).optional(),
  debitAccountId: Joi.string().hex().length(24).allow('', null).optional(),
  creditAccountId: Joi.string().hex().length(24).allow('', null).optional(),
  voucherMeta: Joi.object().optional(),
  metalFixStatus: Joi.string().trim().allow('').max(30).optional(),
}).min(1)

const transactionCreateSchema = Joi.object({
  type:              Joi.string().valid(...TX_TYPES).required(),
  amount:            Joi.number().required(),
  date:              Joi.string().allow('', null).optional(),
  description:       Joi.string().trim().allow('').max(1000).optional(),
  currency:          Joi.string().trim().allow('').max(10).optional(),
  exchangeRate:      Joi.number().positive().optional(),
  customerId:        Joi.string().hex().length(24).allow('', null).optional(),
  vendorId:          Joi.string().hex().length(24).allow('', null).optional(),
  inventoryItemId:   Joi.string().hex().length(24).allow('', null).optional(),
  mappingId:         Joi.string().hex().length(24).allow('', null).optional(),
  debitAccountId:    Joi.string().hex().length(24).allow('', null).optional(),
  creditAccountId:   Joi.string().hex().length(24).allow('', null).optional(),
  voucherMeta:       Joi.object().optional(),
  metalFixStatus:    Joi.string().trim().allow('').max(30).optional(),
})

const ledgerEntrySchema = Joi.object({
  date:          Joi.string().allow('', null).optional(),
  description:   Joi.string().trim().allow('').max(1000).optional(),
  debitAmount:   Joi.number().min(0).optional(),
  creditAmount:  Joi.number().min(0).optional(),
  currency:      Joi.string().trim().allow('').max(10).optional(),
  exchangeRate:  Joi.number().positive().optional(),
  referenceType: Joi.string().trim().allow('').max(80).optional(),
  referenceId:   Joi.string().hex().length(24).allow('', null).optional(),
  accountId:     Joi.string().hex().length(24).allow('', null).optional(),
  notes:         Joi.string().trim().allow('').max(1000).optional(),
}).unknown(true)

const hardDeleteSchema = Joi.object({
  code: Joi.string().trim().min(1).max(20).required(),
})
// ────────────────────────────────────────────────────────────────────────────

// ==========================================
// ROLE-BASED ACCESS CONTROL
// ==========================================

const TRANSACTION_TYPES = ['expense', 'sale', 'purchase', 'receipt', 'payment', 'payroll']
const TRANSACTION_STATUSES = ['draft', 'submitted', 'approved', 'posted', 'returned', 'rejected']
const BASE_CURRENCY_CODE = 'USD'
const FX_REVALUATION_EPSILON = 0.01
const DEFAULT_CURRENCY_MASTER = [
  { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 1, baseCurrency: true },
  { code: 'EUR', name: 'Euro', symbol: 'EUR', exchangeRate: 1.08, baseCurrency: false },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED', exchangeRate: 0.2723, baseCurrency: false },
  { code: 'UZS', name: 'Uzbekistan Som', symbol: 'UZS', exchangeRate: 0.000078, baseCurrency: false },
]

const toMoney = (value) => Number(Number(value || 0).toFixed(2))
const toQty = (value) => Number(Number(value || 0).toFixed(6))
const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

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

const sanitizeOptionalRef = (value) => (value ? value : null)
const normalizeMetalFixStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (['fixed', 'fixing'].includes(normalized)) return 'fixed'
  if (['unfixed', 'unfix', 'non-fixing', 'non_fixing', 'nonfixing'].includes(normalized)) return 'unfixed'
  return ''
}

const DIRECT_DEAL_STOCK_TO_OZ = {
  OZ: 1,
  GRAM: 0.0321507,
  KG: 32.1507,
}

const MAX_TRANSACTION_AMOUNT = Number(process.env.MAX_TRANSACTION_AMOUNT || 1_000_000_000)
const MAX_EXCHANGE_RATE = Number(process.env.MAX_EXCHANGE_RATE || 1_000_000)
const MAX_ACCOUNT_CODE_GENERATION_ATTEMPTS = Number(process.env.MAX_ACCOUNT_CODE_GENERATION_ATTEMPTS || 1000)
const MAX_ACCOUNT_HIERARCHY_DEPTH = Number(process.env.MAX_ACCOUNT_HIERARCHY_DEPTH || 10)

const normalizeDirectDealStockCode = (value) => String(value || 'OZ').trim().toUpperCase()
const directDealEqOzFromQtyAndStock = (qty, stockCode) => {
  const ratio = DIRECT_DEAL_STOCK_TO_OZ[normalizeDirectDealStockCode(stockCode)] || 1
  return Number(qty || 0) * ratio
}

const normalizeMoneyValue = (value, field = 'amount') => {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) throw new Error(`Invalid ${field}`)
  if (num > MAX_TRANSACTION_AMOUNT) throw new Error(`${field} exceeds allowed maximum`)
  return num
}

const normalizeExchangeRateValue = (value, field = 'exchange rate') => {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) throw new Error(`Invalid ${field}`)
  if (num > MAX_EXCHANGE_RATE) throw new Error(`${field} exceeds allowed maximum`)
  return num
}

const ensureBaseCurrencyConfig = async () => {
  let base = await Currency.findOne({ baseCurrency: true, isActive: true })

  if (!base) {
    base = await Currency.findOneAndUpdate(
      { code: BASE_CURRENCY_CODE },
      {
        $set: {
          code: BASE_CURRENCY_CODE,
          name: 'US Dollar',
          symbol: '$',
          baseCurrency: true,
          exchangeRate: 1,
          isActive: true,
          rateUpdatedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
  }

  await Currency.updateMany(
    { _id: { $ne: base._id }, baseCurrency: true },
    { $set: { baseCurrency: false } }
  )

  if (String(base.exchangeRate || 1) !== '1') {
    base.exchangeRate = 1
    base.rateUpdatedAt = new Date()
    await base.save()
  }

  return base
}

const ensureDefaultCurrencyMaster = async () => {
  const base = await ensureBaseCurrencyConfig()
  const now = new Date()
  let createdCount = 0
  let normalizedCount = 0

  for (const preset of DEFAULT_CURRENCY_MASTER) {
    if (preset.baseCurrency) continue

    const existing = await Currency.findOne({ code: preset.code })
    if (!existing) {
      await Currency.create({
        code: preset.code,
        name: preset.name,
        symbol: preset.symbol,
        exchangeRate: preset.exchangeRate,
        baseCurrency: false,
        isActive: true,
        rateUpdatedAt: now,
      })
      createdCount += 1
      continue
    }

    let changed = false
    if (String(existing.name || '').trim() !== preset.name) {
      existing.name = preset.name
      changed = true
    }
    if (String(existing.symbol || '').trim() !== preset.symbol) {
      existing.symbol = preset.symbol
      changed = true
    }
    if (existing.baseCurrency) {
      existing.baseCurrency = false
      changed = true
    }
    if (existing.isActive !== true) {
      existing.isActive = true
      changed = true
    }
    const nextRate = Number(existing.exchangeRate || 0)
    if (!Number.isFinite(nextRate) || nextRate <= 0) {
      existing.exchangeRate = preset.exchangeRate
      changed = true
    }

    if (changed) {
      existing.rateUpdatedAt = now
      await existing.save()
      normalizedCount += 1
    }
  }

  return { base, createdCount, normalizedCount }
}

const ensureExchangeDifferenceAccounts = async (user) => {
  const gain = await ensureAccountByCode({
    user,
    code: '4190',
    name: 'Exchange Gain',
    accountType: 'Income',
    currency: BASE_CURRENCY_CODE,
  })

  const loss = await ensureAccountByCode({
    user,
    code: '5190',
    name: 'Exchange Loss',
    accountType: 'Expense',
    currency: BASE_CURRENCY_CODE,
  })

  return { gain, loss }
}

const nextDirectDealDocNo = async () => {
  const year = new Date().getFullYear()
  const prefix = `ORD/${year}/`
  const latest = await DirectDeal.findOne({ docNo: new RegExp(`^${prefix}`) })
    .sort({ createdAt: -1 })
    .select('docNo')
    .lean()

  const seq = Number((latest?.docNo || '').split('/').pop() || 0) + 1
  return `${prefix}${String(seq).padStart(6, '0')}`
}

const getRoleTransactionTypes = (user) => {
  if (isSuperAdmin(user) || isFinance(user)) return TRANSACTION_TYPES
  if (isSales(user)) return ['sale', 'receipt']
  if (isOperations(user) || isProduction(user)) return ['purchase', 'expense']
  if (isHR(user)) return ['payroll']
  return []
}

const getMappedAccountIds = async (user) => {
  const dept = String(user?.department || '').trim().toLowerCase()
  const mappings = await AccountMapping.find({ isActive: true })
    .select('debitAccountId creditAccountId department')
    .populate('debitAccountId', 'department')
    .populate('creditAccountId', 'department')
    .lean()

  const canIncludeAccount = (account) => {
    if (!account) return false
    const accountDept = String(account.department || '').trim().toLowerCase()
    if (!dept) return true
    return !accountDept || accountDept === dept
  }

  const ids = new Set()
  mappings.forEach((mapping) => {
    const mappingDept = String(mapping.department || '').trim().toLowerCase()
    const mappingMatchesDepartment = !dept || !mappingDept || mappingDept === dept
    const useAccountFallback = !mappingDept
    if (!mappingMatchesDepartment) return
    if (canIncludeAccount(mapping.debitAccountId) || (useAccountFallback && canIncludeAccount(mapping.debitAccountId))) {
      ids.add(String(mapping.debitAccountId._id || mapping.debitAccountId))
    }
    if (canIncludeAccount(mapping.creditAccountId) || (useAccountFallback && canIncludeAccount(mapping.creditAccountId))) {
      ids.add(String(mapping.creditAccountId._id || mapping.creditAccountId))
    }
  })
  return Array.from(ids)
}

const getAccountSummaryScope = async (user) => {
  if (isSuperAdmin(user) || isFinance(user) || isDepartmentHead(user)) return null
  return []
}

const validateTransactionPayload = (payload) => {
  const hasDirectPartyAccount = Boolean(
    payload.partyAccountId
    || payload.voucherMeta?.partyAccountId
    || String(payload.voucherMeta?.partyCode || '').trim()
  )

  if (!TRANSACTION_TYPES.includes(String(payload.type || ''))) {
    return 'Invalid transaction type'
  }

  const amount = Number(payload.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Amount must be greater than zero'
  }

  if (payload.type === 'receipt' && !payload.customerId && !hasDirectPartyAccount) {
    return 'Customer is required for receipts'
  }

  if (payload.type === 'sale' && !payload.customerId && !payload.vendorId && !hasDirectPartyAccount) {
    return 'Customer or vendor is required for sales'
  }

  if (payload.type === 'purchase' && !payload.vendorId && !payload.customerId && !hasDirectPartyAccount) {
    return 'Vendor or customer is required for purchases'
  }

  if (payload.type === 'payment' && !payload.vendorId && !payload.customerId && !hasDirectPartyAccount) {
    return 'Vendor or customer is required for payments'
  }

  return ''
}

const ensureAccountByCode = async ({ user, code, name, accountType, currency = BASE_CURRENCY_CODE }) => {
  let account = await ChartOfAccount.findOne({ accountCode: code })
  if (!account) {
    try {
      account = await ChartOfAccount.create({
        accountName: name,
        accountCode: code,
        accountType,
        currency,
        description: `Auto-created default account for ${name}`,
        createdBy: user._id,
      })
    } catch (err) {
      if (err?.code !== 11000) throw err
      // Another request may have created it in parallel; reuse the existing row.
      account = await ChartOfAccount.findOne({ accountCode: code })
    }
  }

  if (!account) {
    throw new Error(`Unable to resolve account code ${code}`)
  }

  if (!account.isActive) {
    account.isActive = true
    await account.save()
  }

  return account
}

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const nextGeneratedAccountCode = async (prefix) => {
  const normalizedPrefix = String(prefix || '').trim()
  if (!normalizedPrefix) throw new Error('Account code prefix is required')

  const pattern = new RegExp(`^${escapeRegex(normalizedPrefix)}\\d{4}$`)
  const latest = await ChartOfAccount.findOne({ accountCode: pattern })
    .sort({ accountCode: -1 })
    .select('accountCode')
    .lean()

  let seq = latest ? Number(String(latest.accountCode).slice(normalizedPrefix.length) || 0) + 1 : 1
  let code = ''
  let attempts = 0
  // Keep retry deterministic in very rare parallel races.
  while (!code || await ChartOfAccount.exists({ accountCode: code })) {
    attempts += 1
    if (attempts > MAX_ACCOUNT_CODE_GENERATION_ATTEMPTS) {
      throw new Error('Unable to generate account code. Please retry.')
    }
    code = `${normalizedPrefix}${String(seq).padStart(4, '0')}`
    seq += 1
  }
  return code
}

const validateAccountParentAssignment = async ({ accountId = null, parentAccountId = null, accountType = null }) => {
  if (!parentAccountId) return

  const accountKey = accountId ? String(accountId) : ''
  let cursorId = parentAccountId
  let depth = 0
  const seen = new Set(accountKey ? [accountKey] : [])
  let isDirectParent = true

  while (cursorId) {
    const key = String(cursorId)
    if (seen.has(key)) {
      throw new Error('Circular account hierarchy is not allowed')
    }
    seen.add(key)

    const cursor = await ChartOfAccount.findById(cursorId).select('parentAccountId accountType')
    if (!cursor) {
      throw new Error('Parent account not found')
    }

    if (isDirectParent && accountType && String(cursor.accountType || '') !== String(accountType)) {
      throw new Error(`Parent account type must match selected account type (${accountType})`)
    }

    depth += 1
    if (depth > MAX_ACCOUNT_HIERARCHY_DEPTH) {
      throw new Error(`Account hierarchy depth cannot exceed ${MAX_ACCOUNT_HIERARCHY_DEPTH}`)
    }

    cursorId = cursor.parentAccountId || null
    isDirectParent = false
  }
}

const ensureChildAccountByName = async ({ user, parentAccount, accountType, accountName, codePrefix, currency = BASE_CURRENCY_CODE }) => {
  const existing = await ChartOfAccount.findOne({
    parentAccountId: parentAccount?._id || null,
    accountType,
    accountName: new RegExp(`^${escapeRegex(accountName)}$`, 'i'),
  })

  if (existing) {
    if (!existing.isActive) {
      existing.isActive = true
      await existing.save()
    }
    return existing
  }

  const accountCode = await nextGeneratedAccountCode(codePrefix)
  return ChartOfAccount.create({
    accountName,
    accountCode,
    accountType,
    parentAccountId: parentAccount?._id || null,
    currency,
    description: `Auto-created fixing sub account: ${accountName}`,
    createdBy: user._id,
  })
}

const metalDisplayName = (metal) => {
  const code = String(metal || 'XAU').trim().toUpperCase()
  if (code === 'XAG') return 'Silver'
  if (code === 'XPT') return 'Platinum'
  if (code === 'XPD') return 'Palladium'
  if (code === 'XAU') return 'Gold'
  return code || 'Metal'
}

const resolveDirectDealCustomer = async (line, lineNumber) => {
  const customerId = sanitizeOptionalRef(line.customerId)
  if (!customerId) {
    throw new Error(`Line ${lineNumber}: customer selection is required`)
  }

  const customer = await Customer.findOne({ _id: customerId, isActive: true })
    .populate('ledgerAccountId', 'accountCode accountName accountType isActive')

  if (!customer) throw new Error(`Line ${lineNumber}: customer not found or inactive`)
  if (!customer.ledgerAccountId) throw new Error(`Line ${lineNumber}: customer ledger account is not configured`)

  return customer
}

const normalizeDirectDealLine = async (line, idx) => {
  const lineNumber = idx + 1
  const customer = await resolveDirectDealCustomer(line, lineNumber)

  const qty = Number(line.qty || 0)
  const price = Number(line.price || 0)
  const stockCode = normalizeDirectDealStockCode(line.stockCode)
  const eqOz = Number(line.eqOz || directDealEqOzFromQtyAndStock(qty, stockCode) || 0)
  const amount = Number(line.amount || (eqOz * price) || 0)
  const direction = String(line.direction || '').toLowerCase()
  if (!['buy', 'sell'].includes(direction)) {
    throw new Error(`Line ${lineNumber}: direction must be buy or sell`)
  }
  if (!Number.isFinite(qty) || qty <= 0) throw new Error(`Line ${lineNumber}: quantity must be greater than zero`)
  if (!Number.isFinite(price) || price <= 0) throw new Error(`Line ${lineNumber}: price must be greater than zero`)

  return {
    customerId: customer._id,
    customerCode: String(line.customerCode || customer.ledgerAccountId?.accountCode || '').trim(),
    customerName: String(line.customerName || customer.name || '').trim(),
    direction,
    metal: String(line.metal || 'XAU').toUpperCase(),
    qty: toQty(qty),
    stockCode,
    price: toMoney(price),
    eqOz: toQty(eqOz),
    amount: toMoney(amount),
    notes: String(line.notes || '').trim(),
  }
}

const syncDirectDealLedger = async ({ deal, user }) => {
  await Ledger.updateMany(
    { referenceType: 'direct_deal', referenceId: deal._id, isDeleted: { $ne: true } },
    { $set: { isDeleted: true, deletedAt: new Date(), updatedBy: user._id } }
  )

  if (String(deal.status || '') !== 'confirmed') return

  const salesRevenueParent = await ensureAccountByCode({
    user,
    code: '4000',
    name: 'Sales Revenue',
    accountType: 'Income',
    currency: deal.currency || BASE_CURRENCY_CODE,
  })
  const costOfSalesParent = await ensureAccountByCode({
    user,
    code: '5101',
    name: 'Cost Of Goods Sold',
    accountType: 'Expense',
    currency: deal.currency || BASE_CURRENCY_CODE,
  })

  const subAccountCache = new Map()
  const normalizedDate = deal.valueDate || deal.docDate || new Date()
  const lines = Array.isArray(deal.lineItems) ? deal.lineItems : []

  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx]
    const customer = await resolveDirectDealCustomer(line, idx + 1)
    const direction = String(line.direction || '').toLowerCase()
    const metal = String(line.metal || 'XAU').toUpperCase()
    // Direction is customer direction:
    // buy  => company sells to customer (Sales Fixing)
    // sell => company buys from customer (Purchase Fixing)
    const accountType = direction === 'buy' ? 'Income' : 'Expense'
    const parentAccount = direction === 'buy' ? salesRevenueParent : costOfSalesParent
    const directionLabel = direction === 'buy' ? 'Sales' : 'Purchase'
    const accountName = `${metalDisplayName(metal)} ${directionLabel} Fixing`
    const cacheKey = `${direction}:${metal}`

    let fixingAccount = subAccountCache.get(cacheKey)
    if (!fixingAccount) {
      fixingAccount = await ensureChildAccountByName({
        user,
        parentAccount,
        accountType,
        accountName,
        codePrefix: direction === 'buy' ? '91' : '92',
        currency: deal.currency || BASE_CURRENCY_CODE,
      })
      subAccountCache.set(cacheKey, fixingAccount)
    }

    const amount = toMoney(Number(line.amount || (Number(line.qty || 0) * Number(line.price || 0)) || 0))
    if (amount <= 0) continue

    const isCustomerBuy = direction === 'buy'
    const debitAccountId = isCustomerBuy ? customer.ledgerAccountId._id : fixingAccount._id
    const creditAccountId = isCustomerBuy ? fixingAccount._id : customer.ledgerAccountId._id

    await Ledger.create({
      date: normalizedDate,
      debitAccountId,
      creditAccountId,
      amount,
      description: `${deal.docNo} ${direction.toUpperCase()} ${metal} fixing - ${customer.name}`,
      referenceType: 'direct_deal',
      referenceId: deal._id,
      createdBy: user._id,
      updatedBy: user._id,
      department: user.department || deal.branch || '',
      currency: deal.currency || BASE_CURRENCY_CODE,
      exchangeRate: 1,
      notes: `Direct deal line ${idx + 1}`,
    })
  }
}

const resolveVoucherInventoryLineQuantity = (line = {}) => {
  const grossWeight = Number(line.grossWeight || 0)
  if (grossWeight > 0) return toQty(grossWeight)

  const pureWeight = Number(line.pureWeight || 0)
  if (pureWeight > 0) return toQty(pureWeight)

  const pcs = Number(line.pcs || 0)
  if (pcs > 0) return toQty(pcs)

  return 0
}

const resolveVoucherInventoryLineAmount = (line = {}) => {
  const candidates = [line.amountLC, line.totalAmount, line.metalAmount, line.amountFC, line.amountWithVAT]
  for (const candidate of candidates) {
    const amount = Number(candidate || 0)
    if (Number.isFinite(amount) && amount > 0) return toMoney(amount)
  }
  return 0
}

const resolveVoucherInventoryItems = async (tx) => {
  const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
  const resolved = []

  for (const line of lines) {
    const stockCode = String(line?.stockCode || '').trim()
    const productType = String(line?.productType || '').trim()
    if (!stockCode && !productType) continue

    const item = await InventoryItem.findOne({
      isDeleted: { $ne: true },
      $or: [
        ...(stockCode ? [{ sku: stockCode }] : []),
        ...(productType ? [{ name: productType }] : []),
      ],
    })
    if (!item) continue

    const quantity = resolveVoucherInventoryLineQuantity(line)
    if (quantity <= 0) continue

    resolved.push({
      line,
      item,
      quantity,
      lineAmount: resolveVoucherInventoryLineAmount(line),
    })
  }

  return resolved
}

const prepareVoucherInventoryImpact = async ({ user, tx }) => {
  const transactionType = String(tx?.type || '').toLowerCase()
  if (!['sale', 'purchase'].includes(transactionType)) {
    return { inventoryPlans: [], purchaseDebitAccountId: null, cogsAccountId: null }
  }

  const resolvedLines = await resolveVoucherInventoryItems(tx)
  if (!resolvedLines.length) {
    return { inventoryPlans: [], purchaseDebitAccountId: null, cogsAccountId: null }
  }

  const defaultInventoryAccount = await ensureAccountByCode({
    user,
    code: '1300',
    name: 'Metal Inventory',
    accountType: 'Asset',
    currency: tx.currency || BASE_CURRENCY_CODE,
  })
  const cogsAccount = transactionType === 'sale'
    ? await ensureAccountByCode({
      user,
      code: '5101',
      name: 'Cost Of Goods Sold',
      accountType: 'Expense',
      currency: tx.currency || BASE_CURRENCY_CODE,
    })
    : null

  const inventoryPlans = resolvedLines.map(({ line, item, quantity, lineAmount }) => {
    const inventoryAccountId = item.ledgerAccountId || defaultInventoryAccount._id

    return {
      line,
      item,
      quantity,
      lineAmount,
      inventoryAccountId,
      costAmount: transactionType === 'sale' ? toMoney(quantity * Number(item.unitCost || 0)) : 0,
    }
  })

  return {
    inventoryPlans,
    purchaseDebitAccountId: inventoryPlans[0]?.inventoryAccountId || null,
    cogsAccountId: cogsAccount?._id || null,
  }
}

const applyVoucherInventoryImpact = async ({ user, tx, preparedImpact }) => {
  const transactionType = String(tx?.type || '').toLowerCase()
  const plans = Array.isArray(preparedImpact?.inventoryPlans) ? preparedImpact.inventoryPlans : []
  if (!plans.length || !['sale', 'purchase'].includes(transactionType)) return

  const fixingType = String(tx?.voucherMeta?.fixingType || tx?.metalFixStatus || 'fixed').toLowerCase()
  const isUnfixed = ['unfixed', 'non-fixing', 'nonfixing', 'non_fixing'].includes(fixingType)
  const fixLabel = isUnfixed ? 'UNFIXED' : 'FIXED'

  // Process stock movements for BOTH fixed and unfixed sale/purchase vouchers.
  for (const plan of plans) {
    const item = await InventoryItem.findById(plan.item._id)
    if (!item || item.isDeleted) continue

    const beforeQty = Number(item.quantity || 0)
    const movementQty = Number(plan.quantity || 0)

    if (transactionType === 'purchase') {
      const nextQty = toQty(beforeQty + movementQty)
      const currentValue = beforeQty * Number(item.unitCost || 0)
      const incomingValue = Number(plan.lineAmount || 0)
      item.quantity = nextQty
      item.lastRestockedAt = tx.date || new Date()
      item.updatedBy = user._id
      if (incomingValue > 0 && nextQty > 0) {
        item.unitCost = toMoney((currentValue + incomingValue) / nextQty)
      }
      await item.save()

      await StockMovement.create({
        itemId: item._id,
        itemName: item.name,
        change: movementQty,
        quantityBefore: beforeQty,
        quantityAfter: nextQty,
        reason: `Voucher purchase (${fixLabel})${tx.voucherMeta?.vocNo ? ` #${tx.voucherMeta.vocNo}` : ''}`,
        actorId: user._id,
        actorName: user.name,
      })
      continue
    }

    const nextQty = toQty(beforeQty - movementQty)
    item.quantity = nextQty
    item.updatedBy = user._id
    await item.save()

    await StockMovement.create({
      itemId: item._id,
      itemName: item.name,
      change: -movementQty,
      quantityBefore: beforeQty,
      quantityAfter: nextQty,
      reason: `Voucher sale (${fixLabel})${tx.voucherMeta?.vocNo ? ` #${tx.voucherMeta.vocNo}` : ''}`,
      actorId: user._id,
      actorName: user.name,
    })

    // Create COGS ledger entry: debit COGS expense, credit inventory asset
    const cogsAmount = Number(plan.costAmount || 0)
    const cogsAccountId = preparedImpact?.cogsAccountId || null
    const inventoryAccountId = plan.inventoryAccountId || item.ledgerAccountId || null
    if (cogsAmount > 0 && cogsAccountId && inventoryAccountId) {
      await Ledger.create({
        date: tx.voucherMeta?.valueDate || tx.date || new Date(),
        debitAccountId: cogsAccountId,
        creditAccountId: inventoryAccountId,
        amount: cogsAmount,
        description: `COGS for ${item.name}${tx.voucherMeta?.vocNo ? ` #${tx.voucherMeta.vocNo}` : ''}`,
        referenceType: 'cogs',
        referenceId: tx._id,
        createdBy: user._id,
        updatedBy: user._id,
        department: user.department || tx.department || '',
        currency: tx.currency || 'USD',
        exchangeRate: Number(tx.exchangeRate || 1),
      })
    }
  }
}

const resolveVoucherLineVatAmount = (line = {}) => {
  const vatAmountLC = Number(line.vatAmountLC || 0)
  if (Number.isFinite(vatAmountLC) && vatAmountLC > 0) return vatAmountLC

  const vatAmountFC = Number(line.vatAmountFC || 0)
  const currRate = Number(line.currRate || 0)
  if (Number.isFinite(vatAmountFC) && vatAmountFC > 0 && Number.isFinite(currRate) && currRate > 0) {
    return vatAmountFC * currRate
  }

  const amountWithVAT = Number(line.amountWithVAT || 0)
  const totalAmount = Number(line.totalAmount || line.amountLC || 0)
  if (Number.isFinite(amountWithVAT) && Number.isFinite(totalAmount) && amountWithVAT > totalAmount) {
    return amountWithVAT - totalAmount
  }

  return 0
}

const resolveVoucherVatAmount = (tx) => {
  const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
  if (!lines.length) return 0

  const total = lines.reduce((sum, line) => sum + resolveVoucherLineVatAmount(line), 0)
  return toMoney(total)
}

const resolveVatPostingAccounts = async ({ user, tx, resolvedAccounts }) => {
  const transactionType = String(tx?.type || '').toLowerCase()

  if (transactionType === 'sale') {
    const mapping = await AccountMapping.findOne({ mappingType: 'vat_output', isActive: true })
      .select('debitAccountId creditAccountId')
      .lean()

    let debitAccountId = resolvedAccounts?.debitAccountId || null
    let creditAccountId = mapping?.creditAccountId || null

    if (mapping?.debitAccountId) debitAccountId = mapping.debitAccountId
    if (!debitAccountId) {
      const receivable = await ensureAccountByCode({
        user,
        code: '1100',
        name: 'Accounts Receivable',
        accountType: 'Asset',
        currency: tx.currency || BASE_CURRENCY_CODE,
      })
      debitAccountId = receivable._id
    }
    if (!creditAccountId) {
      const vatPayable = await ensureAccountByCode({
        user,
        code: '2190',
        name: 'VAT Payable',
        accountType: 'Liability',
        currency: tx.currency || BASE_CURRENCY_CODE,
      })
      creditAccountId = vatPayable._id
    }

    return {
      referenceType: 'vat_output',
      debitAccountId,
      creditAccountId,
    }
  }

  if (transactionType === 'purchase') {
    const mapping = await AccountMapping.findOne({ mappingType: 'vat_input', isActive: true })
      .select('debitAccountId creditAccountId')
      .lean()

    let debitAccountId = mapping?.debitAccountId || null
    let creditAccountId = resolvedAccounts?.creditAccountId || null

    if (mapping?.creditAccountId) creditAccountId = mapping.creditAccountId
    if (!debitAccountId) {
      const vatReceivable = await ensureAccountByCode({
        user,
        code: '1190',
        name: 'VAT Receivable',
        accountType: 'Asset',
        currency: tx.currency || BASE_CURRENCY_CODE,
      })
      debitAccountId = vatReceivable._id
    }
    if (!creditAccountId) {
      const payable = await ensureAccountByCode({
        user,
        code: '2000',
        name: 'Accounts Payable',
        accountType: 'Liability',
        currency: tx.currency || BASE_CURRENCY_CODE,
      })
      creditAccountId = payable._id
    }

    return {
      referenceType: 'vat_input',
      debitAccountId,
      creditAccountId,
    }
  }

  return null
}

const applyVoucherVatImpact = async ({ user, tx, resolvedAccounts }) => {
  const transactionType = String(tx?.type || '').toLowerCase()
  if (!['sale', 'purchase'].includes(transactionType)) return null

  await Ledger.updateMany(
    {
      referenceType: { $in: ['vat_output', 'vat_input'] },
      referenceId: tx._id,
      isDeleted: { $ne: true },
    },
    { $set: { isDeleted: true, deletedAt: new Date(), updatedBy: user._id } }
  )

  const vatAmount = resolveVoucherVatAmount(tx)
  if (!Number.isFinite(vatAmount) || vatAmount <= 0) return null

  const posting = await resolveVatPostingAccounts({ user, tx, resolvedAccounts })
  if (!posting?.debitAccountId || !posting?.creditAccountId) {
    throw new Error('Unable to resolve VAT posting accounts')
  }
  if (String(posting.debitAccountId) === String(posting.creditAccountId)) {
    throw new Error('VAT posting debit and credit accounts cannot be identical')
  }

  return Ledger.create({
    date: tx.voucherMeta?.valueDate || tx.date || new Date(),
    debitAccountId: posting.debitAccountId,
    creditAccountId: posting.creditAccountId,
    amount: vatAmount,
    description: `Auto VAT ${transactionType === 'sale' ? 'output' : 'input'} for transaction ${tx._id}`,
    referenceType: posting.referenceType,
    referenceId: tx._id,
    createdBy: user._id,
    updatedBy: user._id,
    department: user.department || tx.department || '',
    currency: tx.currency || BASE_CURRENCY_CODE,
    exchangeRate: Number(tx.exchangeRate || 1),
    notes: 'Auto VAT split from voucher line amounts.',
  })
}

const buildVendorAdvanceConfirmationError = ({ account, outstandingBefore, paymentAmount, projectedBalance, currencyCode }) => {
  const payableOutstanding = Math.max(0, Number(-outstandingBefore || 0))
  const paymentShortfall = Math.max(0, Number(paymentAmount || 0) - payableOutstanding)
  const advanceAmount = Math.max(0, Number(projectedBalance || 0))
  const err = new Error(
    payableOutstanding > 0
      ? `Current outstanding payable for ${account.accountCode} - ${account.accountName} is ${toMoney(payableOutstanding).toLocaleString()} ${currencyCode}. This payment is ${toMoney(paymentAmount).toLocaleString()} ${currencyCode}, so the shortfall of ${toMoney(paymentShortfall).toLocaleString()} ${currencyCode} will be posted as a vendor advance. Result after posting: ${toMoney(advanceAmount).toLocaleString()} ${currencyCode} Dr. Continue?`
      : `No outstanding payable was found for ${account.accountCode} - ${account.accountName}. This full payment of ${toMoney(paymentAmount).toLocaleString()} ${currencyCode} will be posted as a vendor advance. Result after posting: ${toMoney(advanceAmount).toLocaleString()} ${currencyCode} Dr. Continue?`
  )
  err.status = 409
  err.code = 'VENDOR_ADVANCE_CONFIRMATION_REQUIRED'
  err.details = {
    accountCode: account.accountCode,
    accountName: account.accountName,
    outstandingBefore: toMoney(outstandingBefore),
    paymentAmount: toMoney(paymentAmount),
    projectedBalance: toMoney(projectedBalance),
    payableOutstanding: toMoney(payableOutstanding),
    paymentShortfall: toMoney(paymentShortfall),
    advanceAmount: toMoney(advanceAmount),
  }
  return err
}

const ensurePaymentAdvanceConfirmed = async ({ tx, resolvedAccounts, confirmed }) => {
  if (confirmed || String(tx?.type || '').toLowerCase() !== 'payment' || !resolvedAccounts?.debitAccountId) return

  const debitAccount = await ChartOfAccount.findById(resolvedAccounts.debitAccountId)
    .select('accountCode accountName accountType isActive')
    .lean()

  if (!debitAccount || String(debitAccount.accountType || '').toLowerCase() !== 'liability') return

  const txCurrency = await Currency.findOne({ code: String(tx.currency || 'USD').toUpperCase(), isActive: true }).select('exchangeRate').lean()
  const baseCurrency = await Currency.findOne({ baseCurrency: true, isActive: true }).select('code').lean()
  const exchangeRate = normalizeExchangeRateValue(tx.exchangeRate ?? txCurrency?.exchangeRate ?? 1)
  const paymentAmount = normalizeMoneyValue(tx.amount, 'amount') * exchangeRate
  const outstandingBefore = Number(await getOutstandingForAccount(resolvedAccounts.debitAccountId) || 0)
  const projectedBalance = outstandingBefore + paymentAmount

  if (projectedBalance > 0) {
    throw buildVendorAdvanceConfirmationError({
      account: debitAccount,
      outstandingBefore,
      paymentAmount,
      projectedBalance,
      currencyCode: String(baseCurrency?.code || BASE_CURRENCY_CODE || 'USD').toUpperCase(),
    })
  }
}

const transactionUploadDir = path.resolve(process.env.TRANSACTION_UPLOAD_DIR || path.join(__dirname, '../uploads/transactions'))
fs.mkdirSync(transactionUploadDir, { recursive: true })

const bankSlipUploadDir = path.resolve(process.env.BANK_SLIP_UPLOAD_DIR || path.join(__dirname, '../uploads/bank-slips'))
fs.mkdirSync(bankSlipUploadDir, { recursive: true })

const bankSlipUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, bankSlipUploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '')
      cb(null, `bankslip-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`)
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
    if (allowed.includes(file.mimetype)) return cb(null, true)
    cb(new Error('Only PDF, PNG, JPG, WEBP files are allowed for bank slips'))
  },
})

const transactionUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, transactionUploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '')
      const base = path.basename(file.originalname || 'attachment', ext).replace(/[^a-zA-Z0-9-_]+/g, '-').slice(0, 48) || 'attachment'
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${base}${ext}`)
    },
  }),
  limits: { fileSize: Number(process.env.TRANSACTION_ATTACHMENT_MAX_BYTES || 10 * 1024 * 1024) },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'text/plain',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    if (allowed.includes(file.mimetype)) return cb(null, true)
    cb(new Error('Unsupported attachment type'))
  },
})

const detectAttachmentSignature = (filePath) => {
  const fd = fs.openSync(filePath, 'r')
  try {
    const header = Buffer.alloc(16)
    const bytesRead = fs.readSync(fd, header, 0, 16, 0)
    const b = header.slice(0, bytesRead)

    if (b.length >= 4 && b.toString('ascii', 0, 4) === '%PDF') return 'pdf'
    if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 && b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A) return 'png'
    if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpeg'
    if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp'
    if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4B && b[2] === 0x03 && b[3] === 0x04) return 'zip'
    if (b.length >= 8 && b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11 && b[3] === 0xE0 && b[4] === 0xA1 && b[5] === 0xB1 && b[6] === 0x1A && b[7] === 0xE1) return 'ole'

    return 'unknown'
  } finally {
    fs.closeSync(fd)
  }
}

const isLikelyTextFile = (filePath) => {
  const fd = fs.openSync(filePath, 'r')
  try {
    const sample = Buffer.alloc(1024)
    const bytesRead = fs.readSync(fd, sample, 0, 1024, 0)
    const b = sample.slice(0, bytesRead)
    if (!b.length) return true

    let suspicious = 0
    for (const byte of b) {
      const isControl = byte < 9 || (byte > 13 && byte < 32)
      if (isControl) suspicious += 1
    }
    return (suspicious / b.length) < 0.05
  } finally {
    fs.closeSync(fd)
  }
}

const validateAttachmentContent = (file) => {
  const sig = detectAttachmentSignature(file.path)
  const mime = String(file.mimetype || '')

  if (mime === 'application/pdf') return sig === 'pdf'
  if (mime === 'image/png') return sig === 'png'
  if (mime === 'image/jpeg') return sig === 'jpeg'
  if (mime === 'image/webp') return sig === 'webp'
  if (mime === 'text/plain' || mime === 'text/csv') return isLikelyTextFile(file.path)
  if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return sig === 'zip'
  if (mime === 'application/vnd.ms-excel' || mime === 'application/msword') return sig === 'ole' || sig === 'zip'

  return false
}

const resolveBackendBaseUrl = (req) => {
  const configured = String(process.env.SERVER_BASE_URL || '').trim()
  if (configured) return configured.replace(/\/+$/, '')

  if (req) {
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
    const proto = forwardedProto || req.protocol || 'http'
    const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim()
    const host = forwardedHost || req.get('host')
    if (host) return `${proto}://${host}`
  }

  return ''
}

const buildTransactionAttachment = (req, file, user) => {
  const relativePath = `/uploads/transactions/${file.filename}`
  const backendBaseUrl = resolveBackendBaseUrl(req)
  return {
    originalName: file.originalname,
    fileName: file.filename,
    relativePath,
    url: backendBaseUrl ? `${backendBaseUrl}${relativePath}` : relativePath,
    mimeType: file.mimetype || 'application/octet-stream',
    size: Number(file.size || 0),
    uploadedBy: user._id,
    uploadedAt: new Date(),
  }
}

const populateTransactionQuery = (query) => query
  .populate('customerId', 'name')
  .populate('vendorId', 'name')
  .populate('inventoryItemId', 'name sku')
  .populate('debitAccountId', 'accountCode accountName')
  .populate('creditAccountId', 'accountCode accountName')
  .populate('mappingId', 'mappingType description')
  .populate('createdBy', 'name')
  .populate('approvedBy', 'name')
  .populate('postedBy', 'name')
  .populate('attachments.uploadedBy', 'name')
  .populate('comments.createdBy', 'name')
  .populate('auditTrail.actorId', 'name')

const applyTransactionWorkflowAction = async (tx, user, action, options = {}) => {
  const note = normalizeTransactionNote(options.comment)
  const fromStatus = tx.status

  if (action === 'submit') {
    if (!['draft', 'returned', 'rejected'].includes(tx.status)) throw new Error('Only draft, returned, or rejected transactions can be submitted')
    tx.status = 'submitted'
    tx.updatedBy = user._id
    appendTransactionComment(tx, user, note, 'submit_note')
    appendTransactionAudit(tx, user, 'submit', { fromStatus, toStatus: 'submitted', comment: note })
    await tx.save()
    return { transaction: tx }
  }

  if (action === 'approve') {
    if (!isSuperAdmin(user) && !isFinance(user)) throw new Error('Only Admin/Finance can approve transactions')
    if (tx.status !== 'submitted') throw new Error('Only submitted transactions can be approved')
    tx.status = 'approved'
    tx.approvedBy = user._id
    tx.updatedBy = user._id
    appendTransactionComment(tx, user, note, 'approval_note')
    appendTransactionAudit(tx, user, 'approve', { fromStatus, toStatus: 'approved', comment: note })
    await tx.save()
    return { transaction: tx }
  }

  if (action === 'return') {
    if (!isSuperAdmin(user) && !isFinance(user)) throw new Error('Only Admin/Finance can return transactions for edit')
    if (!['submitted', 'approved'].includes(tx.status)) throw new Error('Only submitted or approved transactions can be returned for edit')
    if (!note) throw new Error('Return reason is required')
    tx.status = 'returned'
    tx.updatedBy = user._id
    appendTransactionComment(tx, user, note, 'return_note')
    appendTransactionAudit(tx, user, 'return', { fromStatus, toStatus: 'returned', comment: note })
    await tx.save()
    return { transaction: tx }
  }

  if (action === 'reject') {
    if (!isSuperAdmin(user) && !isFinance(user)) throw new Error('Only Admin/Finance can reject transactions')
    if (!['submitted', 'approved', 'returned'].includes(tx.status)) throw new Error('Only submitted, approved, or returned transactions can be rejected')
    if (!note) throw new Error('Rejection reason is required')
    tx.status = 'rejected'
    tx.updatedBy = user._id
    appendTransactionComment(tx, user, note, 'reject_note')
    appendTransactionAudit(tx, user, 'reject', { fromStatus, toStatus: 'rejected', comment: note })
    await tx.save()
    return { transaction: tx }
  }

  if (action === 'post') {
    return transactionPostingService.executePostWorkflowAction({
      tx,
      user,
      note,
      fromStatus,
      options,
    })
  }

  throw new Error('Unsupported transaction action')
}

// Customers
const canViewCustomers = (user) => isSuperAdmin(user) || isFinance(user) || isSales(user)
const canManageCustomers = (user) => isSuperAdmin(user) || isFinance(user) || isSales(user)

const parsePagination = (query, defaultLimit = 25, maxLimit = 100) => {
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || defaultLimit))
  const skip = (page - 1) * limit
  return { page, limit, skip }
}

const DEFAULT_METAL_RATES = {
  goldPrice: 285,
  silverPrice: 3.5,
  priceCurrency: 'USD',
}

const DEFAULT_REPORT_BRANDING = {
  key: 'default',
  entityName: 'Main Entity',
  branchName: '',
  isDefault: true,
  companyName: 'Ops Dashboard ERP',
  legalName: '',
  reportSubtitle: 'Finance & Accounts Division',
  logoUrl: '',
  logoWidth: 180,
  logoHeight: 56,
  logoFit: 'contain',
  reportFooter: 'Confidential Internal Statement',
  preparedByTitle: 'Prepared By',
  preparedByName: 'Finance Officer',
  reviewedByTitle: 'Reviewed By',
  reviewedByName: 'Accounts Manager',
  approvedByTitle: 'Authorized Signatory',
  approvedByName: 'Finance Controller',
}

const REQUIRED_VENDOR_DOCUMENTS_BY_CATEGORY = {
  general: ['contract', 'trade_license', 'vat_certificate', 'bank_proof'],
  logistics: ['contract', 'trade_license', 'vat_certificate', 'bank_proof'],
  manufacturing: ['contract', 'trade_license', 'vat_certificate', 'bank_proof'],
  services: ['contract', 'trade_license', 'vat_certificate'],
  raw_material: ['contract', 'trade_license', 'vat_certificate', 'bank_proof'],
  contractor: ['contract', 'trade_license', 'vat_certificate', 'bank_proof'],
}

const normalizeBrandingKey = (value) => {
  const normalized = String(value || 'default')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'default'
}

const buildBrandingPayload = (doc) => ({
  ...DEFAULT_REPORT_BRANDING,
  ...(doc?.toObject ? doc.toObject() : doc || {}),
})

const buildBrandingProfiles = (docs = []) => {
  if (!docs.length) {
    return [{
      key: DEFAULT_REPORT_BRANDING.key,
      entityName: DEFAULT_REPORT_BRANDING.entityName,
      branchName: DEFAULT_REPORT_BRANDING.branchName,
      companyName: DEFAULT_REPORT_BRANDING.companyName,
      isDefault: DEFAULT_REPORT_BRANDING.isDefault,
    }]
  }

  return docs.map((doc) => {
    const branding = buildBrandingPayload(doc)
    return {
      key: branding.key,
      entityName: branding.entityName,
      branchName: branding.branchName,
      companyName: branding.companyName,
      isDefault: Boolean(branding.isDefault),
    }
  })
}

const getLatestMetalRate = async () => {
  const latest = await MetalRate.findOne({}).sort({ updatedAt: -1 })
  return latest || null
}

const nextCustomerAccountCode = async () => {
  const base = 1300
  let code = base
  while (await ChartOfAccount.exists({ accountCode: String(code) })) {
    code += 1
  }
  return String(code)
}

const nextVendorAccountCode = async () => {
  const base = 2300
  let code = base
  while (await ChartOfAccount.exists({ accountCode: String(code) })) {
    code += 1
  }
  return String(code)
}

const nextVendorCode = async () => {
  const latest = await Vendor.findOne({})
    .sort({ createdAt: -1 })
    .select('vendorCode')

  const current = String(latest?.vendorCode || '').match(/VEN-(\d+)/)
  const next = current ? Number(current[1]) + 1 : 1
  return `VEN-${String(next).padStart(4, '0')}`
}

const buildVendorSummary = async (vendor) => {
  const outstandingRaw = await getOutstandingForAccount(vendor.ledgerAccountId?._id)
  const aging = await getAgingForAccount(vendor.ledgerAccountId?._id)
  const [purchaseCount, paymentCount, postedAmountSummary, recentTransaction] = await Promise.all([
    Transaction.countDocuments({ vendorId: vendor._id, type: 'purchase', isDeleted: { $ne: true }, status: 'posted' }),
    Transaction.countDocuments({ vendorId: vendor._id, type: 'payment', isDeleted: { $ne: true }, status: 'posted' }),
    Transaction.aggregate([
      {
        $match: {
          vendorId: vendor._id,
          isDeleted: { $ne: true },
          status: 'posted',
        },
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
        },
      },
    ]),
    Transaction.findOne({ vendorId: vendor._id, isDeleted: { $ne: true } }).sort({ date: -1, createdAt: -1 }).select('type amount date status currency'),
  ])

  const purchaseAmount = postedAmountSummary.find((row) => row._id === 'purchase')?.total || 0
  const paymentAmount = postedAmountSummary.find((row) => row._id === 'payment')?.total || 0
  const outstanding = toMoney(Math.abs(outstandingRaw))
  const utilization = Number(vendor.creditLimit || 0) > 0 ? toMoney((outstanding / Number(vendor.creditLimit || 1)) * 100) : 0
  const compliance = evaluateVendorCompliance(vendor)

  return {
    outstanding,
    outstandingType: outstandingRaw >= 0 ? 'Credit' : 'Debit',
    aging,
    purchaseCount,
    paymentCount,
    purchaseAmount: toMoney(purchaseAmount),
    paymentAmount: toMoney(paymentAmount),
    utilizationPercent: utilization,
    isOverLimit: Number(vendor.creditLimit || 0) > 0 && outstanding > Number(vendor.creditLimit || 0),
    lastTransaction: recentTransaction || null,
    compliance,
  }
}

// Batch version of buildVendorSummary for list endpoints — 4 queries total regardless of vendor count
const batchVendorSummaries = async (vendors) => {
  if (!vendors.length) return []
  const vendorIds = vendors.map((v) => v._id)
  const accountIds = vendors.map((v) => v.ledgerAccountId?._id).filter(Boolean)

  const [debitAggs, creditAggs, txAggs, recentTxRows] = await Promise.all([
    accountIds.length
      ? Ledger.aggregate([
          { $match: { debitAccountId: { $in: accountIds }, isDeleted: { $ne: true } } },
          { $group: { _id: '$debitAccountId', total: { $sum: { $multiply: ['$amount', { $ifNull: ['$exchangeRate', 1] }] } } } },
        ])
      : Promise.resolve([]),
    accountIds.length
      ? Ledger.aggregate([
          { $match: { creditAccountId: { $in: accountIds }, isDeleted: { $ne: true } } },
          { $group: { _id: '$creditAccountId', total: { $sum: { $multiply: ['$amount', { $ifNull: ['$exchangeRate', 1] }] } } } },
        ])
      : Promise.resolve([]),
    Transaction.aggregate([
      { $match: { vendorId: { $in: vendorIds }, isDeleted: { $ne: true }, status: 'posted' } },
      { $group: { _id: { vendorId: '$vendorId', type: '$type' }, count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]),
    Transaction.find({ vendorId: { $in: vendorIds }, isDeleted: { $ne: true } })
      .sort({ date: -1, createdAt: -1 })
      .select('vendorId type amount date status currency')
      .lean(),
  ])

  const debitMap = new Map(debitAggs.map((r) => [String(r._id), r.total]))
  const creditMap = new Map(creditAggs.map((r) => [String(r._id), r.total]))

  const txMap = new Map()
  txAggs.forEach((row) => {
    const vid = String(row._id.vendorId)
    if (!txMap.has(vid)) txMap.set(vid, { purchaseCount: 0, paymentCount: 0, purchaseAmount: 0, paymentAmount: 0 })
    const m = txMap.get(vid)
    if (row._id.type === 'purchase') { m.purchaseCount = row.count; m.purchaseAmount = toMoney(row.total) }
    if (row._id.type === 'payment')  { m.paymentCount  = row.count; m.paymentAmount  = toMoney(row.total) }
  })

  const recentMap = new Map()
  recentTxRows.forEach((tx) => {
    const vid = String(tx.vendorId)
    if (!recentMap.has(vid)) recentMap.set(vid, tx)
  })

  return vendors.map((vendor) => {
    const acId = String(vendor.ledgerAccountId?._id || '')
    const debit = debitMap.get(acId) || 0
    const credit = creditMap.get(acId) || 0
    const outstandingRaw = debit - credit
    const outstanding = toMoney(Math.abs(outstandingRaw))
    const vid = String(vendor._id)
    const tx = txMap.get(vid) || { purchaseCount: 0, paymentCount: 0, purchaseAmount: 0, paymentAmount: 0 }
    const utilization = Number(vendor.creditLimit || 0) > 0 ? toMoney((outstanding / Number(vendor.creditLimit || 1)) * 100) : 0
    const compliance = evaluateVendorCompliance(vendor)
    return {
      outstanding,
      outstandingType: outstandingRaw >= 0 ? 'Credit' : 'Debit',
      aging: { bucket0to30: 0, bucket31to60: 0, bucket61to90: 0, bucket90Plus: 0, total: outstanding },
      purchaseCount: tx.purchaseCount,
      paymentCount: tx.paymentCount,
      purchaseAmount: tx.purchaseAmount,
      paymentAmount: tx.paymentAmount,
      utilizationPercent: utilization,
      isOverLimit: Number(vendor.creditLimit || 0) > 0 && outstanding > Number(vendor.creditLimit || 0),
      lastTransaction: recentMap.get(vid) || null,
      compliance,
    }
  })
}

const normalizeVendorCategory = (value) => {
  const normalized = String(value || 'general')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
  return normalized || 'general'
}

const evaluateVendorCompliance = (vendor, asOfDate = new Date()) => {
  const category = normalizeVendorCategory(vendor.category)
  const requiredDocuments = REQUIRED_VENDOR_DOCUMENTS_BY_CATEGORY[category] || REQUIRED_VENDOR_DOCUMENTS_BY_CATEGORY.general
  const docs = Array.isArray(vendor.documents) ? vendor.documents : []

  const docByType = new Map()
  docs.forEach((doc) => {
    const type = String(doc.docType || '').trim()
    if (!type) return
    if (!docByType.has(type)) docByType.set(type, [])
    docByType.get(type).push(doc)
  })

  const missingDocuments = []
  const expiredRequiredDocuments = []
  requiredDocuments.forEach((docType) => {
    const list = docByType.get(docType) || []
    if (!list.length) {
      missingDocuments.push(docType)
      return
    }

    const hasValid = list.some((doc) => {
      if (!doc.expiryDate) return true
      return new Date(doc.expiryDate) >= asOfDate
    })

    if (!hasValid) expiredRequiredDocuments.push(docType)
  })

  const requiredCount = requiredDocuments.length || 1
  const blockedCount = missingDocuments.length + expiredRequiredDocuments.length
  const complianceScore = Math.max(0, Math.round(((requiredCount - blockedCount) / requiredCount) * 100))

  return {
    category,
    requiredDocuments,
    missingDocuments,
    expiredRequiredDocuments,
    complianceScore,
    compliant: blockedCount === 0,
  }
}

const buildDocumentExpiryBuckets = (vendors = [], asOfDate = new Date()) => {
  const buckets = {
    expired: 0,
    warning30: 0,
    warning60: 0,
    warning90: 0,
    totalTracked: 0,
  }

  const rows = []

  vendors.forEach((vendor) => {
    const docs = Array.isArray(vendor.documents) ? vendor.documents : []
    docs.forEach((doc) => {
      if (!doc.expiryDate) return
      const expiryDate = new Date(doc.expiryDate)
      const daysToExpiry = Math.floor((expiryDate.getTime() - asOfDate.getTime()) / 86400000)
      buckets.totalTracked += 1

      if (daysToExpiry < 0) buckets.expired += 1
      else if (daysToExpiry <= 30) buckets.warning30 += 1
      else if (daysToExpiry <= 60) buckets.warning60 += 1
      else if (daysToExpiry <= 90) buckets.warning90 += 1

      rows.push({
        vendorId: vendor._id,
        vendorName: vendor.name,
        vendorCode: vendor.vendorCode || '',
        docType: doc.docType || 'other',
        title: doc.title || '',
        expiryDate,
        daysToExpiry,
      })
    })
  })

  rows.sort((a, b) => Number(a.daysToExpiry || 0) - Number(b.daysToExpiry || 0))

  return {
    buckets,
    rows,
  }
}

const classifyDueAlert = (daysToDue) => {
  if (daysToDue < 0) return 'overdue'
  if (daysToDue <= 7) return 'due_soon'
  if (daysToDue <= 30) return 'upcoming'
  return 'later'
}

const buildVendorPaymentCalendar = async (vendor, options = {}) => {
  const asOfDate = options.asOfDate ? new Date(options.asOfDate) : new Date()
  const horizonDays = Number(options.horizonDays || 45)
  const startDate = options.startDate ? new Date(options.startDate) : null
  const endDate = options.endDate ? new Date(options.endDate) : null

  const [purchases, payments] = await Promise.all([
    Transaction.find({
      vendorId: vendor._id,
      type: 'purchase',
      status: 'posted',
      isDeleted: { $ne: true },
    })
      .sort({ date: 1, createdAt: 1 })
      .select('amount date currency description'),
    Transaction.find({
      vendorId: vendor._id,
      type: 'payment',
      status: 'posted',
      isDeleted: { $ne: true },
    })
      .sort({ date: 1, createdAt: 1 })
      .select('amount date currency description'),
  ])

  const purchaseBuckets = purchases.map((tx) => ({
    txId: tx._id,
    txDate: tx.date ? new Date(tx.date) : new Date(),
    dueDate: new Date((tx.date ? new Date(tx.date) : new Date()).getTime() + Number(vendor.paymentTermsDays || 0) * 86400000),
    amount: Number(tx.amount || 0),
    remaining: Number(tx.amount || 0),
    currency: tx.currency || vendor.currency || 'USD',
    description: tx.description || '',
  }))

  payments.forEach((payment) => {
    let remainingPayment = Number(payment.amount || 0)
    for (let i = 0; i < purchaseBuckets.length && remainingPayment > 0; i += 1) {
      const bucket = purchaseBuckets[i]
      if (bucket.remaining <= 0) continue
      const applied = Math.min(bucket.remaining, remainingPayment)
      bucket.remaining = toMoney(bucket.remaining - applied)
      remainingPayment = toMoney(remainingPayment - applied)
    }
  })

  const calendar = purchaseBuckets
    .filter((bucket) => bucket.remaining > 0)
    .map((bucket) => {
      const daysToDue = Math.floor((bucket.dueDate.getTime() - asOfDate.getTime()) / 86400000)
      return {
        purchaseTransactionId: bucket.txId,
        purchaseDate: bucket.txDate,
        dueDate: bucket.dueDate,
        amount: toMoney(bucket.amount),
        remaining: toMoney(bucket.remaining),
        currency: bucket.currency,
        description: bucket.description,
        daysToDue,
        alertLevel: classifyDueAlert(daysToDue),
      }
    })
    .filter((entry) => {
      if (startDate && entry.dueDate < startDate) return false
      if (endDate && entry.dueDate > endDate) return false
      if (!startDate && !endDate) {
        if (entry.daysToDue > horizonDays) return false
      }
      return true
    })
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))

  const alertCounts = calendar.reduce((acc, row) => {
    acc[row.alertLevel] = (acc[row.alertLevel] || 0) + 1
    return acc
  }, { overdue: 0, due_soon: 0, upcoming: 0, later: 0 })

  return {
    calendar,
    alertCounts,
    totalDue: toMoney(calendar.reduce((sum, row) => sum + Number(row.remaining || 0), 0)),
  }
}

const nextInventoryAccountCode = async () => {
  const base = 12000
  let code = base
  while (await ChartOfAccount.exists({ accountCode: String(code) })) {
    code += 1
  }
  return String(code)
}

const normalizeCurrencyCode = (value, fallback = BASE_CURRENCY_CODE) => {
  const code = String(value || fallback || 'USD').trim().toUpperCase()
  return code || String(fallback || BASE_CURRENCY_CODE || 'USD').trim().toUpperCase()
}

const findPreferredBankAccountByCurrency = async (currencyCode) => {
  const normalizedCurrency = normalizeCurrencyCode(currencyCode)
  const bankCandidates = await ChartOfAccount.find({
    isActive: true,
    accountType: 'Asset',
    $or: [
      { accountName: /bank|nbd/i },
      { accountCode: /^101/ },
    ],
  }).sort({ accountCode: 1, createdAt: 1, _id: 1 })

  if (!bankCandidates.length) return null

  const preferredCodesByCurrency = {
    USD: ['101001', '1010'],
    AED: ['101002'],
    SOMS: ['101003'],
  }

  const preferredCodes = preferredCodesByCurrency[normalizedCurrency] || []
  for (const code of preferredCodes) {
    const byCode = bankCandidates.find((row) => String(row.accountCode || '').trim() === code)
    if (byCode) return byCode
  }

  const currencyMatches = bankCandidates.filter((row) => normalizeCurrencyCode(row.currency) === normalizedCurrency)
  if (currencyMatches.length) {
    // Prefer specific sub-ledgers (e.g. 101001) before generic parent banks (e.g. 1010).
    const specific = currencyMatches.find((row) => String(row.accountCode || '').trim().length > 4)
    if (specific) return specific
    return currencyMatches[0]
  }

  return bankCandidates[0]
}

const ensureCashBankAccount = async (user, currency = 'USD', preference = 'any') => {
  const normalizedPreference = String(preference || 'any').toLowerCase()
  const isBankPreferred = normalizedPreference === 'bank'
  const isCashPreferred = normalizedPreference === 'cash'

  const query = {
    accountType: 'Asset',
    $or: isBankPreferred
      ? [{ accountCode: '1010' }, { accountName: /bank/i }]
      : isCashPreferred
        ? [{ accountCode: '1000' }, { accountName: /petty cash|cash on hand|cash/i }]
        : [{ accountCode: '1010' }, { accountName: /bank|cash/i }],
  }

  let account = await ChartOfAccount.findOne(query).sort({ accountCode: 1 })

  const preferredCode = isCashPreferred ? '1000' : '1010'

  if (!account) {
    // Reuse existing account code if present (even if inactive) to avoid duplicate key errors.
    account = await ChartOfAccount.findOne({ accountCode: preferredCode })

    if (!account) {
      try {
        account = await ChartOfAccount.create({
          accountName: isCashPreferred ? 'Petty Cash' : 'Main Bank Account',
          accountCode: preferredCode,
          accountType: 'Asset',
          currency,
          description: isCashPreferred ? 'Default cash account' : 'Default bank account',
          createdBy: user._id,
        })
      } catch (err) {
        if (err?.code !== 11000) throw err
        account = await ChartOfAccount.findOne({ accountCode: preferredCode })
      }
    }
  }

  if (account && !account.isActive) {
    account.isActive = true
    await account.save()
  }

  return account
}

const normalizeVoucherSettlementType = (value) => {
  const v = String(value || '').trim().toLowerCase()
  if (v === 'tt' || v === 'transfer') return 'bank'
  if (v === 'cash') return 'cash'
  if (v === 'cheque' || v === 'check') return 'bank'
  return 'any'
}

const resolveVoucherSettlementAccount = async (user, tx) => {
  if (!['receipt', 'payment'].includes(String(tx?.type || '').toLowerCase())) return null

  const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
  if (!lines.length) return null

  const preferredLine = lines.find((line) => String(line?.acCode || '').trim()) || lines[0]
  const accountCode = String(preferredLine?.acCode || '').trim()
  const settlementPreference = normalizeVoucherSettlementType(preferredLine?.type)
  const settlementCurrency = normalizeCurrencyCode(
    preferredLine?.currCode
    || tx?.voucherMeta?.currCode
    || tx?.currency
    || BASE_CURRENCY_CODE
  )

  if (accountCode) {
    const looksLikeObjectId = /^[a-f\d]{24}$/i.test(accountCode)
    let account = null

    if (looksLikeObjectId) {
      account = await ChartOfAccount.findById(accountCode)
    }

    if (!account) {
      const matches = await ChartOfAccount.find({ accountCode })
        .sort({ isActive: -1, createdAt: 1, _id: 1 })

      account =
        matches.find((row) => row.isActive && row.accountType === 'Asset')
        || matches.find((row) => row.isActive)
        || matches.find((row) => row.accountType === 'Asset')
        || matches[0]
    }

    if (account) {
      if (!account.isActive) {
        account.isActive = true
        await account.save()
      }
      return account._id
    }
  }

  if (settlementPreference === 'bank') {
    const preferredBank = await findPreferredBankAccountByCurrency(settlementCurrency)
    if (preferredBank) return preferredBank._id
  }

  const fallbackAccount = await ensureCashBankAccount(user, tx.currency || 'USD', settlementPreference)
  return fallbackAccount?._id || null
}

const resolveTransactionAccounts = async ({ user, tx, mappingOverride, preparedVoucherImpact }) => {
  const transactionType = tx.type
  let mapping = null
  if (tx.mappingId) {
    mapping = await AccountMapping.findById(tx.mappingId)
  } else {
    mapping = await AccountMapping.findOne({ mappingType: transactionType, isActive: true })
  }

  let debitAccountId = tx.debitAccountId || mapping?.debitAccountId || null
  let creditAccountId = tx.creditAccountId || mapping?.creditAccountId || null
  const voucherSettlementAccountId = await resolveVoucherSettlementAccount(user, tx)
  const directPartyAccountLookup = String(tx?.voucherMeta?.partyAccountId || tx?.voucherMeta?.partyCode || '').trim()
  let directPartyAccount = null

  if (directPartyAccountLookup) {
    const looksLikeObjectId = /^[a-f\d]{24}$/i.test(directPartyAccountLookup)
    directPartyAccount = looksLikeObjectId
      ? await ChartOfAccount.findById(directPartyAccountLookup)
      : null

    if (!directPartyAccount) {
      directPartyAccount = await ChartOfAccount.findOne({ accountCode: directPartyAccountLookup, isActive: true })
    }
  }

  if (transactionType === 'sale' || transactionType === 'receipt') {
    const customer = tx.customerId ? await Customer.findById(tx.customerId).populate('ledgerAccountId') : null
    if ((transactionType === 'sale' || transactionType === 'receipt') && customer?.ledgerAccountId) {
      if (transactionType === 'sale') debitAccountId = debitAccountId || customer.ledgerAccountId._id
      if (transactionType === 'receipt') creditAccountId = creditAccountId || customer.ledgerAccountId._id
    }

    if (transactionType === 'sale' && !customer?.ledgerAccountId) {
      const vendor = tx.vendorId ? await Vendor.findById(tx.vendorId).populate('ledgerAccountId') : null
      if (vendor?.ledgerAccountId) {
        debitAccountId = debitAccountId || vendor.ledgerAccountId._id
      }
    }

    ;({ debitAccountId, creditAccountId } = applyPartyAccountPriority({
      transactionType,
      debitAccountId,
      creditAccountId,
      directPartyAccountId: directPartyAccount?._id,
    }))

    const bank = await ensureCashBankAccount(user, tx.currency || 'USD', 'bank')
    if (transactionType === 'receipt') debitAccountId = voucherSettlementAccountId || debitAccountId || bank._id
  }

  if (transactionType === 'purchase' || transactionType === 'payment') {
    const vendor = tx.vendorId ? await Vendor.findById(tx.vendorId).populate('ledgerAccountId') : null
    if (vendor?.ledgerAccountId) {
      if (transactionType === 'purchase') creditAccountId = creditAccountId || vendor.ledgerAccountId._id
      if (transactionType === 'payment') debitAccountId = debitAccountId || vendor.ledgerAccountId._id
    }

    if (transactionType === 'purchase' && !vendor?.ledgerAccountId) {
      const customer = tx.customerId ? await Customer.findById(tx.customerId).populate('ledgerAccountId') : null
      if (customer?.ledgerAccountId) {
        creditAccountId = creditAccountId || customer.ledgerAccountId._id
      }
    }

    if (transactionType === 'payment' && !vendor?.ledgerAccountId) {
      const customer = tx.customerId ? await Customer.findById(tx.customerId).populate('ledgerAccountId') : null
      if (customer?.ledgerAccountId) {
        debitAccountId = debitAccountId || customer.ledgerAccountId._id
      }
    }

    ;({ debitAccountId, creditAccountId } = applyPartyAccountPriority({
      transactionType,
      debitAccountId,
      creditAccountId,
      directPartyAccountId: directPartyAccount?._id,
    }))

    const bank = await ensureCashBankAccount(user, tx.currency || 'USD', 'bank')
    if (transactionType === 'payment') creditAccountId = voucherSettlementAccountId || creditAccountId || bank._id
  }

  if (transactionType === 'purchase') {
    if (tx.inventoryItemId) {
      const item = await InventoryItem.findById(tx.inventoryItemId)
      if (item?.ledgerAccountId) debitAccountId = debitAccountId || item.ledgerAccountId
    }
    if (preparedVoucherImpact?.purchaseDebitAccountId) {
      debitAccountId = debitAccountId || preparedVoucherImpact.purchaseDebitAccountId
    }
  }

  if (mappingOverride?.debitAccountId) debitAccountId = mappingOverride.debitAccountId
  if (mappingOverride?.creditAccountId) creditAccountId = mappingOverride.creditAccountId

  // Auto-create fallback accounts so metal sale/purchase vouchers can always post
  if (!debitAccountId || !creditAccountId) {
    const ensureAccount = async ({ name, code, type }) => {
      const acc = await ensureAccountByCode({
        user,
        code,
        name,
        accountType: type,
        currency: tx.currency || 'USD',
      })
      return acc._id
    }

    if (transactionType === 'sale') {
      if (!debitAccountId) debitAccountId = await ensureAccount({ name: 'Accounts Receivable', code: '1100', type: 'Asset' })
      if (!creditAccountId) creditAccountId = await ensureAccount({ name: 'Sales Revenue', code: '4000', type: 'Income' })
    } else if (transactionType === 'purchase') {
      const hasVoucherInventory = Boolean(preparedVoucherImpact?.purchaseDebitAccountId || tx.inventoryItemId || (Array.isArray(tx.voucherMeta?.lineItems) && tx.voucherMeta.lineItems.length))
      if (!debitAccountId) {
        debitAccountId = hasVoucherInventory
          ? await ensureAccount({ name: 'Metal Inventory', code: '1210', type: 'Asset' })
          : await ensureAccount({ name: 'Metal Purchases', code: '5100', type: 'Expense' })
      }
      if (!creditAccountId) creditAccountId = await ensureAccount({ name: 'Accounts Payable', code: '2000', type: 'Liability' })
    } else if (transactionType === 'receipt') {
      if (!debitAccountId) debitAccountId = await ensureCashBankAccount(user, tx.currency || 'USD', 'bank').then(a => a._id)
      if (!creditAccountId) creditAccountId = await ensureAccount({ name: 'Accounts Receivable', code: '1100', type: 'Asset' })
    } else if (transactionType === 'payment') {
      if (!creditAccountId) creditAccountId = await ensureCashBankAccount(user, tx.currency || 'USD', 'bank').then(a => a._id)
      if (!debitAccountId) debitAccountId = await ensureAccount({ name: 'Accounts Payable', code: '2000', type: 'Liability' })
    }
  }

  if (!debitAccountId || !creditAccountId) {
    throw new Error('Unable to resolve debit/credit accounts. Configure mapping or provide override.')
  }

  return {
    debitAccountId,
    creditAccountId,
  }
}

const createLedgerFromTransaction = async ({ user, transaction, referenceType }) => {
  const currencyCode = String(transaction.currency || 'USD').toUpperCase()
  const base = await Currency.findOne({ baseCurrency: true, isActive: true })
  const baseCurrencyCode = String(base?.code || BASE_CURRENCY_CODE || 'USD').toUpperCase()
  const txCurrency = await Currency.findOne({ code: currencyCode, isActive: true })
  const exchangeRate = normalizeExchangeRateValue(transaction.exchangeRate ?? txCurrency?.exchangeRate ?? 1)
  const amountInBase = normalizeMoneyValue(transaction.amount, 'amount') * exchangeRate

  const entry = await Ledger.create({
    date: transaction.voucherMeta?.valueDate || transaction.date || new Date(),
    debitAccountId: transaction.debitAccountId,
    creditAccountId: transaction.creditAccountId,
    amount: toMoney(amountInBase),
    description: transaction.description || `${transaction.type} transaction`,
    referenceType,
    referenceId: transaction._id,
    createdBy: user._id,
    updatedBy: user._id,
    department: user.department,
    currency: baseCurrencyCode,
    exchangeRate: 1,
  })

  // Post exchange difference only when a reference rate is provided on payment/receipt.
  const type = String(transaction.type || '').toLowerCase()
  const voucherMeta = transaction?.voucherMeta || {}
  const voucherLine = resolvePrimaryVoucherFxLine(voucherMeta)
  const voucherCurrencyCode = String(
    voucherMeta?.currCode
    || voucherLine?.currCode
    || currencyCode
    || 'USD'
  ).toUpperCase()

  if (['receipt', 'payment'].includes(type)) {
    // Determine reference rate: explicit line/header field takes priority,
    // then fall back to the currency master's stored exchange rate.
    // This allows automatic FX gain/loss when the transaction rate differs
    // from the rate currently stored in the currency table (no manual entry needed).
    const lineCurrCode = String(voucherLine?.currCode || currencyCode || 'USD').toUpperCase()
    const baseCurr = String(baseCurrencyCode || 'USD').toUpperCase()
    const isForeignLine = lineCurrCode !== baseCurr

    // Fetch the line currency's master rate if it differs from the header currency
    let masterRate = 0
    if (isForeignLine) {
      const lineCurrency = lineCurrCode === currencyCode
        ? txCurrency
        : await Currency.findOne({ code: lineCurrCode, isActive: true })
      masterRate = Number(lineCurrency?.exchangeRate || 0)
    }

    const referenceRate = Number(
      resolveReferenceExchangeRate(voucherMeta)
      || masterRate  // auto: use currency master rate as reference
      || 0
    )

    if (Number.isFinite(referenceRate) && referenceRate > 0) {
      const txAmount = Number(transaction.amount || 0)
      const fxMetrics = resolveVoucherFxMetrics({
        voucherMeta,
        txAmount,
        fallbackRate: Number(voucherLine?.currRate || exchangeRate || masterRate || 1),
        referenceRate,
      })

      const foreignAmount = Number(fxMetrics.totalForeignAmount || 0)
      const lineRate = Number(fxMetrics.lineRate || exchangeRate || masterRate || 1)

      // FC-based gain/loss model:
      //   expectedFC = how many FC units were expected at the original (reference) rate
      //   actualFC   = how many FC units were actually received / paid
      //   For receipt: actualFC > expectedFC → gain (received more FC than expected)
      //   For payment: actualFC < expectedFC → gain (paid less FC than expected)
      const expectedFC = Number(fxMetrics.expectedForeignAmount || (txAmount / referenceRate))
      const actualFC = Number(fxMetrics.actualForeignAmount || (txAmount / lineRate))
      const fcDiff = Number.isFinite(Number(fxMetrics.fcDifference))
        ? Number(fxMetrics.fcDifference)
        : (actualFC - expectedFC)
      // Convert the FC difference using the original obligation/reference rate,
      // not settlement rate, to keep gain/loss valuation consistent.
      const rawDiffInBase = Math.abs(fcDiff) * referenceRate

      if (rawDiffInBase >= FX_REVALUATION_EPSILON) {
        const diffInBase = toMoney(rawDiffInBase)
        const isGain = type === 'payment' ? fcDiff < 0 : fcDiff > 0
        const accounts = await resolveExchangeAdjustmentAccounts({ user, isGain })

        await Ledger.create({
          date: transaction.date || new Date(),
          debitAccountId: accounts.debitAccountId,
          creditAccountId: accounts.creditAccountId,
          amount: diffInBase,
          description: `Exchange ${isGain ? 'gain' : 'loss'} adjustment for transaction ${transaction._id}`,
          referenceType: 'journal',
          referenceId: transaction._id,
          createdBy: user._id,
          updatedBy: user._id,
          department: user.department,
          currency: base?.code || 'USD',
          exchangeRate: 1,
        })
      }
    }
  }

  return entry
}

const resolveExchangeAdjustmentAccounts = async ({ user, isGain }) => {
  const mappingType = isGain ? 'exchange_gain' : 'exchange_loss'
  const mapping = await AccountMapping.findOne({ mappingType, isActive: true })
    .select('debitAccountId creditAccountId')
    .lean()

  if (mapping?.debitAccountId && mapping?.creditAccountId) {
    const [debitAccount, creditAccount] = await Promise.all([
      ChartOfAccount.findOne({ _id: mapping.debitAccountId, isActive: true }).select('_id').lean(),
      ChartOfAccount.findOne({ _id: mapping.creditAccountId, isActive: true }).select('_id').lean(),
    ])

    if (debitAccount && creditAccount) {
      return {
        debitAccountId: mapping.debitAccountId,
        creditAccountId: mapping.creditAccountId,
      }
    }
  }

  const { gain, loss } = await ensureExchangeDifferenceAccounts(user)
  const bank = await ensureCashBankAccount(user, BASE_CURRENCY_CODE, 'bank')

  return isGain
    ? { debitAccountId: bank._id, creditAccountId: gain._id }
    : { debitAccountId: loss._id, creditAccountId: bank._id }
}

const getOutstandingForAccount = async (accountId) => {
  if (!accountId) return 0

  const totals = await Ledger.aggregate([
    {
      $match: {
        isDeleted: { $ne: true },
        $or: [{ debitAccountId: accountId }, { creditAccountId: accountId }],
      },
    },
    {
      $project: {
        amountSigned: {
          $cond: [
            { $eq: ['$debitAccountId', accountId] },
            { $multiply: ['$amount', { $ifNull: ['$exchangeRate', 1] }] },
            { $multiply: ['$amount', { $ifNull: ['$exchangeRate', 1] }, -1] },
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        balance: { $sum: '$amountSigned' },
      },
    },
  ])

  return totals[0]?.balance || 0
}

const getAgingForAccount = async (accountId, asOfDate = new Date()) => {
  if (!accountId) {
    return {
      bucket0to30: 0,
      bucket31to60: 0,
      bucket61to90: 0,
      bucket90Plus: 0,
      total: 0,
    }
  }

  const entries = await Ledger.find({
    isDeleted: { $ne: true },
    $or: [{ debitAccountId: accountId }, { creditAccountId: accountId }],
  })
    .select('date debitAccountId creditAccountId amount exchangeRate')
    .sort({ date: 1, _id: 1 })

  const openDebits = []
  const accountKey = accountId.toString()

  entries.forEach((entry) => {
    const amount = Number(entry.amount || 0) * Number(entry.exchangeRate || 1)
    const debitMatch = entry.debitAccountId?.toString() === accountKey
    const creditMatch = entry.creditAccountId?.toString() === accountKey

    if (debitMatch && amount > 0) {
      openDebits.push({ date: entry.date, remaining: amount })
      return
    }

    if (creditMatch && amount > 0) {
      let creditLeft = amount
      for (const debit of openDebits) {
        if (creditLeft <= 0) break
        if (debit.remaining <= 0) continue
        const applied = Math.min(debit.remaining, creditLeft)
        debit.remaining -= applied
        creditLeft -= applied
      }
    }
  })

  const buckets = {
    bucket0to30: 0,
    bucket31to60: 0,
    bucket61to90: 0,
    bucket90Plus: 0,
    total: 0,
  }

  openDebits.forEach((debit) => {
    if (debit.remaining <= 0) return

    const ageMs = new Date(asOfDate) - new Date(debit.date)
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24))
    buckets.total += debit.remaining

    if (ageDays <= 30) buckets.bucket0to30 += debit.remaining
    else if (ageDays <= 60) buckets.bucket31to60 += debit.remaining
    else if (ageDays <= 90) buckets.bucket61to90 += debit.remaining
    else buckets.bucket90Plus += debit.remaining
  })

  return buckets
}

transactionPostingService = createTransactionPostingService({
  isSuperAdmin,
  isFinance,
  Currency,
  BASE_CURRENCY_CODE,
  validateFxReferenceRateRequirement,
  Customer,
  getOutstandingForAccount,
  prepareVoucherInventoryImpact,
  resolveTransactionAccounts,
  ensurePaymentAdvanceConfirmed,
  Ledger,
  createLedgerFromTransaction,
  applyVoucherVatImpact,
  applyVoucherInventoryImpact,
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
    canViewCustomers,
    canManageCustomers,
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
    isFinance,
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
    canAccessVendors,
    canManageVendors,
    canUpdateVendorOperational,
    parsePagination,
    batchVendorSummaries,
    evaluateVendorCompliance,
    buildDocumentExpiryBuckets,
    buildVendorPaymentCalendar,
    buildVendorSummary,
    nextVendorCode,
    nextVendorAccountCode,
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
    isSuperAdmin,
    isFinance,
    isOperations,
    isProduction,
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
    TRANSACTION_STATUSES,
    Transaction,
    Ledger,
    Currency,
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
    buildTransactionAttachment,
    validateAttachmentContent,
    canAccessReports,
    isSuperAdmin,
    toMoney,
    parsePagination,
    canCreateTransactionFor,
    canAccessTransactions,
    isFinance,
    getRoleTransactionTypes,
    BASE_CURRENCY_CODE,
    applyPartyAccountPriority,
  })
  
  registerAttachmentRoutes({
    router,
    protect,
    path,
    fs,
    Transaction,
  })
  
  const parseBool = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') return fallback
    return ['1', 'true', 'yes', 'y'].includes(String(value).toLowerCase())
  }
  
  const buildDateQuery = (startDate, endDate) => {
    const date = {}
    if (startDate) date.$gte = new Date(startDate)
    if (endDate) date.$lte = new Date(endDate)
    return Object.keys(date).length ? date : null
  }
  
  const buildPreviousPeriod = (startDate, endDate) => {
    if (!startDate || !endDate) return null
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diff = end.getTime() - start.getTime()
    const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000)
    const prevStart = new Date(prevEnd.getTime() - diff)
    return { startDate: prevStart, endDate: prevEnd }
  }
  
  const buildProfitLossSummary = async (startDate, endDate, includeZero = false) => {
    const query = { isDeleted: { $ne: true } }
    const dateQuery = buildDateQuery(startDate, endDate)
    if (dateQuery) query.date = dateQuery
  
    const entries = await Ledger.find(query)
      .populate('debitAccountId', 'accountType accountName accountCode')
      .populate('creditAccountId', 'accountType accountName accountCode')
  
    let totalIncome = 0
    let totalExpense = 0
    const incomeBreakdownMap = new Map()
    const expenseBreakdownMap = new Map()
  
    if (includeZero) {
      const pnlAccounts = await ChartOfAccount.find({
        isActive: true,
        accountType: { $in: ['Income', 'Expense'] },
      }).select('accountCode accountName accountType')
  
      pnlAccounts.forEach((account) => {
        const key = account._id.toString()
        const baseRow = {
          accountId: key,
          accountCode: account.accountCode,
          accountName: account.accountName,
          amount: 0,
        }
        if (account.accountType === 'Income') incomeBreakdownMap.set(key, baseRow)
        if (account.accountType === 'Expense') expenseBreakdownMap.set(key, baseRow)
      })
    }
  
    entries.forEach((entry) => {
      const amount = Number(entry.amount || 0) * Number(entry.exchangeRate || 1)
      if (entry.creditAccountId?.accountType === 'Income') {
        totalIncome += amount
        const key = entry.creditAccountId._id.toString()
        if (!incomeBreakdownMap.has(key)) {
          incomeBreakdownMap.set(key, {
            accountId: key,
            accountCode: entry.creditAccountId.accountCode,
            accountName: entry.creditAccountId.accountName,
            amount: 0,
          })
        }
        incomeBreakdownMap.get(key).amount += amount
      }
      if (entry.debitAccountId?.accountType === 'Expense') {
        totalExpense += amount
        const key = entry.debitAccountId._id.toString()
        if (!expenseBreakdownMap.has(key)) {
          expenseBreakdownMap.set(key, {
            accountId: key,
            accountCode: entry.debitAccountId.accountCode,
            accountName: entry.debitAccountId.accountName,
            amount: 0,
          })
        }
        expenseBreakdownMap.get(key).amount += amount
      }
    })
  
    const incomeBreakdown = Array.from(incomeBreakdownMap.values())
      .map((row) => ({ ...row, amount: toMoney(row.amount) }))
      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
  
    const expenseBreakdown = Array.from(expenseBreakdownMap.values())
      .map((row) => ({ ...row, amount: toMoney(row.amount) }))
      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
  
    return {
      totalIncome: toMoney(totalIncome),
      totalExpense: toMoney(totalExpense),
      netProfit: toMoney(totalIncome - totalExpense),
      incomeBreakdown,
      expenseBreakdown,
      topIncome: incomeBreakdown.slice(0, 10),
      topExpenses: expenseBreakdown.slice(0, 10),
      grossMarginPct: totalIncome > 0 ? toMoney(((totalIncome - totalExpense) / totalIncome) * 100) : 0,
    }
  }
  
  const buildBalanceSheetSummary = async (endDate) => {
    const accounts = await ChartOfAccount.find({ isActive: true })
    const entryQuery = { isDeleted: { $ne: true } }
    if (endDate) {
      entryQuery.date = { $lte: new Date(endDate) }
    }
    const entries = await Ledger.find(entryQuery)
  
    const balanceByAccount = new Map()
    entries.forEach((entry) => {
      const debitKey = entry.debitAccountId?.toString()
      const creditKey = entry.creditAccountId?.toString()
      const amount = Number(entry.amount || 0) * Number(entry.exchangeRate || 1)
      if (debitKey) balanceByAccount.set(debitKey, Number(balanceByAccount.get(debitKey) || 0) + amount)
      if (creditKey) balanceByAccount.set(creditKey, Number(balanceByAccount.get(creditKey) || 0) - amount)
    })
  
    const assets = []
    const liabilities = []
    const equity = []
    let incomeSignedTotal = 0
    let expenseSignedTotal = 0
  
    const normalizeBalanceByType = (accountType, signedBalance) => {
      if (accountType === 'Asset') return signedBalance
      if (accountType === 'Liability' || accountType === 'Equity') return -signedBalance
      return signedBalance
    }
  
    accounts.forEach((account) => {
      const bal = Number(account.openingBalance || 0) + Number(balanceByAccount.get(account._id.toString()) || 0)
      const row = {
        accountId: account._id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        balance: toMoney(normalizeBalanceByType(account.accountType, bal)),
        signedBalance: toMoney(bal),
      }
      if (account.accountType === 'Asset') assets.push(row)
      if (account.accountType === 'Liability') liabilities.push(row)
      if (account.accountType === 'Equity') equity.push(row)
      if (account.accountType === 'Income') incomeSignedTotal += bal
      if (account.accountType === 'Expense') expenseSignedTotal += bal
    })
  
    // Include current-period earnings so the balance sheet remains aligned when P&L accounts are not year-end closed.
    const retainedEarnings = toMoney(-(Number(incomeSignedTotal) + Number(expenseSignedTotal)))
    if (Math.abs(retainedEarnings) >= 0.01) {
      equity.push({
        accountId: null,
        accountCode: 'RETAINED',
        accountName: 'Current Period Earnings',
        balance: retainedEarnings,
        signedBalance: toMoney(-retainedEarnings),
      })
    }
  
    const totalAssets = toMoney(assets.reduce((s, x) => s + Number(x.balance || 0), 0))
    const totalLiabilities = toMoney(liabilities.reduce((s, x) => s + Number(x.balance || 0), 0))
    const totalEquity = toMoney(equity.reduce((s, x) => s + Number(x.balance || 0), 0))
    const liabilitiesPlusEquity = toMoney(Number(totalLiabilities) + Number(totalEquity))
  
    const currentAssets = toMoney(assets
      .filter((x) => /(cash|bank|receivable|inventory|stock)/i.test(`${x.accountCode} ${x.accountName}`))
      .reduce((s, x) => s + Number(x.balance || 0), 0))
    const currentLiabilities = toMoney(liabilities
      .filter((x) => /(payable|creditor|tax|accrual|short)/i.test(`${x.accountCode} ${x.accountName}`))
      .reduce((s, x) => s + Number(x.balance || 0), 0))
    const workingCapital = toMoney(Number(currentAssets) - Number(currentLiabilities))
    const currentRatio = Number(currentLiabilities) > 0 ? toMoney(Number(currentAssets) / Number(currentLiabilities)) : null
  
    return {
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      liabilitiesPlusEquity,
      difference: toMoney(Number(totalAssets) - Number(liabilitiesPlusEquity)),
      currentAssets,
      currentLiabilities,
      workingCapital,
      currentRatio,
      balanced: Math.abs(Number(totalAssets) - Number(liabilitiesPlusEquity)) < 0.01,
    }
  }
  
  registerReportRoutes({
    router,
    protect,
    Ledger,
    ChartOfAccount,
    AccountMapping,
    Customer,
    Vendor,
    DirectDeal,
    InventoryItem,
    StockMovement,
    MetalRate,
    toMoney,
    parseBool,
    buildDateQuery,
    buildPreviousPeriod,
    buildProfitLossSummary,
    buildBalanceSheetSummary,
    getAgingForAccount,
    getOutstandingForAccount,
    buildDocumentExpiryBuckets,
    evaluateVendorCompliance,
    canAccessReports,
  })
}

module.exports = {
  registerErpAccountingRoutes,
}
