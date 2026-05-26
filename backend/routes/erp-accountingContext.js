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
const { applyPartyAccountPriority } = require('../utils/transactionPartyAccounts')
const {
  isMetalStockInType,
  isMetalStockOutType,
  isMetalStockType,
  isMetalTransferType,
  buildStockMovementReason,
} = require('../utils/metalStockVoucherTypes')
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
  validateTransactionPayload,
} = require('./erp-accounting/transactionHelpers')
const { createFxRevaluationService } = require('../services/erpAccounting/fxRevaluationService')
const { createTransactionPostingService } = require('../services/erpAccounting/transactionPostingService')
const {
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

  // UI often fills troy oz only; convert to grams (same basis as pureWeight in VoucherTab).
  const weightInOz = Number(line.weightInOz || 0)
  if (weightInOz > 0) return toQty(weightInOz * 31.1034768)

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

const resolveTransferPostingAmount = (preparedImpact, transactionType) => {
  const plans = Array.isArray(preparedImpact?.inventoryPlans) ? preparedImpact.inventoryPlans : []
  if (!plans.length || !isMetalTransferType(transactionType)) return 0

  if (isMetalStockOutType(transactionType)) {
    return toMoney(plans.reduce((sum, plan) => sum + Number(plan.costAmount || 0), 0))
  }

  return toMoney(plans.reduce((sum, plan) => {
    const lineAmount = Number(plan.lineAmount || 0)
    if (lineAmount > 0) return sum + lineAmount
    const qty = Number(plan.quantity || 0)
    const unitCost = Number(plan.item?.unitCost || 0)
    return sum + (qty * unitCost)
  }, 0))
}

const categoryPurityFromString = (category) => {
  const m = String(category || '').match(/(?:^|;)purity=([\d.]+)/i)
  return m ? Number(m[1]) : 0
}

const metalCategoryClauseForStockCode = (stockCode) => {
  const c = String(stockCode || '').trim().toUpperCase()
  if (!c) return null
  if (c === 'GOLD' || c === 'XAU') {
    return { $or: [{ category: /mainStock=gold/i }, { category: /metalType=gold/i }, { category: /metalType=xau/i }] }
  }
  if (c === 'SILVER' || c === 'XAG') {
    return { $or: [{ category: /mainStock=silver/i }, { category: /metalType=silver/i }, { category: /metalType=xag/i }] }
  }
  if (c === 'PLATINUM' || c === 'XPT') {
    return { $or: [{ category: /mainStock=platinum/i }, { category: /metalType=platinum/i }, { category: /metalType=xpt/i }] }
  }
  if (c === 'PALLADIUM' || c === 'XPD') {
    return { $or: [{ category: /mainStock=palladium/i }, { category: /metalType=palladium/i }, { category: /metalType=xpd/i }] }
  }
  return null
}

/** Infer metal stock category from product description when stockCode is a label (e.g. "Gold Main Stock"). */
const metalCategoryClauseFromProductType = (productType) => {
  const u = String(productType || '').trim().toUpperCase()
  if (!u) return null
  if (/\bXAU\b/.test(u) || /\bGOLD\b/.test(u)) return metalCategoryClauseForStockCode('GOLD')
  if (/\bXAG\b/.test(u) || /\bSILVER\b/.test(u)) return metalCategoryClauseForStockCode('SILVER')
  if (/\bXPT\b/.test(u) || /\bPLATINUM\b/.test(u)) return metalCategoryClauseForStockCode('PLATINUM')
  if (/\bXPD\b/.test(u) || /\bPALLADIUM\b/.test(u)) return metalCategoryClauseForStockCode('PALLADIUM')
  return null
}

const pushLineLookupConditions = (orList, rawValue) => {
  const v = String(rawValue || '').trim()
  if (!v) return
  orList.push({ sku: v })
  orList.push({ sku: new RegExp(`^${escapeRegex(v)}$`, 'i') })
  orList.push({ name: new RegExp(`^${escapeRegex(v)}$`, 'i') })
  if (v.length >= 2) {
    orList.push({ name: new RegExp(escapeRegex(v), 'i') })
    orList.push({ sku: new RegExp(escapeRegex(v), 'i') })
  }
}

/**
 * Load candidate inventory rows for a voucher line (SKU, name, metal hints, explicit item id).
 */
const collectVoucherLineInventoryCandidates = async (line) => {
  const stockCode = String(line?.stockCode || '').trim()
  const productType = String(line?.productType || '').trim()
  const metalHint = String(line?.metalSymbol || line?.metalName || '').trim()

  const directId = line?.inventoryItemId || line?.itemId
  if (directId && /^[a-f\d]{24}$/i.test(String(directId))) {
    const one = await InventoryItem.findOne({ _id: directId, isDeleted: { $ne: true } })
    return one ? [one] : []
  }

  if (!stockCode && !productType) return []

  const orConditions = []
  if (stockCode) pushLineLookupConditions(orConditions, stockCode)
  if (productType) pushLineLookupConditions(orConditions, productType)

  const productBase = { isDeleted: { $ne: true }, category: /recordType=product/i }
  const anyBase = { isDeleted: { $ne: true } }

  let candidates = await InventoryItem.find({ ...productBase, $or: orConditions }).limit(40)
  if (candidates.length) return candidates

  const metalClause =
    metalCategoryClauseForStockCode(stockCode)
    || metalCategoryClauseForStockCode(metalHint)
    || metalCategoryClauseFromProductType(productType)
    || metalCategoryClauseFromProductType(stockCode)

  if (metalClause) {
    candidates = await InventoryItem.find({ ...productBase, ...metalClause }).limit(40)
    if (candidates.length) return candidates
  }

  candidates = await InventoryItem.find({ ...anyBase, $or: orConditions }).limit(40)
  if (candidates.length) return candidates

  if (metalClause) {
    candidates = await InventoryItem.find({ ...anyBase, ...metalClause }).limit(40)
    if (candidates.length) return candidates
  }

  const token = [...String(productType || '').split(/\s+/), ...String(stockCode || '').split(/\s+/)]
    .map((s) => s.trim())
    .find((t) => t.length >= 3)
  if (token) {
    const re = new RegExp(escapeRegex(token), 'i')
    candidates = await InventoryItem.find({ ...productBase, $or: [{ name: re }, { sku: re }] }).limit(40)
    if (candidates.length) return candidates
    candidates = await InventoryItem.find({ ...anyBase, $or: [{ name: re }, { sku: re }] }).limit(40)
  }

  return candidates || []
}

const scoreInventoryLineMatch = (item, line) => {
  const stockCode = String(line?.stockCode || '').trim().toLowerCase()
  const productType = String(line?.productType || '').trim().toLowerCase()
  const cat = String(item.category || '')
  const isProduct = /recordType=product/i.test(cat)
  const iname = String(item.name || '').trim().toLowerCase()
  const isku = String(item.sku || '').trim().toLowerCase()

  let score = 0
  if (isProduct) score += 200

  if (productType) {
    if (iname === productType) score += 95
    else if (iname.includes(productType)) score += 68
    else if (productType.length >= 4 && iname.length >= 3 && productType.includes(iname)) score += 42
    if (isku === productType) score += 88
    else if (isku && productType && (isku.includes(productType) || productType.includes(isku))) score += 50
  }

  if (stockCode) {
    if (isku === stockCode) score += 82
    else if (isku && (isku.includes(stockCode) || stockCode.includes(isku))) score += 52
    if (iname === stockCode) score += 78
  }

  const linePurity = Number(line.purity || 0)
  const pr = linePurity > 1.2 ? linePurity / 1000 : linePurity
  const itemPurRaw = categoryPurityFromString(cat)
  const ir = itemPurRaw > 1.2 ? itemPurRaw / 1000 : itemPurRaw
  if (pr > 0 && ir > 0 && Math.abs(ir - pr) < 1e-6) score += 70
  else if (pr > 0 && ir > 0 && Math.abs(ir - pr) < 0.02) score += 40
  const lineGross = Number(line.grossWeight || 0)
  const mGw = cat.match(/(?:^|;)grossWeight=([\d.]+)/i) || cat.match(/(?:^|;)weight=([\d.]+)/i)
  const itemGross = mGw ? Number(mGw[1]) : Number(item.weight || 0)
  if (lineGross > 0 && itemGross > 0 && Math.abs(lineGross - itemGross) < 0.001) score += 25
  return score
}

const resolveVoucherInventoryItems = async (tx) => {
  const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
  const resolved = []

  for (const line of lines) {
    const candidates = await collectVoucherLineInventoryCandidates(line)
    if (!candidates.length) continue

    const best = [...candidates].sort((a, b) => scoreInventoryLineMatch(b, line) - scoreInventoryLineMatch(a, line))[0]
    const item = await InventoryItem.findById(best._id)
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
  if (!isMetalStockType(transactionType)) {
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
  const cogsAccount = isMetalStockOutType(transactionType) && !isMetalTransferType(transactionType)
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
      costAmount: isMetalStockOutType(transactionType) ? toMoney(quantity * Number(item.unitCost || 0)) : 0,
    }
  })

  return {
    inventoryPlans,
    purchaseDebitAccountId: inventoryPlans[0]?.inventoryAccountId || null,
    inventoryCreditAccountId: isMetalTransferType(transactionType) && isMetalStockOutType(transactionType)
      ? (inventoryPlans[0]?.inventoryAccountId || null)
      : null,
    cogsAccountId: cogsAccount?._id || null,
  }
}

const applyVoucherInventoryImpact = async ({ user, tx, preparedImpact }) => {
  const transactionType = String(tx?.type || '').toLowerCase()
  const plans = Array.isArray(preparedImpact?.inventoryPlans) ? preparedImpact.inventoryPlans : []
  if (!plans.length || !isMetalStockType(transactionType)) return

  for (const plan of plans) {
    const item = await InventoryItem.findById(plan.item._id)
    if (!item || item.isDeleted) continue

    const beforeQty = Number(item.quantity || 0)
    const movementQty = Number(plan.quantity || 0)

    if (isMetalStockInType(transactionType)) {
      const nextQty = toQty(beforeQty + movementQty)
      const currentValue = beforeQty * Number(item.unitCost || 0)
      const incomingValue = isMetalTransferType(transactionType) ? 0 : Number(plan.lineAmount || 0)
      item.quantity = nextQty
      item.lastRestockedAt = tx.date || new Date()
      item.updatedBy = user._id
      if (isMetalTransferType(transactionType)) {
        item.unitCost = nextQty > 0 ? toMoney(currentValue / nextQty) : 0
      } else if (incomingValue > 0 && nextQty > 0) {
        item.unitCost = toMoney((currentValue + incomingValue) / nextQty)
      }
      await item.save()

      await StockMovement.create({
        itemId: item._id,
        itemName: item.name,
        change: movementQty,
        quantityBefore: beforeQty,
        quantityAfter: nextQty,
        reason: buildStockMovementReason(tx, transactionType),
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
      reason: buildStockMovementReason(tx, transactionType),
      actorId: user._id,
      actorName: user.name,
    })

    // Create COGS ledger entry for sale/purchase stock-out only (not metal transfers).
    const cogsAmount = Number(plan.costAmount || 0)
    const cogsAccountId = preparedImpact?.cogsAccountId || null
    const inventoryAccountId = plan.inventoryAccountId || item.ledgerAccountId || null
    if (!isMetalTransferType(transactionType) && cogsAmount > 0 && cogsAccountId && inventoryAccountId) {
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

const resolveVoucherNetLineAmount = (tx) => {
  const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
  if (!lines.length) return 0

  const total = lines.reduce((sum, line) => {
    const amount = Number(line.totalAmount || line.amountLC || line.metalAmount || 0)
    return sum + (Number.isFinite(amount) ? amount : 0)
  }, 0)
  return toMoney(total)
}

const resolveVatPostingAccounts = async ({ user, tx, resolvedAccounts }) => {
  const transactionType = String(tx?.type || '').toLowerCase()

  if (isMetalStockOutType(transactionType)) {
    const mapping = await AccountMapping.findOne({ mappingType: 'vat_output', isActive: true })
      .select('debitAccountId creditAccountId')
      .lean()

    let debitAccountId = resolvedAccounts?.debitAccountId || mapping?.debitAccountId || null
    let creditAccountId = mapping?.creditAccountId || null

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

  if (isMetalStockInType(transactionType)) {
    const mapping = await AccountMapping.findOne({ mappingType: 'vat_input', isActive: true })
      .select('debitAccountId creditAccountId')
      .lean()

    let debitAccountId = mapping?.debitAccountId || null
    let creditAccountId = resolvedAccounts?.creditAccountId || mapping?.creditAccountId || null

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
  if (!isMetalStockType(transactionType) || isMetalTransferType(transactionType)) return null

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
    description: `Auto VAT ${isMetalStockOutType(transactionType) ? 'output' : 'input'} for transaction ${tx._id}`,
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
  isSuperAdmin,
  isFinance,
  getTransactionPostingService: () => transactionPostingService,
})

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
  address: '',
  phone: '',
  trn: '',
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
  const NON_FEED_SOURCES = ['manual', 'default', 'inventory']
  const latestFeed = await MetalRate.findOne({
    source: { $nin: NON_FEED_SOURCES },
    goldPrice: { $gt: 0 },
    silverPrice: { $gt: 0 },
  }).sort({ updatedAt: -1 })
  if (latestFeed) return latestFeed
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
  const rows = await Vendor.find({ vendorCode: /^VEN-\d+$/i }).select('vendorCode').lean()
  return getNextPrefixedCode(rows.map((row) => row.vendorCode), 'VEN')
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
  const partyAccountIdRaw = String(tx?.voucherMeta?.partyAccountId || '').trim()
  const partyCodeRaw = String(tx?.voucherMeta?.partyCode || '').trim()
  let directPartyAccount = null

  /**
   * Resolve voucher party ledger: prefer ObjectId match, then account code.
   * Do not require isActive — inactive payables must still receive postings or enquiry stays empty.
   */
  const resolvePartyChartAccount = async (idOrCode) => {
    const key = String(idOrCode || '').trim()
    if (!key) return null
    if (/^[a-f\d]{24}$/i.test(key)) {
      const byId = await ChartOfAccount.findById(key)
      if (byId) return byId
    }
    const matches = await ChartOfAccount.find({ accountCode: key })
      .sort({ isActive: -1, createdAt: 1, _id: 1 })
    return matches.find((row) => row.isActive) || matches[0] || null
  }

  if (partyAccountIdRaw || partyCodeRaw) {
    directPartyAccount = await resolvePartyChartAccount(partyAccountIdRaw)
    if (!directPartyAccount && partyCodeRaw && partyCodeRaw !== partyAccountIdRaw) {
      directPartyAccount = await resolvePartyChartAccount(partyCodeRaw)
    }
  }

  if (transactionType === 'sale' || transactionType === 'receipt' || transactionType === 'metal_payment') {
    const customer = tx.customerId ? await Customer.findById(tx.customerId).populate('ledgerAccountId') : null
    if ((transactionType === 'sale' || transactionType === 'receipt' || transactionType === 'metal_payment') && customer?.ledgerAccountId) {
      if (transactionType === 'sale' || transactionType === 'metal_payment') debitAccountId = customer.ledgerAccountId._id
      if (transactionType === 'receipt') creditAccountId = customer.ledgerAccountId._id
    }

    if ((transactionType === 'sale' || transactionType === 'metal_payment') && !customer?.ledgerAccountId) {
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

  if (transactionType === 'purchase' || transactionType === 'payment' || transactionType === 'metal_receipt') {
    const vendor = tx.vendorId ? await Vendor.findById(tx.vendorId).populate('ledgerAccountId') : null
    if (vendor?.ledgerAccountId) {
      if (transactionType === 'purchase' || transactionType === 'metal_receipt') creditAccountId = vendor.ledgerAccountId._id
      if (transactionType === 'payment') debitAccountId = vendor.ledgerAccountId._id
    }

    if ((transactionType === 'purchase' || transactionType === 'metal_receipt') && !vendor?.ledgerAccountId) {
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

  if (transactionType === 'purchase' || transactionType === 'metal_receipt') {
    if (preparedVoucherImpact?.purchaseDebitAccountId) {
      debitAccountId = preparedVoucherImpact.purchaseDebitAccountId
    } else if (tx.inventoryItemId) {
      const item = await InventoryItem.findById(tx.inventoryItemId)
      if (item?.ledgerAccountId) debitAccountId = debitAccountId || item.ledgerAccountId
    }
  }

  if (transactionType === 'metal_payment' && preparedVoucherImpact?.inventoryCreditAccountId) {
    creditAccountId = preparedVoucherImpact.inventoryCreditAccountId
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

    if (isMetalTransferType(transactionType)) {
      if (transactionType === 'metal_receipt') {
        if (!debitAccountId) {
          debitAccountId = preparedVoucherImpact?.purchaseDebitAccountId
            || await ensureAccount({ name: 'Metal Inventory', code: '1300', type: 'Asset' })
        }
        if (!creditAccountId) creditAccountId = await ensureAccount({ name: 'Accounts Payable', code: '2000', type: 'Liability' })
      } else if (transactionType === 'metal_payment') {
        if (!debitAccountId) debitAccountId = await ensureAccount({ name: 'Accounts Receivable', code: '1100', type: 'Asset' })
        if (!creditAccountId) {
          creditAccountId = preparedVoucherImpact?.inventoryCreditAccountId
            || await ensureAccount({ name: 'Metal Inventory', code: '1300', type: 'Asset' })
        }
      }
    } else if (transactionType === 'sale') {
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
  const transactionAmount = normalizeMoneyValue(transaction.amount, 'amount')
  const voucherNetAmount = resolveVoucherNetLineAmount(transaction)
  const voucherVatAmount = resolveVoucherVatAmount(transaction)
  const voucherGrossAmount = toMoney(voucherNetAmount + voucherVatAmount)
  const shouldPostNetMainAmount = isMetalStockType(String(transaction.type || '').toLowerCase())
    && voucherNetAmount > 0
    && voucherVatAmount > 0
    && Math.abs(transactionAmount - voucherGrossAmount) <= 0.02
  const postingAmount = shouldPostNetMainAmount ? voucherNetAmount : transactionAmount
  const amountInBase = postingAmount * exchangeRate

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
        const accounts = await resolveExchangeAdjustmentAccounts({ 
          user, 
          isGain, 
          transactionType: type,
          offsetAccountId: type === 'receipt' ? transaction.creditAccountId : transaction.debitAccountId
        })

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

const resolveExchangeAdjustmentAccounts = async ({ user, isGain, transactionType = 'receipt', offsetAccountId = null }) => {
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
      // Mapped accounts take priority - keep original behavior if explicitly mapped
      return {
        debitAccountId: mapping.debitAccountId,
        creditAccountId: mapping.creditAccountId,
      }
    }
  }

  // Option B: Use AR/AP account instead of cash account
  // Exchange entries should affect receivables/payables, not cash directly
  const txType = String(transactionType || 'receipt').toLowerCase()
  const isReceipt = txType === 'receipt'
  
  // Resolve the AR/AP account that was used in the main transaction
  let arApAccountId = offsetAccountId
  if (!arApAccountId) {
    if (isReceipt) {
      // For receipt: AR (Accounts Receivable)
      const arAccount = await ensureAccountByCode({
        user,
        code: '1100',
        name: 'Accounts Receivable',
        accountType: 'Asset',
      })
      arApAccountId = arAccount._id
    } else {
      // For payment: AP (Accounts Payable)
      const apAccount = await ensureAccountByCode({
        user,
        code: '2000',
        name: 'Accounts Payable',
        accountType: 'Liability',
      })
      arApAccountId = apAccount._id
    }
  }

  const { gain, loss } = await ensureExchangeDifferenceAccounts(user)

  // New posting logic - use AR/AP instead of bank
  return isGain
    ? { debitAccountId: arApAccountId, creditAccountId: gain._id }
    : { debitAccountId: loss._id, creditAccountId: arApAccountId }
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
  resolveTransferPostingAmount,
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
    getLatestMetalRate,
    DEFAULT_METAL_RATES,
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
    getLatestMetalRate,
    DEFAULT_METAL_RATES,
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
    transactionUploadDir,
    TRANSACTION_STATUSES,
    Transaction,
    Ledger,
    Currency,
    Customer,
    Vendor,
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
    canAccessTransactions,
    isFinance,
    getRoleTransactionTypes,
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
    canAccessTransactions,
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
  })
}

module.exports = {
  registerErpAccountingRoutes,
}
