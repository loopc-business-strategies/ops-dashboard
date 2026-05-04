const fs = require('fs')
const path = require('path')
const express = require('express')
const multer = require('multer')
const { protect } = require('../middleware/auth')
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

const router = express.Router()

// ==========================================
// ROLE-BASED ACCESS CONTROL
// ==========================================
const isSuperAdmin = (user) => user?.role === 'super_admin'
const isDepartmentHead = (user) => user?.role === 'department_head'
const isFinance = (user) => user?.role === 'super_admin' || (user?.role === 'department_head' && (user?.department || '').toLowerCase() === 'finance')
const isSales = (user) => user?.role === 'super_admin' || user?.role === 'management' || (user?.role === 'department_head' && (user?.department || '').toLowerCase() === 'sales')
const isOperations = (user) => user?.role === 'super_admin' || (user?.role === 'department_head' && (user?.department || '').toLowerCase() === 'operations')
const isProduction = (user) => user?.role === 'super_admin' || (user?.role === 'department_head' && (user?.department || '').toLowerCase() === 'production')
const isHR = (user) => user?.role === 'super_admin' || (user?.role === 'department_head' && (user?.department || '').toLowerCase() === 'hr')
const roleName = (user) => {
  if (isSuperAdmin(user)) return 'admin'
  if (isFinance(user)) return 'finance'
  if (isSales(user)) return 'sales'
  if (isOperations(user) || isProduction(user)) return 'operations'
  if (isHR(user)) return 'hr'
  return 'none'
}

// Chart of Accounts & Mappings (Finance only)
const canViewAccounts = (user) => isSuperAdmin(user) || isFinance(user)
const canManageAccounts = (user) => isSuperAdmin(user) || isFinance(user)
const canViewMappings = (user) => isSuperAdmin(user) || isFinance(user)
const canManageMappings = (user) => isSuperAdmin(user) || isFinance(user)
const canViewAccountSummary = (user) => isSuperAdmin(user) || isFinance(user) || isDepartmentHead(user)

// Ledger (Finance and Department-level transaction posting)
const canViewLedger = (user) => isSuperAdmin(user) || isFinance(user)
const canCreateTransaction = (user) => {
  // Manual journal entry access: Admin + Finance only
  return isSuperAdmin(user) || isFinance(user)
}
const canCreateTransactionFor = (user, transactionType) => {
  if (isSuperAdmin(user) || isFinance(user)) return true
  if (isSales(user) && ['sale', 'receipt'].includes(transactionType)) return true
  if ((isOperations(user) || isProduction(user)) && ['purchase', 'expense'].includes(transactionType)) return true
  if (isHR(user) && ['payroll'].includes(transactionType)) return true
  return false
}

const canAccessReports = (user) => isSuperAdmin(user) || isFinance(user)
const canAccessVendors = (user) => isSuperAdmin(user) || isFinance(user) || isOperations(user)
const canManageVendors = (user) => isSuperAdmin(user) || isFinance(user)
const canUpdateVendorOperational = (user) => isSuperAdmin(user) || isFinance(user) || isOperations(user)
const canAccessInventory = (user) => isSuperAdmin(user) || isFinance(user) || isOperations(user) || isProduction(user)
const canAccessTransactions = (user) => isSuperAdmin(user) || isFinance(user) || isSales(user) || isOperations(user) || isProduction(user) || isHR(user)
const canAccessDirectDeals = (user) => isSuperAdmin(user) || isFinance(user) || isSales(user)
const canManageDirectDeals = (user) => isSuperAdmin(user) || isFinance(user) || isSales(user)

const TRANSACTION_TYPES = ['expense', 'sale', 'purchase', 'receipt', 'payment', 'payroll']
const TRANSACTION_STATUSES = ['draft', 'submitted', 'approved', 'posted', 'returned', 'rejected']
const BASE_CURRENCY_CODE = 'USD'
const DEFAULT_CURRENCY_MASTER = [
  { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 1, baseCurrency: true },
  { code: 'EUR', name: 'Euro', symbol: 'EUR', exchangeRate: 1.08, baseCurrency: false },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED', exchangeRate: 0.2723, baseCurrency: false },
  { code: 'UZS', name: 'Uzbekistan Som', symbol: 'UZS', exchangeRate: 0.000078, baseCurrency: false },
]

const toMoney = (value) => Number(Number(value || 0).toFixed(2))
const toQty = (value) => Number(Number(value || 0).toFixed(6))

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

const normalizeDirectDealStockCode = (value) => String(value || 'OZ').trim().toUpperCase()
const directDealEqOzFromQtyAndStock = (qty, stockCode) => {
  const ratio = DIRECT_DEAL_STOCK_TO_OZ[normalizeDirectDealStockCode(stockCode)] || 1
  return Number(qty || 0) * ratio
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
  if (!TRANSACTION_TYPES.includes(String(payload.type || ''))) {
    return 'Invalid transaction type'
  }

  const amount = Number(payload.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Amount must be greater than zero'
  }

  if (payload.type === 'receipt' && !payload.customerId) {
    return 'Customer is required for receipts'
  }

  if (payload.type === 'sale' && !payload.customerId && !payload.vendorId) {
    return 'Customer or vendor is required for sales'
  }

  if (payload.type === 'purchase' && !payload.vendorId && !payload.customerId) {
    return 'Vendor or customer is required for purchases'
  }

  if (payload.type === 'payment' && !payload.vendorId && !payload.customerId) {
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
      // Another request created the account in parallel; reuse it.
      account = await ChartOfAccount.findOne({ accountCode: code })
    }
  }

  if (account && !account.isActive) {
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
  // Keep retry deterministic in very rare parallel races.
  while (!code || await ChartOfAccount.exists({ accountCode: code })) {
    code = `${normalizedPrefix}${String(seq).padStart(4, '0')}`
    seq += 1
  }
  return code
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

const normalizeTransactionNote = (value) => String(value || '').trim()

const appendTransactionComment = (transaction, user, message, kind = 'comment') => {
  const note = normalizeTransactionNote(message)
  if (!note) return
  transaction.comments.push({
    message: note,
    kind,
    createdBy: user._id,
    createdAt: new Date(),
  })
}

const appendTransactionAudit = (transaction, user, action, options = {}) => {
  transaction.auditTrail.push({
    action,
    fromStatus: options.fromStatus || '',
    toStatus: options.toStatus || '',
    comment: normalizeTransactionNote(options.comment),
    actorId: user._id,
    createdAt: new Date(),
  })
}

const getTransactionWorkflowErrorStatus = (message) => {
  if (/Only Admin\/Finance|Forbidden/i.test(message || '')) return 403
  if (/not found/i.test(message || '')) return 404
  if (/Only draft|Only submitted|must be approved|required|greater than zero|Credit limit exceeded|Invalid|Unable to resolve|returned|rejected/i.test(message || '')) return 400
  return 500
}

const transactionUploadDir = path.resolve(process.env.TRANSACTION_UPLOAD_DIR || path.join(__dirname, '../uploads/transactions'))
fs.mkdirSync(transactionUploadDir, { recursive: true })

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

const buildTransactionAttachment = (file, user) => {
  const relativePath = `/uploads/transactions/${file.filename}`
  const backendBaseUrl = process.env.SERVER_BASE_URL || `http://localhost:${process.env.PORT || 5000}`
  return {
    originalName: file.originalname,
    fileName: file.filename,
    relativePath,
    url: `${backendBaseUrl}${relativePath}`,
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
    if (!isSuperAdmin(user) && !isFinance(user)) throw new Error('Only Admin/Finance can post transactions')
    if (!['approved', 'submitted'].includes(tx.status)) throw new Error('Transaction must be approved/submitted before posting')

    if (tx.type === 'sale' && tx.customerId) {
      const customer = await Customer.findById(tx.customerId)
      if (customer && Number(customer.creditLimit || 0) > 0 && customer.ledgerAccountId) {
        const currentOutstanding = await getOutstandingForAccount(customer.ledgerAccountId)
        const projected = Number(currentOutstanding || 0) + Number(tx.amount || 0)
        if (projected > Number(customer.creditLimit || 0)) {
          throw new Error(`Credit limit exceeded for customer ${customer.name}`)
        }
      }
    }

    const preparedVoucherImpact = await prepareVoucherInventoryImpact({ user, tx })
    
    // Determine if this is an UNFIXED transaction (stock-only, no value posting)
    const transactionType = String(tx?.type || '').toLowerCase()
    const fixingType = String(tx?.voucherMeta?.fixingType || tx?.metalFixStatus || 'fixed').toLowerCase()
    const isUnfixed = ['sale', 'purchase'].includes(transactionType) && 
                      ['unfixed', 'non-fixing', 'nonfixing', 'non_fixing'].includes(fixingType)

    // ALWAYS resolve accounts - both UNFIXED and FIXED need them for reference
    const resolved = await resolveTransactionAccounts({ user, tx, mappingOverride: options.mappingOverride || {}, preparedVoucherImpact })
    tx.debitAccountId = resolved.debitAccountId
    tx.creditAccountId = resolved.creditAccountId

    // For FIXED transactions: create regular value ledger entry.
    // For UNFIXED transactions: create a zero-value ledger entry so it appears in statement with Fix/Unfix label.
    let ledgerEntry = null
    // Keep posting idempotent: collapse duplicate main ledger rows from failed retry attempts.
    const existingMainEntries = await Ledger.find({
      referenceType: tx.type,
      referenceId: tx._id,
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: 1, _id: 1 })

    if (existingMainEntries.length > 1) {
      const keepEntry = existingMainEntries[existingMainEntries.length - 1]
      const staleIds = existingMainEntries
        .slice(0, -1)
        .map((entry) => entry._id)

      if (staleIds.length) {
        await Ledger.updateMany(
          { _id: { $in: staleIds } },
          { $set: { isDeleted: true, deletedAt: new Date(), updatedBy: user._id } }
        )
      }

      tx.journalEntryId = keepEntry._id
    }

    if (tx.journalEntryId) {
      ledgerEntry = await Ledger.findOne({ _id: tx.journalEntryId, isDeleted: { $ne: true } })
    }
    if (!ledgerEntry) {
      ledgerEntry = await Ledger.findOne({
        referenceType: tx.type,
        referenceId: tx._id,
        isDeleted: { $ne: true },
      }).sort({ createdAt: -1, _id: -1 })
    }
    if (!ledgerEntry) {
      if (!isUnfixed) {
        ledgerEntry = await createLedgerFromTransaction({
          user,
          transaction: tx,
          referenceType: tx.type,
        })
      } else {
        // For UNFIXED: only the premium amount impacts the ledger (not the base metal value)
        const lines = Array.isArray(tx.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
        const unfixedPremiumAmount = lines.reduce((sum, line) => {
          const premiumVal = Number(line.premiumValue || 0)
          if (!premiumVal) return sum
          const purity = Number(line.purity || 0)
          const purityRatio = purity > 1.2 ? purity / 1000 : purity
          const grossWeight = Number(line.grossWeight || 0)
          const storedPureWeight = Number(line.pureWeight || 0)
          const pureWeight = storedPureWeight > 0 ? storedPureWeight : (grossWeight * purityRatio)
          const rateType = String(line.rateType || 'OZ').trim().toUpperCase()
          const weightInOz = pureWeight / 31.1034768
          const rateQty = rateType === 'GRAM' ? pureWeight : rateType === 'KG' ? pureWeight / 1000 : weightInOz
          return sum + (premiumVal * rateQty)
        }, 0)

        const roundedPremiumImpact = Number(unfixedPremiumAmount.toFixed(2))
        const isDiscountImpact = roundedPremiumImpact < 0
        const postingAmount = Math.abs(roundedPremiumImpact)
        const debitAccountId = isDiscountImpact ? resolved.creditAccountId : resolved.debitAccountId
        const creditAccountId = isDiscountImpact ? resolved.debitAccountId : resolved.creditAccountId

        ledgerEntry = await Ledger.create({
          date: tx.voucherMeta?.valueDate || tx.date || new Date(),
          debitAccountId,
          creditAccountId,
          amount: postingAmount,
          description: tx.description || `Unfixed ${tx.type} voucher`,
          referenceType: tx.type,
          referenceId: tx._id,
          createdBy: user._id,
          department: user.department || tx.department || '',
          currency: tx.currency || 'USD',
          exchangeRate: tx.exchangeRate || 1,
          notes: isDiscountImpact
            ? 'Unfixed voucher - discount-only ledger entry (customer credit impact).'
            : 'Unfixed voucher - premium-only ledger entry (customer debit impact).',
        })
      }
    }

    // Remove stale COGS rows from failed posting attempts before re-applying inventory impact.
    await Ledger.updateMany(
      { referenceType: 'cogs', referenceId: tx._id, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt: new Date(), updatedBy: user._id } }
    )

    tx.journalEntryId = ledgerEntry._id

    // Apply inventory impact: UNFIXED posts stock only, FIXED skips stock
    await applyVoucherInventoryImpact({ user, tx, preparedImpact: preparedVoucherImpact })

    tx.status = 'posted'
    tx.postedBy = user._id
    tx.updatedBy = user._id
    appendTransactionComment(tx, user, note, 'posting_note')
    appendTransactionAudit(tx, user, 'post', { fromStatus, toStatus: 'posted', comment: note })
    await tx.save()
    return { transaction: tx, ledgerEntry }
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

  if (accountCode) {
    const account = await ChartOfAccount.findOne({
      isActive: true,
      accountType: 'Asset',
      accountCode,
    })
    if (account) return account._id
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
  const txCurrency = await Currency.findOne({ code: currencyCode, isActive: true })
  const exchangeRate = Number(transaction.exchangeRate || txCurrency?.exchangeRate || 1)
  const amountInBase = Number(transaction.amount || 0) * exchangeRate

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
    currency: currencyCode,
    exchangeRate,
  })

  // Post exchange difference only when a reference rate is provided on payment/receipt.
  const type = String(transaction.type || '').toLowerCase()
  if (['receipt', 'payment'].includes(type) && currencyCode !== String(base?.code || 'USD').toUpperCase()) {
    const referenceRate = Number(
      transaction?.voucherMeta?.referenceExchangeRate
      || transaction?.voucherMeta?.invoiceExchangeRate
      || transaction?.voucherMeta?.lineItems?.[0]?.referenceRate
      || 0
    )

    if (Number.isFinite(referenceRate) && referenceRate > 0) {
      const expectedBaseAmount = Number(transaction.amount || 0) * referenceRate
      const diff = toMoney(amountInBase - expectedBaseAmount)

      if (Math.abs(diff) >= 0.01) {
        const { gain, loss } = await ensureExchangeDifferenceAccounts(user)
        const bank = await ensureCashBankAccount(user, base?.code || 'USD')

        // receipt: better rate => gain, worse => loss
        // payment: better rate => gain, worse => loss, but diff direction is inverted
        const isGain = type === 'payment' ? diff < 0 : diff > 0
        const debitAccountId = isGain ? bank._id : loss._id
        const creditAccountId = isGain ? gain._id : bank._id

        await Ledger.create({
          date: transaction.date || new Date(),
          debitAccountId,
          creditAccountId,
          amount: toMoney(Math.abs(diff)),
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

const getOutstandingForAccount = async (accountId) => {
  if (!accountId) return 0

  const totals = await Ledger.aggregate([
    {
      $match: {
        $or: [{ debitAccountId: accountId }, { creditAccountId: accountId }],
      },
    },
    {
      $project: {
        amountSigned: {
          $cond: [{ $eq: ['$debitAccountId', accountId] }, '$amount', { $multiply: ['$amount', -1] }],
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
    $or: [{ debitAccountId: accountId }, { creditAccountId: accountId }],
  })
    .select('date debitAccountId creditAccountId amount')
    .sort({ date: 1, _id: 1 })

  const openDebits = []
  const accountKey = accountId.toString()

  entries.forEach((entry) => {
    const amount = Number(entry.amount || 0)
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

// ==========================================
// CUSTOMERS ENDPOINTS
// ==========================================
router.get('/customers', protect, async (req, res) => {
  try {
    if (!canViewCustomers(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const { page, limit, skip } = parsePagination(req.query, 25, 100)

    const [customers, total] = await Promise.all([
      Customer.find({ isActive: true })
      .populate({
        path: 'ledgerAccountId',
        select: 'accountName accountCode accountType isActive',
        match: { isActive: true },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
      Customer.countDocuments({ isActive: true }),
    ])

    const data = await Promise.all(
      customers.map(async (customer) => {
        const aging = await getAgingForAccount(customer.ledgerAccountId?._id)
        return {
          ...customer.toObject(),
          outstandingBalance: aging.total,
          aging,
        }
      })
    )

    res.json({ success: true, customers: data, total, page, limit })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/customers/:id/aging', protect, async (req, res) => {
  try {
    if (!canViewCustomers(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const customer = await Customer.findById(req.params.id).populate('ledgerAccountId', 'accountName accountCode')
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' })

    const aging = await getAgingForAccount(customer.ledgerAccountId?._id)
    res.json({
      success: true,
      customerId: customer._id,
      customerName: customer.name,
      ledgerAccount: customer.ledgerAccountId,
      aging,
      outstandingBalance: aging.total,
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/customers', protect, async (req, res) => {
  try {
    if (!canManageCustomers(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const {
      name,
      phone,
      email,
      address,
      gstVat,
      openingBalance,
      creditLimit,
      paymentTermsDays,
      currency,
      notes,
    } = req.body

    if (!name) return res.status(400).json({ success: false, message: 'Customer name is required' })

    const receivableParent = await ChartOfAccount.findOne({
      accountType: 'Asset',
      isActive: true,
      $or: [
        { accountCode: '1100' },
        { accountName: /accounts receivable|receivable/i },
      ],
    }).sort({ accountCode: 1 })

    const accountCode = await nextCustomerAccountCode()
    const debtorAccount = await ChartOfAccount.create({
      accountName: `${name} (Debtor)`,
      accountCode,
      accountType: 'Asset',
      parentAccountId: receivableParent?._id || null,
      currency: currency || 'USD',
      description: `Auto-created receivable account for customer ${name}`,
      createdBy: req.user._id,
    })

    const customer = await Customer.create({
      name,
      phone,
      email,
      address,
      gstVat,
      openingBalance: Number(openingBalance || 0),
      creditLimit: Number(creditLimit || 0),
      paymentTermsDays: Number(paymentTermsDays || 0),
      currency: currency || 'USD',
      notes,
      ledgerAccountId: debtorAccount._id,
      createdBy: req.user._id,
    })

    const opening = Number(openingBalance || 0)
    if (opening > 0) {
      let equityAccount = await ChartOfAccount.findOne({ accountType: 'Equity', isActive: true }).sort({ accountCode: 1 })

      if (!equityAccount) {
        equityAccount = await ChartOfAccount.create({
          accountName: 'Owner Equity',
          accountCode: '3000',
          accountType: 'Equity',
          currency: currency || 'USD',
          description: 'Default equity account for opening balances',
          createdBy: req.user._id,
        })
      }

      await Ledger.create({
        date: new Date(),
        debitAccountId: debtorAccount._id,
        creditAccountId: equityAccount._id,
        amount: opening,
        description: `Opening balance for customer ${name}`,
        referenceType: 'journal',
        createdBy: req.user._id,
        department: req.user.department,
        currency: currency || 'USD',
      })
    }

    res.status(201).json({ success: true, customer })
  } catch (e) {
    res.status(getTransactionWorkflowErrorStatus(e.message)).json({ success: false, message: e.message || 'Server error' })
  }
})

router.put('/customers/:id', protect, async (req, res) => {
  try {
    if (!canManageCustomers(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const updates = {}
    const allowedFields = ['name', 'phone', 'email', 'address', 'gstVat', 'creditLimit', 'paymentTermsDays', 'currency', 'notes', 'isActive', 'ledgerAccountId']
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field]
    })

    const customer = await Customer.findByIdAndUpdate(req.params.id, updates, { new: true })
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' })

    if (updates.name || updates.currency) {
      const ledgerUpdates = {}
      if (updates.name) ledgerUpdates.accountName = `${updates.name} (Debtor)`
      if (updates.currency) ledgerUpdates.currency = updates.currency
      if (Object.keys(ledgerUpdates).length && customer.ledgerAccountId) {
        await ChartOfAccount.findByIdAndUpdate(customer.ledgerAccountId, ledgerUpdates)
      }
    }

    res.json({ success: true, customer })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.delete('/customers/:id', protect, async (req, res) => {
  try {
    if (!canManageCustomers(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const customer = await Customer.findById(req.params.id)
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' })

    customer.isActive = false
    await customer.save()

    if (customer.ledgerAccountId) {
      await ChartOfAccount.findByIdAndUpdate(customer.ledgerAccountId, { isActive: false })
    }

    res.json({ success: true, message: 'Customer deactivated', customer })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ==========================================
// CHART OF ACCOUNTS ENDPOINTS
// ==========================================
router.get('/accounts', protect, async (req, res) => {
  try {
    const isSummaryScope = String(req.query.scope || '').trim().toLowerCase() === 'summary'
    if (!canViewAccounts(req.user) && !(isSummaryScope && canViewAccountSummary(req.user))) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }
    const { page, limit, skip } = parsePagination(req.query, 50, 200)
    const query = { isActive: true }
    if (isSummaryScope) {
      const scopedIds = await getAccountSummaryScope(req.user)
      if (Array.isArray(scopedIds)) {
        query._id = { $in: scopedIds }
      }
    }
    const [accounts, total] = await Promise.all([
      ChartOfAccount.find(query)
        .populate('parentAccountId', 'accountName accountCode')
        .sort({ accountCode: 1 })
        .skip(skip)
        .limit(limit),
      ChartOfAccount.countDocuments(query),
    ])
    res.json({ success: true, accounts, total, page, limit })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/accounts/enquiry', protect, async (req, res) => {
  try {
    if (!canViewAccountSummary(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const accountCode = String(req.query.accountCode || '').trim()
    if (!accountCode) {
      return res.status(400).json({ success: false, message: 'Account number is required' })
    }

    const scopedIds = await getAccountSummaryScope(req.user)
    const accountQuery = { accountCode, isActive: true }
    if (Array.isArray(scopedIds)) {
      accountQuery._id = { $in: scopedIds }
    }

    const account = await ChartOfAccount.findOne(accountQuery)
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' })
    }

    const relatedAccountIds = [account._id]
    if (account.accountCode === '1100') {
      const customerLedgerIds = await Customer.find({ isActive: true, ledgerAccountId: { $ne: null } }).distinct('ledgerAccountId')
      customerLedgerIds.forEach((id) => {
        if (id && String(id) !== String(account._id)) relatedAccountIds.push(id)
      })
    }
    if (account.accountCode === '2100') {
      const vendorLedgerIds = await Vendor.find({ isActive: true, deletedAt: null, ledgerAccountId: { $ne: null } }).distinct('ledgerAccountId')
      vendorLedgerIds.forEach((id) => {
        if (id && String(id) !== String(account._id)) relatedAccountIds.push(id)
      })
    }

    const scopedRelatedAccountIds = Array.isArray(scopedIds)
      ? relatedAccountIds.filter((id) => scopedIds.some((scopedId) => String(scopedId) === String(id)))
      : relatedAccountIds

    const targetAccountIds = scopedRelatedAccountIds.length ? scopedRelatedAccountIds : [account._id]

    const [debitAgg, creditAgg] = await Promise.all([
      Ledger.aggregate([
        { $match: { debitAccountId: { $in: targetAccountIds }, isDeleted: { $ne: true } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Ledger.aggregate([
        { $match: { creditAccountId: { $in: targetAccountIds }, isDeleted: { $ne: true } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ])

    const debitTotal = Number(debitAgg[0]?.total || 0)
    const creditTotal = Number(creditAgg[0]?.total || 0)
    const netBalance = debitTotal - creditTotal
    const netDirection = netBalance > 0 ? 'Debit' : netBalance < 0 ? 'Credit' : 'Flat'
    const isUnfixedFixingType = (value) => {
      const normalized = String(value || '').trim().toLowerCase()
      return ['non-fixing', 'non_fixing', 'nonfixing', 'unfixed', 'unfix'].includes(normalized)
    }

    const latestRate = await getLatestMetalRate()
    const rates = latestRate
      ? {
          goldPrice: Number(latestRate.goldPrice || 0),
          silverPrice: Number(latestRate.silverPrice || 0),
          priceCurrency: latestRate.priceCurrency || 'USD',
          updatedAt: latestRate.updatedAt,
        }
      : {
          ...DEFAULT_METAL_RATES,
          updatedAt: null,
        }

    const baseCurrency = await Currency.findOne({ baseCurrency: true, isActive: true })
    const accountCurrencyCode = String(account.currency || (baseCurrency?.code || 'USD')).toUpperCase()
    const accountCurrency = await Currency.findOne({ code: accountCurrencyCode, isActive: true })

    const exchangeRateToBase = Number(accountCurrency?.exchangeRate || 1)
    const convertedToRateCurrency = Number(netBalance) * exchangeRateToBase

    // Metal position: sum pureWeight from actual UNFIXED metal sale/purchase transactions for this account's customer.
    // Fixed deals must affect value only, while unfixed deals affect metal balance.
    // Do NOT derive metal position from cash balance — that produces fabricated metal positions.
    let goldBalance = 0
    let silverBalance = 0
    const linkedCustomer = await Customer.findOne({ ledgerAccountId: account._id, isActive: true }).lean()
    if (linkedCustomer) {
      const metalTxs = await Transaction.find({
        customerId: linkedCustomer._id,
        type: { $in: ['sale', 'purchase'] },
        status: 'posted',
        isDeleted: { $ne: true },
      }).select('type metalFixStatus voucherMeta.fixingType voucherMeta.lineItems').lean()

      for (const tx of metalTxs) {
        const fixingType = tx?.voucherMeta?.fixingType || tx?.metalFixStatus || ''
        if (!isUnfixedFixingType(fixingType)) continue
        const lines = Array.isArray(tx.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
        for (const line of lines) {
          const pw = Number(line.pureWeight || 0)
          if (pw === 0) continue
          const sc = String(line.stockCode || '').toUpperCase()
          const isSilver = sc.includes('XAG') || sc.includes('SILV')
          const sign = tx.type === 'purchase' ? 1 : -1
          if (isSilver) {
            silverBalance += sign * pw
          } else {
            goldBalance += sign * pw
          }
        }
      }
    }

    const ledgerEntries = await Ledger.find({
      isDeleted: { $ne: true },
      $or: [{ debitAccountId: { $in: targetAccountIds } }, { creditAccountId: { $in: targetAccountIds } }],
    })
      .populate('debitAccountId', 'accountCode accountName')
      .populate('creditAccountId', 'accountCode accountName')
      .populate('createdBy', 'name')
      .sort({ date: -1, createdAt: -1 })
      .limit(12)

    const ledgerIds = ledgerEntries.map((entry) => entry._id)
    const referenceIds = ledgerEntries.map((entry) => entry.referenceId).filter(Boolean)
    const normalizeFixingStatus = (value) => {
      const normalized = String(value || '').trim().toLowerCase()
      if (['fixing', 'fixed'].includes(normalized)) return 'fixed'
      if (['non-fixing', 'non_fixing', 'nonfixing', 'unfixed', 'unfix'].includes(normalized)) return 'unfixed'
      return ''
    }
    const resolveMetalCodeFromLines = (lines = []) => {
      const arr = Array.isArray(lines) ? lines : []
      for (const line of arr) {
        const stockText = String(line?.stockCode || '').trim().toUpperCase()
        if (stockText === 'XAU' || stockText.includes('GOLD')) return 'XAU'
        if (stockText === 'XAG' || stockText.includes('SILV')) return 'XAG'
        const productText = `${String(line?.productType || '')} ${String(line?.narration || '')}`.toLowerCase()
        if (productText.includes('gold') || productText.includes('xau')) return 'XAU'
        if (productText.includes('silver') || productText.includes('xag')) return 'XAG'
      }
      return ''
    }
    const resolveLineMetalCode = (line = {}) => {
      const stockText = String(line?.stockCode || '').trim().toUpperCase()
      if (stockText === 'XAU' || stockText.includes('GOLD')) return 'XAU'
      if (stockText === 'XAG' || stockText.includes('SILV')) return 'XAG'
      const productText = `${String(line?.productType || '')} ${String(line?.narration || '')}`.toLowerCase()
      if (productText.includes('gold') || productText.includes('xau')) return 'XAU'
      if (productText.includes('silver') || productText.includes('xag')) return 'XAG'
      return ''
    }
    const resolveSignedPureWeight = (txType, lines = [], txMetalCode = '') => {
      const arr = Array.isArray(lines) ? lines : []
      const gross = arr.reduce((sum, line) => {
        const explicitPureWeight = Number(line?.pureWeight || 0)
        const grossWeight = Number(line?.grossWeight || 0)
        const purityValue = Number(line?.purity || 0)
        const purityRatio = purityValue > 1.2 ? (purityValue / 1000) : purityValue
        const derivedPureWeight = grossWeight > 0 && purityRatio > 0 ? (grossWeight * purityRatio) : 0
        const pw = explicitPureWeight > 0 ? explicitPureWeight : derivedPureWeight
        if (!Number.isFinite(pw) || pw <= 0) return sum
        const lineMetalCode = resolveLineMetalCode(line)
        if (txMetalCode && lineMetalCode && lineMetalCode !== txMetalCode) return sum
        return sum + pw
      }, 0)
      if (txType === 'purchase') return Number(gross || 0)
      if (txType === 'sale') return Number(-(gross || 0))
      return 0
    }
    const resolveDirectDealLineWeightGram = (line = {}) => {
      const qty = Number(line?.qty || 0)
      if (!Number.isFinite(qty) || qty <= 0) return 0
      const stockCode = String(line?.stockCode || 'OZ').trim().toUpperCase()
      if (stockCode === 'KG') return qty * 1000
      if (stockCode === 'GRAM') return qty
      return qty * 31.1034768
    }
    const resolveDirectDealLineSignedWeight = (line = {}) => {
      const grams = resolveDirectDealLineWeightGram(line)
      if (grams <= 0) return 0
      const direction = String(line?.direction || '').trim().toLowerCase()
      // Customer direction semantics:
      // buy  => company sold metal to customer => metal credit (negative sign)
      // sell => company bought metal from customer => metal debit (positive sign)
      return direction === 'buy' ? -grams : grams
    }
    const resolveDirectDealLineType = (line = {}) => {
      const direction = String(line?.direction || '').trim().toLowerCase()
      return direction === 'buy' ? 'sale' : 'purchase'
    }
    const resolveDirectDealLineMetalCode = (line = {}) => {
      return String(line?.metal || '').trim().toUpperCase() || ''
    }
    const resolveDirectDealLineIndexFromNotes = (notes = '') => {
      const match = String(notes || '').match(/line\s+(\d+)/i)
      if (!match) return -1
      const idx = Number(match[1]) - 1
      return Number.isInteger(idx) && idx >= 0 ? idx : -1
    }
    const linkedTransactions = await Transaction.find({
      isDeleted: { $ne: true },
      $or: [
        { journalEntryId: { $in: ledgerIds } },
        { _id: { $in: referenceIds } },
      ],
    })
      .select('_id journalEntryId type voucherMeta.vocNo voucherMeta.refNo voucherMeta.fixingType voucherMeta.lineItems.vatNumber voucherMeta.lineItems.stockCode voucherMeta.lineItems.productType voucherMeta.lineItems.narration voucherMeta.lineItems.pureWeight voucherMeta.lineItems.grossWeight voucherMeta.lineItems.purity')
      .lean()

    const transactionByLedgerId = new Map()
    const transactionById = new Map()
    const directDealById = new Map()
    linkedTransactions.forEach((tx) => {
      const lineTxNo = Array.isArray(tx.voucherMeta?.lineItems)
        ? String(tx.voucherMeta.lineItems.find((line) => String(line?.vatNumber || '').trim())?.vatNumber || '').trim()
        : ''
      const txNumber = String(tx.voucherMeta?.vocNo || tx.voucherMeta?.refNo || lineTxNo || '').trim()
      const txType = String(tx.type || '').trim().toLowerCase()
      const fixingStatus = normalizeFixingStatus(tx.voucherMeta?.fixingType)
      const metalCode = resolveMetalCodeFromLines(tx.voucherMeta?.lineItems)
      const hasVoucherLines = Array.isArray(tx.voucherMeta?.lineItems) && tx.voucherMeta.lineItems.length > 0
      const isMetalTrade = ['sale', 'purchase'].includes(txType) && Boolean(metalCode || hasVoucherLines)
      const metalSignedWeight = (isMetalTrade && fixingStatus === 'unfixed')
        ? resolveSignedPureWeight(txType, tx.voucherMeta?.lineItems, metalCode)
        : 0
      const txRef = {
        id: String(tx._id),
        number: txNumber,
        transactionType: txType,
        metalFixStatus: isMetalTrade ? fixingStatus : '',
        metalCode,
        isMetalTrade,
        metalSignedWeight,
      }
      if (tx.journalEntryId) transactionByLedgerId.set(String(tx.journalEntryId), txRef)
      transactionById.set(String(tx._id), txRef)
    })

    const directDealIds = ledgerEntries
      .filter((entry) => String(entry.referenceType || '').toLowerCase() === 'direct_deal' && entry.referenceId)
      .map((entry) => String(entry.referenceId))

    if (directDealIds.length > 0) {
      const directDeals = await DirectDeal.find({ _id: { $in: directDealIds }, isDeleted: { $ne: true } })
        .select('_id docNo lineItems.customerId lineItems.customerCode lineItems.customerName lineItems.direction lineItems.metal lineItems.qty lineItems.stockCode')
        .lean()

      directDeals.forEach((deal) => {
        directDealById.set(String(deal._id), deal)
      })
    }

    let runningBalance = netBalance
    const statementEntries = ledgerEntries.map((entry) => {
      const debitId = String(entry.debitAccountId?._id || entry.debitAccountId || '')
      const isDebitEntry = targetAccountIds.some((id) => String(id) === debitId)
      const signedAmount = isDebitEntry ? Number(entry.amount || 0) : -Number(entry.amount || 0)
      let linkedTx = transactionByLedgerId.get(String(entry._id)) || transactionById.get(String(entry.referenceId || '')) || null
      if (!linkedTx && String(entry.referenceType || '').toLowerCase() === 'direct_deal') {
        const deal = directDealById.get(String(entry.referenceId || ''))
        if (deal) {
          const lines = Array.isArray(deal.lineItems) ? deal.lineItems : []
          const lineIndex = resolveDirectDealLineIndexFromNotes(entry.notes)
          const line = lineIndex >= 0 && lineIndex < lines.length ? lines[lineIndex] : lines[0]
          if (line) {
            const txType = resolveDirectDealLineType(line)
            linkedTx = {
              id: String(deal._id),
              number: String(deal.docNo || '').trim(),
              transactionType: txType,
              metalFixStatus: '',
              metalCode: resolveDirectDealLineMetalCode(line),
              isMetalTrade: true,
              metalSignedWeight: resolveDirectDealLineSignedWeight(line),
            }
          }
        }
      }
      const row = {
        _id: entry._id,
        date: entry.date,
        description: entry.description || entry.notes || '',
        referenceType: entry.referenceType || 'journal',
        department: entry.department || '',
        currency: entry.currency || accountCurrencyCode,
        exchangeRate: Number(entry.exchangeRate || 1),
        debitAmount: isDebitEntry ? Number(entry.amount || 0) : 0,
        creditAmount: isDebitEntry ? 0 : Number(entry.amount || 0),
        signedAmount,
        runningBalance,
        currentValue: Number(runningBalance || 0) * Number(entry.exchangeRate || exchangeRateToBase || 1),
        limitValue: Number(account.openingBalance || 0),
        offsetAccountCode: isDebitEntry ? (entry.creditAccountId?.accountCode || '') : (entry.debitAccountId?.accountCode || ''),
        offsetAccountName: isDebitEntry ? (entry.creditAccountId?.accountName || '') : (entry.debitAccountId?.accountName || ''),
        createdBy: entry.createdBy?.name || '',
        sourceTransactionId: linkedTx?.id || '',
        sourceTransactionNumber: linkedTx?.number || '',
        sourceTransactionType: linkedTx?.transactionType || '',
        metalDealType: ['sale', 'purchase'].includes(String(linkedTx?.transactionType || '')) ? String(linkedTx.transactionType) : '',
        metalFixStatus: linkedTx?.metalFixStatus || '',
        metalCode: linkedTx?.metalCode || '',
        isMetalTrade: Boolean(linkedTx?.isMetalTrade),
        metalSignedWeight: Number(linkedTx?.metalSignedWeight || 0),
      }
      runningBalance -= signedAmount
      return row
    })

    const positions = [
      {
        key: 'base-currency',
        type: 'Base Currency',
        limitValue: Number(account.openingBalance || 0),
        balance: Number(Math.abs(netBalance) || 0),
        price: 1,
        currentValue: Number(convertedToRateCurrency || 0),
        valueCurrency: rates.priceCurrency,
        unit: accountCurrencyCode,
      },
      {
        key: 'gold',
        type: 'Gold Equivalent',
        limitValue: 0,
        balance: Number(goldBalance || 0),
        price: Number(rates.goldPrice || 0),
        currentValue: Number(convertedToRateCurrency || 0),
        valueCurrency: rates.priceCurrency,
        unit: 'gram',
      },
      {
        key: 'silver',
        type: 'Silver Equivalent',
        limitValue: 0,
        balance: Number(silverBalance || 0),
        price: Number(rates.silverPrice || 0),
        currentValue: Number(convertedToRateCurrency || 0),
        valueCurrency: rates.priceCurrency,
        unit: 'gram',
      },
    ]

    res.json({
      success: true,
      account: {
        _id: account._id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType,
        currency: accountCurrencyCode,
        department: account.department || '',
        isActive: account.isActive,
        description: account.description || '',
        openingBalance: Number(account.openingBalance || 0),
      },
      balances: {
        debitTotal,
        creditTotal,
        netBalance,
        netDirection,
        absoluteNetBalance: Math.abs(netBalance),
        rateCurrencyBalance: convertedToRateCurrency,
        rateCurrency: rates.priceCurrency,
      },
      metals: {
        goldPrice: rates.goldPrice,
        silverPrice: rates.silverPrice,
        priceCurrency: rates.priceCurrency,
        updatedAt: rates.updatedAt,
        goldBalance,
        silverBalance,
      },
      statement: {
        limitValue: Number(account.openingBalance || 0),
        entryCount: statementEntries.length,
        entries: statementEntries,
      },
      positions,
    })
  } catch (e) {
    console.error('Account enquiry error:', e)
    res.status(500).json({ success: false, message: e?.message || 'Server error' })
  }
})

router.get('/accounts/:id', protect, async (req, res) => {
  try {
    if (!canViewAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const account = await ChartOfAccount.findById(req.params.id).populate('parentAccountId')
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' })
    res.json({ success: true, account })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/accounts', protect, async (req, res) => {
  try {
    if (!canManageAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { accountName, accountCode, accountType, parentAccountId, currency, description } = req.body
    if (!accountName || !accountCode || !accountType) return res.status(400).json({ success: false, message: 'Required fields missing' })
    const account = await ChartOfAccount.create({
      accountName, accountCode, accountType, parentAccountId, currency, description, createdBy: req.user._id,
    })
    res.status(201).json({ success: true, account })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// Bulk upsert — super_admin only, used for seeding/copying accounts across tenants
router.post('/accounts/bulk-seed', protect, async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { accounts } = req.body
    if (!Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({ success: false, message: 'accounts array required' })
    }
    let created = 0, updated = 0
    for (const acc of accounts) {
      if (!acc.accountName || !acc.accountCode || !acc.accountType) continue
      const result = await ChartOfAccount.updateOne(
        { accountCode: acc.accountCode },
        { $set: { accountName: acc.accountName, accountType: acc.accountType, currency: acc.currency || 'USD', isActive: acc.isActive !== false, description: acc.description || '', openingBalance: acc.openingBalance || 0, department: acc.department || '', createdBy: req.user._id } },
        { upsert: true }
      )
      if (result.upsertedCount > 0) created++
      else updated++
    }
    res.json({ success: true, created, updated })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.put('/accounts/:id', protect, async (req, res) => {
  try {
    if (!canManageAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const updates = {}
    const allowedFields = ['accountName', 'description', 'isActive', 'currency', 'department', 'parentAccountId']
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field]
    })
    // Allow explicitly clearing the parent (move to root)
    if (Object.prototype.hasOwnProperty.call(req.body, 'parentAccountId') && req.body.parentAccountId === null) {
      updates.parentAccountId = null
    }
    const account = await ChartOfAccount.findByIdAndUpdate(req.params.id, updates, { new: true })
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' })
    res.json({ success: true, account })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.delete('/accounts/:id', protect, async (req, res) => {
  try {
    if (!canManageAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const account = await ChartOfAccount.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true })
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' })
    res.json({ success: true, message: 'Account deactivated', account })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ==========================================
// LEDGER ENDPOINTS
// ==========================================
router.get('/ledger', protect, async (req, res) => {
  try {
    if (!canViewLedger(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { startDate, endDate, accountId, department, referenceType, limit = 500 } = req.query
    const safeLimit = Math.min(500, Math.max(1, Number(limit) || 500))
    const query = { isDeleted: { $ne: true } }
    if (startDate || endDate) {
      query.date = {}
      if (startDate) query.date.$gte = new Date(startDate)
      if (endDate) query.date.$lte = new Date(endDate)
    }
    if (accountId) {
      query.$or = [{ debitAccountId: accountId }, { creditAccountId: accountId }]
    }
    if (department) {
      query.department = department
    }
    if (referenceType) {
      query.referenceType = referenceType
    }
    const entries = await Ledger.find(query)
      .populate('debitAccountId', 'accountName accountCode')
      .populate('creditAccountId', 'accountName accountCode')
      .populate('createdBy', 'name')
      .sort({ date: -1 })
      .limit(safeLimit)
    res.json({ success: true, count: entries.length, limit: safeLimit, entries })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/ledger', protect, async (req, res) => {
  try {
    if (!canCreateTransaction(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { date, debitAccountId, creditAccountId, amount, description, referenceType, referenceId, currency } = req.body
    if (!debitAccountId || !creditAccountId || !amount) return res.status(400).json({ success: false, message: 'Required fields missing' })
    // Validation: debit account cannot equal credit account
    if (debitAccountId === creditAccountId) return res.status(400).json({ success: false, message: 'Debit and Credit accounts must be different' })
    // Enhanced role-based check for transaction type
    if (!canCreateTransactionFor(req.user, referenceType || 'journal')) {
      return res.status(403).json({ success: false, message: `Your department cannot post ${referenceType} transactions` })
    }
    const entry = await Ledger.create({
      date: new Date(date),
      debitAccountId,
      creditAccountId,
      amount,
      description,
      referenceType,
      referenceId,
      currency,
      createdBy: req.user._id,
      department: req.user.department,
    })
    res.status(201).json({ success: true, entry })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ==========================================
// LEDGER EDIT/DELETE ENDPOINTS
// ==========================================
router.put('/ledger/:id', protect, async (req, res) => {
  try {
    if (!canCreateTransaction(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const entry = await Ledger.findById(req.params.id)
    if (!entry) return res.status(404).json({ success: false, message: 'Ledger entry not found' })
    // Only creator or finance can edit
    if (entry.createdBy.toString() !== req.user._id.toString() && !isFinance(req.user)) {
      return res.status(403).json({ success: false, message: 'Can only edit your own entries' })
    }
    const { date, debitAccountId, creditAccountId, amount, description, referenceType, currency } = req.body
    if (debitAccountId && creditAccountId && debitAccountId === creditAccountId) {
      return res.status(400).json({ success: false, message: 'Debit and Credit accounts must be different' })
    }
    const updates = {}
    if (date !== undefined) updates.date = new Date(date)
    if (debitAccountId !== undefined) updates.debitAccountId = debitAccountId
    if (creditAccountId !== undefined) updates.creditAccountId = creditAccountId
    if (amount !== undefined) updates.amount = amount
    if (description !== undefined) updates.description = description
    if (referenceType !== undefined) updates.referenceType = referenceType
    if (currency !== undefined) updates.currency = currency
    const updated = await Ledger.findByIdAndUpdate(req.params.id, updates, { new: true })
    res.json({ success: true, entry: updated })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.delete('/ledger/:id', protect, async (req, res) => {
  try {
    if (!canCreateTransaction(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const entry = await Ledger.findById(req.params.id)
    if (!entry) return res.status(404).json({ success: false, message: 'Ledger entry not found' })
    // Only creator or finance can delete
    if (entry.createdBy.toString() !== req.user._id.toString() && !isFinance(req.user)) {
      return res.status(403).json({ success: false, message: 'Can only delete your own entries' })
    }
    // Create reversal entry instead of hard delete (for audit trail)
    const reversalEntry = await Ledger.create({
      date: new Date(),
      debitAccountId: entry.creditAccountId,
      creditAccountId: entry.debitAccountId,
      amount: entry.amount,
      description: `REVERSAL of Entry ${entry._id}: ${entry.description}`,
      referenceType: 'reversal',
      referenceId: entry._id,
      currency: entry.currency,
      createdBy: req.user._id,
      department: req.user.department,
    })
    res.json({ success: true, message: 'Entry reversed', reversalEntry })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.delete('/ledger/:id/permanent', protect, async (req, res) => {
  try {
    if (!canCreateTransaction(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const entry = await Ledger.findById(req.params.id)
    if (!entry) return res.status(404).json({ success: false, message: 'Ledger entry not found' })
    // Only creator or finance can permanently delete
    if (entry.createdBy.toString() !== req.user._id.toString() && !isFinance(req.user)) {
      return res.status(403).json({ success: false, message: 'Can only delete your own entries' })
    }

    const linkedTx = await Transaction.findOne({ journalEntryId: entry._id }).select('_id')
    if (linkedTx) {
      return res.status(400).json({
        success: false,
        message: 'Cannot permanently delete a ledger entry linked to a transaction. Use Reverse instead.',
      })
    }

    entry.isDeleted = true
    entry.deletedAt = new Date()
    entry.updatedBy = req.user._id
    await entry.save()

    res.json({ success: true, message: 'Entry deleted permanently' })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ==========================================
// ACCOUNT MAPPINGS ENDPOINTS
// ==========================================
router.get('/mappings', protect, async (req, res) => {
  try {
    if (!canViewMappings(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { page, limit, skip } = parsePagination(req.query, 25, 100)
    const department = String(req.query.department || '').trim().toLowerCase()
    const query = { isActive: true }
    if (department) {
      query.department = department
    }
    const [mappings, total, summaryDocs] = await Promise.all([
      AccountMapping.find(query)
        .populate('debitAccountId', 'accountName accountCode department')
        .populate('creditAccountId', 'accountName accountCode department')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      AccountMapping.countDocuments(query),
      AccountMapping.find({ isActive: true }).select('department').lean(),
    ])
    
    // Count usage for each mapping
    const mappingsWithUsage = await Promise.all(
      mappings.map(async (mapping) => {
        const usageCount = await Ledger.countDocuments({
          $or: [
            { debitAccountId: mapping.debitAccountId._id, creditAccountId: mapping.creditAccountId._id },
            { referenceType: mapping.mappingType }
          ]
        })
        return {
          ...mapping.toObject(),
          usageCount
        }
      })
    )
    
    const summary = { total: summaryDocs.length, shared: 0, byDepartment: {} }
    summaryDocs.forEach((doc) => {
      const key = String(doc.department || '').trim().toLowerCase()
      if (!key) {
        summary.shared += 1
      } else {
        summary.byDepartment[key] = (summary.byDepartment[key] || 0) + 1
      }
    })

    res.json({ success: true, mappings: mappingsWithUsage, total, page, limit, summary })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/mappings', protect, async (req, res) => {
  try {
    if (!canManageMappings(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { mappingType, debitAccountId, creditAccountId, description, department } = req.body
    if (!mappingType || !debitAccountId || !creditAccountId) return res.status(400).json({ success: false, message: 'Required fields missing' })
    const mapping = await AccountMapping.create({ mappingType, debitAccountId, creditAccountId, description, department: String(department || '').trim().toLowerCase() })
    res.status(201).json({ success: true, mapping })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.put('/mappings/:id', protect, async (req, res) => {
  try {
    if (!canManageMappings(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const updates = {}
    const allowedFields = ['mappingType', 'debitAccountId', 'creditAccountId', 'description', 'department', 'isActive']
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field]
    })
    if (updates.department !== undefined) updates.department = String(updates.department || '').trim().toLowerCase()
    const mapping = await AccountMapping.findByIdAndUpdate(req.params.id, updates, { new: true })
    if (!mapping) return res.status(404).json({ success: false, message: 'Mapping not found' })
    res.json({ success: true, mapping })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.delete('/mappings/:id', protect, async (req, res) => {
  try {
    if (!canManageMappings(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const mapping = await AccountMapping.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true })
    if (!mapping) return res.status(404).json({ success: false, message: 'Mapping not found' })
    res.json({ success: true, message: 'Mapping deactivated', mapping })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ==========================================
// CURRENCY ENDPOINTS
// ==========================================
router.get('/currencies', protect, async (req, res) => {
  try {
    if (!canViewAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    await ensureDefaultCurrencyMaster()
    const currencies = await Currency.find({}).sort({ baseCurrency: -1, code: 1 })
    res.json({ success: true, currencies, total: currencies.length, page: 1, limit: currencies.length })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/currencies/seed-defaults', protect, async (req, res) => {
  try {
    if (!canManageAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const result = await ensureDefaultCurrencyMaster()
    const currencies = await Currency.find({}).sort({ baseCurrency: -1, code: 1 })

    res.json({
      success: true,
      message: 'Currency master defaults synchronized.',
      createdCount: result.createdCount,
      normalizedCount: result.normalizedCount,
      currencies,
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/report-branding', protect, async (req, res) => {
  try {
    if (!canViewAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const requestedKey = normalizeBrandingKey(req.query.key || 'default')
    const profiles = await ReportBranding.find({}).sort({ isDefault: -1, entityName: 1, branchName: 1, key: 1 })
    const selectedDoc = profiles.find((doc) => doc.key === requestedKey) || profiles.find((doc) => doc.isDefault) || null
    const branding = buildBrandingPayload(selectedDoc)
    res.json({ success: true, branding, profiles: buildBrandingProfiles(profiles), selectedKey: branding.key })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.put('/report-branding', protect, async (req, res) => {
  try {
    if (!canManageAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const key = normalizeBrandingKey(req.body.key || 'default')
    const existing = await ReportBranding.findOne({ key })
    const allowedFields = [
      'entityName',
      'branchName',
      'companyName',
      'legalName',
      'reportSubtitle',
      'logoUrl',
      'logoWidth',
      'logoHeight',
      'logoFit',
      'reportFooter',
      'preparedByTitle',
      'preparedByName',
      'reviewedByTitle',
      'reviewedByName',
      'approvedByTitle',
      'approvedByName',
    ]
    const updates = { key, updatedBy: req.user._id }
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field]
    })

    updates.logoWidth = Number.isFinite(Number(updates.logoWidth)) ? Math.min(Math.max(Number(updates.logoWidth), 80), 260) : (existing?.logoWidth || DEFAULT_REPORT_BRANDING.logoWidth)
    updates.logoHeight = Number.isFinite(Number(updates.logoHeight)) ? Math.min(Math.max(Number(updates.logoHeight), 32), 120) : (existing?.logoHeight || DEFAULT_REPORT_BRANDING.logoHeight)
    updates.logoFit = ['contain', 'cover', 'fill'].includes(updates.logoFit) ? updates.logoFit : (existing?.logoFit || DEFAULT_REPORT_BRANDING.logoFit)

    const isDefault = req.body.isDefault !== undefined ? Boolean(req.body.isDefault) : (existing?.isDefault || key === 'default')
    updates.isDefault = isDefault

    if (isDefault) {
      await ReportBranding.updateMany({ key: { $ne: key } }, { $set: { isDefault: false } })
    }

    const branding = await ReportBranding.findOneAndUpdate(
      { key },
      { $set: updates },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    const profiles = await ReportBranding.find({}).sort({ isDefault: -1, entityName: 1, branchName: 1, key: 1 })
    res.json({ success: true, branding: buildBrandingPayload(branding), profiles: buildBrandingProfiles(profiles), selectedKey: branding.key })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/metal-rates', protect, async (req, res) => {
  try {
    if (!canViewAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const latest = await getLatestMetalRate()
    if (!latest) {
      return res.json({
        success: true,
        rates: {
          ...DEFAULT_METAL_RATES,
          updatedAt: null,
        },
        canUpdate: canManageAccounts(req.user),
      })
    }

    res.json({
      success: true,
      rates: {
        goldPrice: Number(latest.goldPrice || 0),
        silverPrice: Number(latest.silverPrice || 0),
        priceCurrency: latest.priceCurrency || 'USD',
        updatedAt: latest.updatedAt,
      },
      canUpdate: canManageAccounts(req.user),
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.put('/metal-rates', protect, async (req, res) => {
  try {
    if (!canManageAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const goldPrice = Number(req.body.goldPrice)
    const silverPrice = Number(req.body.silverPrice)
    const priceCurrency = BASE_CURRENCY_CODE

    if (!Number.isFinite(goldPrice) || goldPrice <= 0 || !Number.isFinite(silverPrice) || silverPrice <= 0) {
      return res.status(400).json({ success: false, message: 'Gold and silver rates must be greater than zero' })
    }

    const rate = await MetalRate.create({
      goldPrice,
      silverPrice,
      priceCurrency,
      updatedBy: req.user._id,
    })

    res.json({
      success: true,
      rates: {
        goldPrice: Number(rate.goldPrice || 0),
        silverPrice: Number(rate.silverPrice || 0),
        priceCurrency: rate.priceCurrency,
        updatedAt: rate.updatedAt,
      },
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/currencies', protect, async (req, res) => {
  try {
    if (!canManageAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const code = String(req.body.code || '').trim().toUpperCase()
    const name = String(req.body.name || '').trim()
    const symbol = String(req.body.symbol || '').trim() || code
    const exchangeRate = Number(req.body.exchangeRate)
    const isActive = req.body.isActive === undefined ? true : Boolean(req.body.isActive)
    const wantsBase = Boolean(req.body.baseCurrency)

    if (!code || code.length < 2 || code.length > 10) {
      return res.status(400).json({ success: false, message: 'Currency code is required (2-10 chars).' })
    }
    if (!name) {
      return res.status(400).json({ success: false, message: 'Currency name is required.' })
    }
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      return res.status(400).json({ success: false, message: 'Exchange rate must be greater than zero.' })
    }

    const existing = await Currency.findOne({ code })
    if (existing) {
      return res.status(409).json({ success: false, message: 'Currency code already exists.' })
    }

    const currency = await Currency.create({
      code,
      name,
      symbol,
      exchangeRate: wantsBase ? 1 : exchangeRate,
      rateUpdatedAt: new Date(),
      isActive,
      baseCurrency: false,
    })

    if (wantsBase) {
      await Currency.updateMany({ _id: { $ne: currency._id }, baseCurrency: true }, { $set: { baseCurrency: false } })
      currency.baseCurrency = true
      currency.exchangeRate = 1
      await currency.save()
    } else {
      await ensureBaseCurrencyConfig()
    }

    res.status(201).json({ success: true, currency })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.put('/currencies/:id', protect, async (req, res) => {
  try {
    if (!canManageAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const currency = await Currency.findById(req.params.id)
    if (!currency) {
      return res.status(404).json({ success: false, message: 'Currency not found.' })
    }

    const nextCode = req.body.code !== undefined ? String(req.body.code || '').trim().toUpperCase() : currency.code
    const nextName = req.body.name !== undefined ? String(req.body.name || '').trim() : currency.name
    const nextSymbol = req.body.symbol !== undefined ? String(req.body.symbol || '').trim() : currency.symbol
    const wantsBase = req.body.baseCurrency !== undefined ? Boolean(req.body.baseCurrency) : currency.baseCurrency
    const nextIsActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : currency.isActive
    const nextRate = req.body.exchangeRate !== undefined ? Number(req.body.exchangeRate) : Number(currency.exchangeRate || 1)

    if (!nextCode || nextCode.length < 2 || nextCode.length > 10) {
      return res.status(400).json({ success: false, message: 'Currency code is required (2-10 chars).' })
    }
    if (!nextName) return res.status(400).json({ success: false, message: 'Currency name is required.' })
    if (!nextSymbol) return res.status(400).json({ success: false, message: 'Currency symbol is required.' })
    if (!Number.isFinite(nextRate) || nextRate <= 0) {
      return res.status(400).json({ success: false, message: 'Exchange rate must be greater than zero.' })
    }
    if (currency.baseCurrency && !wantsBase) {
      return res.status(400).json({ success: false, message: 'At least one base currency is required.' })
    }
    if (currency.baseCurrency && !nextIsActive) {
      return res.status(400).json({ success: false, message: 'Base currency cannot be inactive.' })
    }

    const duplicate = await Currency.findOne({ code: nextCode, _id: { $ne: currency._id } })
    if (duplicate) {
      return res.status(409).json({ success: false, message: 'Currency code already exists.' })
    }

    currency.code = nextCode
    currency.name = nextName
    currency.symbol = nextSymbol
    currency.isActive = nextIsActive
    currency.baseCurrency = wantsBase
    currency.exchangeRate = wantsBase ? 1 : nextRate
    currency.rateUpdatedAt = new Date()
    await currency.save()

    if (wantsBase) {
      await Currency.updateMany({ _id: { $ne: currency._id }, baseCurrency: true }, { $set: { baseCurrency: false } })
    } else {
      await ensureBaseCurrencyConfig()
    }

    res.json({ success: true, currency })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.delete('/currencies/:id', protect, async (req, res) => {
  try {
    if (!canManageAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const currency = await Currency.findById(req.params.id)
    if (!currency) {
      return res.status(404).json({ success: false, message: 'Currency not found.' })
    }

    if (currency.baseCurrency) {
      return res.status(400).json({ success: false, message: 'Base currency cannot be deleted.' })
    }

    await Currency.deleteOne({ _id: currency._id })
    await ensureBaseCurrencyConfig()
    res.json({ success: true, message: 'Currency deleted.' })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ==========================================
// VENDORS MODULE
// ==========================================
router.get('/vendors', protect, async (req, res) => {
  try {
    if (!canAccessVendors(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const { page, limit, skip } = parsePagination(req.query, 25, 100)

    const includeInactive = String(req.query.includeInactive || 'false').toLowerCase() === 'true'
    const search = String(req.query.search || '').trim()
    const status = String(req.query.status || '').trim()
    const approvalStatus = String(req.query.approvalStatus || '').trim()
    const riskLevel = String(req.query.riskLevel || '').trim()
    const category = String(req.query.category || '').trim()

    const query = { deletedAt: null }
    if (!includeInactive) query.isActive = true
    if (status) query.status = status
    if (approvalStatus) query.approvalStatus = approvalStatus
    if (riskLevel) query.riskLevel = riskLevel
    if (category) query.category = category
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { vendorCode: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ]
    }

    const [vendors, total] = await Promise.all([
      Vendor.find(query)
        .populate({
          path: 'ledgerAccountId',
          select: 'accountCode accountName accountType isActive',
          match: { isActive: true },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Vendor.countDocuments(query),
    ])

    const data = await Promise.all(vendors.map(async (vendor) => {
      const summary = await buildVendorSummary(vendor)
      return {
        ...vendor.toObject(),
        ...summary,
      }
    }))

    const totals = data.reduce((acc, row) => {
      acc.count += 1
      acc.outstanding += Number(row.outstanding || 0)
      acc.overLimit += row.isOverLimit ? 1 : 0
      acc.blacklisted += row.status === 'blacklisted' ? 1 : 0
      acc.onHold += row.status === 'on_hold' ? 1 : 0
      acc.draft += row.approvalStatus === 'draft' ? 1 : 0
      acc.review += row.approvalStatus === 'review' ? 1 : 0
      acc.approved += row.approvalStatus === 'approved' ? 1 : 0
      acc.nonCompliant += row.compliance?.compliant ? 0 : 1
      return acc
    }, { count: 0, outstanding: 0, overLimit: 0, blacklisted: 0, onHold: 0, draft: 0, review: 0, approved: 0, nonCompliant: 0 })

    res.json({
      success: true,
      vendors: data,
      total,
      page,
      limit,
      summary: {
        totalVendors: totals.count,
        totalOutstanding: toMoney(totals.outstanding),
        overLimit: totals.overLimit,
        blacklisted: totals.blacklisted,
        onHold: totals.onHold,
        draft: totals.draft,
        review: totals.review,
        approved: totals.approved,
        nonCompliant: totals.nonCompliant,
      },
      permissions: {
        canManage: canManageVendors(req.user),
        canUpdateOperational: canUpdateVendorOperational(req.user),
      },
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/vendors/compliance-summary', protect, async (req, res) => {
  try {
    if (!canAccessVendors(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const { page, limit, skip } = parsePagination(req.query, 25, 100)

    const includeInactive = String(req.query.includeInactive || 'false').toLowerCase() === 'true'
    const query = { deletedAt: null }
    if (!includeInactive) query.isActive = true

    const [vendors, total] = await Promise.all([
      Vendor.find(query)
        .select('name vendorCode category approvalStatus status documents')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Vendor.countDocuments(query),
    ])

    const complianceRows = vendors.map((vendor) => {
      const compliance = evaluateVendorCompliance(vendor)
      return {
        vendorId: vendor._id,
        vendorName: vendor.name,
        vendorCode: vendor.vendorCode || '',
        category: compliance.category,
        approvalStatus: vendor.approvalStatus || 'draft',
        status: vendor.status || 'active',
        ...compliance,
      }
    })

    const summary = complianceRows.reduce((acc, row) => {
      acc.total += 1
      if (!row.compliant) acc.nonCompliant += 1
      acc.avgComplianceScore += Number(row.complianceScore || 0)
      acc.requiredDocs += row.requiredDocuments.length
      acc.missingDocs += row.missingDocuments.length
      acc.expiredRequiredDocs += row.expiredRequiredDocuments.length
      return acc
    }, { total: 0, nonCompliant: 0, avgComplianceScore: 0, requiredDocs: 0, missingDocs: 0, expiredRequiredDocs: 0 })

    summary.avgComplianceScore = summary.total > 0 ? toMoney(summary.avgComplianceScore / summary.total) : 0

    const expiry = buildDocumentExpiryBuckets(vendors)

    res.json({
      success: true,
      rules: REQUIRED_VENDOR_DOCUMENTS_BY_CATEGORY,
      total,
      page,
      limit,
      summary,
      expiryBuckets: expiry.buckets,
      atRisk: complianceRows
        .filter((row) => !row.compliant)
        .sort((a, b) => Number(a.complianceScore || 0) - Number(b.complianceScore || 0))
        .slice(0, 100),
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/vendors/alerts/overdue-queue', protect, async (req, res) => {
  try {
    if (!canAccessVendors(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const horizonDays = Number(req.query.horizonDays || 120)
    const { page, limit, skip } = parsePagination(req.query, 25, 100)
    const vendorQuery = { isActive: true, deletedAt: null }
    const [vendors, totalVendors] = await Promise.all([
      Vendor.find(vendorQuery)
        .select('name vendorCode email contactPerson paymentTermsDays currency approvalStatus status ledgerAccountId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Vendor.countDocuments(vendorQuery),
    ])

    const queue = []

    for (let i = 0; i < vendors.length; i += 1) {
      const vendor = vendors[i]
      const schedule = await buildVendorPaymentCalendar(vendor, { horizonDays })
      schedule.calendar
        .filter((entry) => entry.alertLevel === 'overdue')
        .forEach((entry) => {
          const dueAmount = Number(entry.remaining || 0)
          const overdueDays = Math.abs(Number(entry.daysToDue || 0))
          const subject = `Overdue vendor payment: ${vendor.name} (${vendor.vendorCode || 'N/A'})`
          const recipient = vendor.email || ''
          const preview = `${dueAmount.toLocaleString()} ${entry.currency || vendor.currency || 'USD'} overdue by ${overdueDays} days`

          queue.push({
            queueId: `VENDOR-DUE-${vendor._id}-${entry.purchaseTransactionId}`,
            channel: 'email',
            priority: overdueDays > 30 ? 'high' : 'normal',
            to: recipient ? [recipient] : [],
            cc: [],
            subject,
            preview,
            bodyText: [
              'Dear Vendor Team,',
              '',
              `This is a payment reminder for ${vendor.name}.`,
              `Outstanding amount: ${dueAmount.toLocaleString()} ${entry.currency || vendor.currency || 'USD'}.`,
              `Invoice due date: ${new Date(entry.dueDate).toLocaleDateString()}.`,
              `Overdue by: ${overdueDays} days.`,
              '',
              'Please coordinate with Accounts Payable for settlement confirmation.',
              '',
              'Regards,',
              'Finance Control',
            ].join('\n'),
            metadata: {
              vendorId: vendor._id,
              vendorName: vendor.name,
              vendorCode: vendor.vendorCode || '',
              contactPerson: vendor.contactPerson || '',
              approvalStatus: vendor.approvalStatus || 'draft',
              vendorStatus: vendor.status || 'active',
              dueDate: entry.dueDate,
              overdueDays,
              purchaseTransactionId: entry.purchaseTransactionId,
              currency: entry.currency || vendor.currency || 'USD',
              amountDue: toMoney(dueAmount),
            },
            createdAt: new Date(),
          })
        })
    }

    queue.sort((a, b) => Number(b.metadata?.overdueDays || 0) - Number(a.metadata?.overdueDays || 0))
    const summary = queue.reduce((acc, row) => {
      acc.total += 1
      acc.withRecipient += row.to.length ? 1 : 0
      acc.totalAmountDue = toMoney((acc.totalAmountDue || 0) + Number(row.metadata?.amountDue || 0))
      if ((row.metadata?.overdueDays || 0) > 30) acc.critical += 1
      return acc
    }, { total: 0, withRecipient: 0, critical: 0, totalAmountDue: 0 })

    res.json({ success: true, summary, queue, page, limit, totalVendors })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/vendors', protect, async (req, res) => {
  try {
    if (!canManageVendors(req.user)) {
      return res.status(403).json({ success: false, message: 'Only Admin/Finance can create vendors' })
    }

    const {
      vendorCode,
      name,
      contactPerson,
      phone,
      email,
      address,
      city,
      country,
      postalCode,
      gstVat,
      taxRegistrationNo,
      openingBalance,
      paymentTermsDays,
      creditLimit,
      category,
      rating,
      riskLevel,
      status,
      notes,
      tags,
      preferredCurrency,
      bankName,
      bankAccountNumber,
      iban,
      swiftCode,
      currency,
    } = req.body
    if (!name) return res.status(400).json({ success: false, message: 'Vendor name is required' })

    const normalizedCode = String(vendorCode || '').trim().toUpperCase() || await nextVendorCode()
    const duplicateCode = await Vendor.exists({ vendorCode: normalizedCode, deletedAt: null })
    if (duplicateCode) {
      return res.status(400).json({ success: false, message: 'Vendor code already exists' })
    }

    const accountCode = await nextVendorAccountCode()
    const creditorAccount = await ChartOfAccount.create({
      accountName: `${name} (Creditor)`,
      accountCode,
      accountType: 'Liability',
      currency: currency || 'USD',
      description: `Auto-created payable account for vendor ${name}`,
      createdBy: req.user._id,
    })

    const vendor = await Vendor.create({
      vendorCode: normalizedCode,
      name,
      contactPerson: contactPerson || '',
      phone,
      email,
      address,
      city: city || '',
      country: country || '',
      postalCode: postalCode || '',
      gstVat,
      taxRegistrationNo: taxRegistrationNo || '',
      openingBalance: Number(openingBalance || 0),
      paymentTermsDays: Number(paymentTermsDays || 30),
      creditLimit: Number(creditLimit || 0),
      category: category || 'general',
      rating: Math.min(Math.max(Number(rating || 3), 1), 5),
      riskLevel: ['low', 'medium', 'high'].includes(String(riskLevel || '')) ? riskLevel : 'medium',
      status: ['active', 'on_hold', 'blacklisted'].includes(String(status || '')) ? status : 'active',
      approvalStatus: 'draft',
      approvalHistory: [{ status: 'draft', reason: 'Vendor profile created', changedBy: req.user._id, changedAt: new Date() }],
      notes: notes || '',
      tags: Array.isArray(tags) ? tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 20) : [],
      preferredCurrency: String(preferredCurrency || currency || 'USD').toUpperCase(),
      bankName: bankName || '',
      bankAccountNumber: bankAccountNumber || '',
      iban: iban || '',
      swiftCode: swiftCode || '',
      currency: currency || 'USD',
      ledgerAccountId: creditorAccount._id,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    })

    const opening = Number(openingBalance || 0)
    if (opening > 0) {
      const inventoryAccount = await ChartOfAccount.findOne({ accountType: 'Asset', isActive: true }).sort({ accountCode: 1 })
      if (inventoryAccount) {
        await Ledger.create({
          date: new Date(),
          debitAccountId: inventoryAccount._id,
          creditAccountId: creditorAccount._id,
          amount: opening,
          description: `Opening balance for vendor ${name}`,
          referenceType: 'journal',
          createdBy: req.user._id,
          updatedBy: req.user._id,
          department: req.user.department,
          currency: currency || 'USD',
        })
      }
    }

    res.status(201).json({ success: true, vendor })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Server error' })
  }
})

router.put('/vendors/:id', protect, async (req, res) => {
  try {
    if (!canUpdateVendorOperational(req.user)) {
      return res.status(403).json({ success: false, message: 'Only Admin/Finance/Operations can update vendors' })
    }

    const vendor = await Vendor.findById(req.params.id)
    if (!vendor || vendor.deletedAt) return res.status(404).json({ success: false, message: 'Vendor not found' })

    const isFinanceManager = canManageVendors(req.user)
    const financeAllowed = [
      'vendorCode',
      'name',
      'contactPerson',
      'phone',
      'email',
      'address',
      'city',
      'country',
      'postalCode',
      'gstVat',
      'taxRegistrationNo',
      'currency',
      'preferredCurrency',
      'paymentTermsDays',
      'creditLimit',
      'category',
      'rating',
      'riskLevel',
      'status',
      'notes',
      'tags',
      'bankName',
      'bankAccountNumber',
      'iban',
      'swiftCode',
      'isActive',
    ]
    const operationalAllowed = ['contactPerson', 'phone', 'email', 'address', 'city', 'country', 'postalCode', 'category', 'rating', 'riskLevel', 'status', 'notes', 'tags']

    const updates = {}
    const allowed = isFinanceManager ? financeAllowed : operationalAllowed
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field]
    })

    if (updates.vendorCode) {
      updates.vendorCode = String(updates.vendorCode).trim().toUpperCase()
      const duplicateCode = await Vendor.exists({ _id: { $ne: vendor._id }, vendorCode: updates.vendorCode, deletedAt: null })
      if (duplicateCode) return res.status(400).json({ success: false, message: 'Vendor code already exists' })
    }

    if (updates.rating !== undefined) updates.rating = Math.min(Math.max(Number(updates.rating || 3), 1), 5)
    if (updates.paymentTermsDays !== undefined) updates.paymentTermsDays = Math.max(0, Number(updates.paymentTermsDays || 0))
    if (updates.creditLimit !== undefined) updates.creditLimit = Math.max(0, Number(updates.creditLimit || 0))
    if (updates.tags !== undefined) {
      updates.tags = Array.isArray(updates.tags)
        ? updates.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 20)
        : String(updates.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 20)
    }
    updates.updatedBy = req.user._id

    const updatedVendor = await Vendor.findByIdAndUpdate(req.params.id, updates, { new: true })
    if (!updatedVendor) return res.status(404).json({ success: false, message: 'Vendor not found' })

    if ((updates.name || updates.currency) && updatedVendor.ledgerAccountId) {
      const ledgerUpdates = {}
      if (updates.name) ledgerUpdates.accountName = `${updates.name} (Creditor)`
      if (updates.currency) ledgerUpdates.currency = updates.currency
      if (Object.keys(ledgerUpdates).length) {
        await ChartOfAccount.findByIdAndUpdate(updatedVendor.ledgerAccountId, ledgerUpdates)
      }
    }

    res.json({ success: true, vendor: updatedVendor })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/vendors/:id/details', protect, async (req, res) => {
  try {
    if (!canAccessVendors(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const vendor = await Vendor.findById(req.params.id)
      .populate('ledgerAccountId', 'accountCode accountName accountType currency')
    if (!vendor || vendor.deletedAt) return res.status(404).json({ success: false, message: 'Vendor not found' })

    const [summary, paymentCalendar] = await Promise.all([
      buildVendorSummary(vendor),
      buildVendorPaymentCalendar(vendor, { horizonDays: 45 }),
    ])
    const recentTransactions = await Transaction.find({ vendorId: vendor._id, isDeleted: { $ne: true } })
      .sort({ date: -1, createdAt: -1 })
      .limit(20)
      .select('type amount date description currency status journalEntryId')
    const recentLedgerEntries = await Ledger.find({
      $or: [
        { debitAccountId: vendor.ledgerAccountId?._id },
        { creditAccountId: vendor.ledgerAccountId?._id },
      ],
    })
      .sort({ date: -1, createdAt: -1 })
      .limit(20)
      .populate('debitAccountId', 'accountCode accountName')
      .populate('creditAccountId', 'accountCode accountName')
      .select('date amount description referenceType currency debitAccountId creditAccountId')

    res.json({
      success: true,
      vendor: {
        ...vendor.toObject(),
        ...summary,
      },
      recentTransactions,
      recentLedgerEntries,
      paymentCalendar: paymentCalendar.calendar,
      paymentAlerts: paymentCalendar.alertCounts,
      permissions: {
        canManage: canManageVendors(req.user),
        canUpdateOperational: canUpdateVendorOperational(req.user),
      },
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/vendors/:id/workflow', protect, async (req, res) => {
  try {
    if (!canUpdateVendorOperational(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const nextStatus = String(req.body.status || '').trim().toLowerCase()
    const reason = String(req.body.reason || '').trim()
    const allowedStatuses = ['draft', 'review', 'approved', 'blacklisted']
    if (!allowedStatuses.includes(nextStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid workflow status' })
    }

    if ((nextStatus === 'approved' || nextStatus === 'blacklisted') && !canManageVendors(req.user)) {
      return res.status(403).json({ success: false, message: 'Only Admin/Finance can approve or blacklist vendors' })
    }

    const vendor = await Vendor.findById(req.params.id)
    if (!vendor || vendor.deletedAt) return res.status(404).json({ success: false, message: 'Vendor not found' })

    vendor.approvalStatus = nextStatus
    if (nextStatus === 'blacklisted') {
      vendor.status = 'blacklisted'
      vendor.isActive = false
    } else if (nextStatus === 'approved' && vendor.status === 'blacklisted') {
      vendor.status = 'active'
      vendor.isActive = true
    }
    vendor.approvalHistory.push({ status: nextStatus, reason, changedBy: req.user._id, changedAt: new Date() })
    vendor.updatedBy = req.user._id
    await vendor.save()

    res.json({ success: true, vendor })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/vendors/:id/documents', protect, async (req, res) => {
  try {
    if (!canAccessVendors(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const vendor = await Vendor.findById(req.params.id).select('name vendorCode documents')
    if (!vendor || vendor.deletedAt) return res.status(404).json({ success: false, message: 'Vendor not found' })
    res.json({ success: true, vendorId: vendor._id, vendorName: vendor.name, vendorCode: vendor.vendorCode || '', documents: vendor.documents || [] })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/vendors/:id/documents', protect, async (req, res) => {
  try {
    if (!canUpdateVendorOperational(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const vendor = await Vendor.findById(req.params.id)
    if (!vendor || vendor.deletedAt) return res.status(404).json({ success: false, message: 'Vendor not found' })

    const title = String(req.body.title || '').trim()
    if (!title) return res.status(400).json({ success: false, message: 'Document title is required' })

    vendor.documents.push({
      docType: ['contract', 'trade_license', 'vat_certificate', 'bank_proof', 'other'].includes(String(req.body.docType || '').trim()) ? req.body.docType : 'other',
      title,
      documentNo: String(req.body.documentNo || '').trim(),
      fileUrl: String(req.body.fileUrl || '').trim(),
      issueDate: req.body.issueDate ? new Date(req.body.issueDate) : null,
      expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : null,
      status: ['active', 'expired', 'pending_verification'].includes(String(req.body.status || '').trim()) ? req.body.status : 'active',
      verified: Boolean(req.body.verified),
      notes: String(req.body.notes || '').trim(),
      uploadedBy: req.user._id,
    })
    vendor.updatedBy = req.user._id
    await vendor.save()

    res.status(201).json({ success: true, documents: vendor.documents || [] })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.put('/vendors/:id/documents/:documentId', protect, async (req, res) => {
  try {
    if (!canUpdateVendorOperational(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const vendor = await Vendor.findById(req.params.id)
    if (!vendor || vendor.deletedAt) return res.status(404).json({ success: false, message: 'Vendor not found' })

    const doc = vendor.documents.id(req.params.documentId)
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' })

    const allowed = ['docType', 'title', 'documentNo', 'fileUrl', 'issueDate', 'expiryDate', 'status', 'verified', 'notes']
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) {
        if ((field === 'issueDate' || field === 'expiryDate') && req.body[field]) doc[field] = new Date(req.body[field])
        else doc[field] = req.body[field]
      }
    })

    vendor.updatedBy = req.user._id
    await vendor.save()

    res.json({ success: true, documents: vendor.documents || [] })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.delete('/vendors/:id/documents/:documentId', protect, async (req, res) => {
  try {
    if (!canUpdateVendorOperational(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const vendor = await Vendor.findById(req.params.id)
    if (!vendor || vendor.deletedAt) return res.status(404).json({ success: false, message: 'Vendor not found' })

    const doc = vendor.documents.id(req.params.documentId)
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' })
    doc.deleteOne()
    vendor.updatedBy = req.user._id
    await vendor.save()

    res.json({ success: true, documents: vendor.documents || [] })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/vendors/payment-calendar', protect, async (req, res) => {
  try {
    if (!canAccessVendors(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const horizonDays = Number(req.query.horizonDays || 45)
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null
    const { page, limit, skip } = parsePagination(req.query, 25, 100)

    const vendorQuery = { isActive: true, deletedAt: null }
    const [vendors, totalVendors] = await Promise.all([
      Vendor.find(vendorQuery)
        .select('name vendorCode paymentTermsDays currency status approvalStatus')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Vendor.countDocuments(vendorQuery),
    ])
    const rows = []
    for (let i = 0; i < vendors.length; i += 1) {
      const vendor = vendors[i]
      const schedule = await buildVendorPaymentCalendar(vendor, { horizonDays, startDate, endDate })
      schedule.calendar.forEach((item) => {
        rows.push({
          vendorId: vendor._id,
          vendorName: vendor.name,
          vendorCode: vendor.vendorCode || '',
          approvalStatus: vendor.approvalStatus || 'draft',
          status: vendor.status || 'active',
          ...item,
        })
      })
    }

    rows.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    const alerts = rows.reduce((acc, row) => {
      acc[row.alertLevel] = (acc[row.alertLevel] || 0) + 1
      acc.totalDue = toMoney((acc.totalDue || 0) + Number(row.remaining || 0))
      return acc
    }, { overdue: 0, due_soon: 0, upcoming: 0, later: 0, totalDue: 0 })

    res.json({ success: true, rows, alerts, page, limit, totalVendors })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.delete('/vendors/:id', protect, async (req, res) => {
  try {
    if (!canManageVendors(req.user)) {
      return res.status(403).json({ success: false, message: 'Only Admin/Finance can delete vendors' })
    }

    const vendor = await Vendor.findByIdAndUpdate(req.params.id, {
      isActive: false,
      deletedAt: new Date(),
      updatedBy: req.user._id,
    }, { new: true })

    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' })

    if (vendor.ledgerAccountId) {
      await ChartOfAccount.findByIdAndUpdate(vendor.ledgerAccountId, { isActive: false })
    }

    res.json({ success: true, message: 'Vendor deactivated', vendor })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ==========================================
// INVENTORY MODULE
// ==========================================
router.get('/inventory/products', protect, async (req, res) => {
  try {
    if (!canAccessInventory(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { page, limit, skip } = parsePagination(req.query, 25, 100)
    const query = { isDeleted: { $ne: true } }
    const [products, total] = await Promise.all([
      InventoryItem.find(query)
        .populate('ledgerAccountId', 'accountCode accountName')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      InventoryItem.countDocuments(query),
    ])
    res.json({ success: true, products, total, page, limit })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/inventory/products', protect, async (req, res) => {
  try {
    if (!canAccessInventory(req.user) || !(isSuperAdmin(req.user) || isFinance(req.user) || isOperations(req.user) || isProduction(req.user))) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    const { sku, name, category, unit, unitCost, sellingPrice, quantity, currency, minThreshold, supplierName, weight, wipStage } = req.body
    if (!name) return res.status(400).json({ success: false, message: 'Product name is required' })

    const accountCode = await nextInventoryAccountCode()
    const stockAccount = await ChartOfAccount.create({
      accountName: `${name} Stock`,
      accountCode,
      accountType: 'Asset',
      currency: currency || 'USD',
      description: `Auto-created stock account for ${name}`,
      createdBy: req.user._id,
    })

    const product = await InventoryItem.create({
      sku,
      name,
      category,
      unit: unit || 'pcs',
      minThreshold: Number(minThreshold || 0),
      unitCost: Number(unitCost || 0),
      sellingPrice: Number(sellingPrice || 0),
      quantity: Number(quantity || 0),
      supplierName: String(supplierName || '').trim(),
      weight: Number(weight || 0),
      wipStage: String(wipStage || '').trim(),
      ledgerAccountId: stockAccount._id,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    })

    res.status(201).json({ success: true, product })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Server error' })
  }
})

router.post('/inventory/stock-in', protect, async (req, res) => {
  try {
    if (!canAccessInventory(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { itemId, quantity, unitCost, vendorId, currency = 'USD', description = '' } = req.body
    const qty = Number(quantity || 0)
    const cost = Number(unitCost || 0)
    if (!itemId || qty <= 0) return res.status(400).json({ success: false, message: 'Item and positive quantity are required' })

    const item = await InventoryItem.findById(itemId)
    if (!item || item.isDeleted) return res.status(404).json({ success: false, message: 'Product not found' })

    const before = Number(item.quantity || 0)
    item.quantity = before + qty
    item.unitCost = cost || item.unitCost
    item.updatedBy = req.user._id
    item.lastRestockedAt = new Date()
    await item.save()

    await StockMovement.create({
      itemId: item._id,
      itemName: item.name,
      change: qty,
      quantityBefore: before,
      quantityAfter: item.quantity,
      reason: 'Stock IN (purchase)',
      actorId: req.user._id,
      actorName: req.user.name,
    })

    let payableAccountId = null
    if (vendorId) {
      const vendor = await Vendor.findById(vendorId)
      payableAccountId = vendor?.ledgerAccountId || null
    }
    if (!payableAccountId) {
      const defaultLiability = await ChartOfAccount.findOne({ accountType: 'Liability', isActive: true }).sort({ accountCode: 1 })
      payableAccountId = defaultLiability?._id || null
    }

    if (!item.ledgerAccountId || !payableAccountId) {
      return res.status(400).json({ success: false, message: 'Inventory or vendor payable account missing' })
    }

    const amount = toMoney(qty * (cost || Number(item.unitCost || 0)))
    const ledgerEntry = await Ledger.create({
      date: new Date(),
      debitAccountId: item.ledgerAccountId,
      creditAccountId: payableAccountId,
      amount,
      description: description || `Stock IN for ${item.name}`,
      referenceType: 'purchase',
      createdBy: req.user._id,
      updatedBy: req.user._id,
      department: req.user.department,
      currency,
    })

    res.json({ success: true, product: item, ledgerEntry })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Server error' })
  }
})

router.post('/inventory/stock-out', protect, async (req, res) => {
  try {
    if (!canAccessInventory(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { itemId, quantity, currency = 'USD', description = '' } = req.body
    const qty = Number(quantity || 0)
    if (!itemId || qty <= 0) return res.status(400).json({ success: false, message: 'Item and positive quantity are required' })

    const item = await InventoryItem.findById(itemId)
    if (!item || item.isDeleted) return res.status(404).json({ success: false, message: 'Product not found' })

    const before = Number(item.quantity || 0)
    item.quantity = before - qty
    item.updatedBy = req.user._id
    await item.save()

    await StockMovement.create({
      itemId: item._id,
      itemName: item.name,
      change: -qty,
      quantityBefore: before,
      quantityAfter: item.quantity,
      reason: 'Stock OUT (sale)',
      actorId: req.user._id,
      actorName: req.user.name,
    })

    const cogsAccount = await ChartOfAccount.findOne({ accountType: 'Expense', isActive: true, accountName: /cogs|cost of goods sold/i })
      || await ChartOfAccount.findOne({ accountType: 'Expense', isActive: true }).sort({ accountCode: 1 })
    if (!item.ledgerAccountId || !cogsAccount) {
      return res.status(400).json({ success: false, message: 'Inventory or COGS account missing' })
    }

    const amount = toMoney(qty * Number(item.unitCost || 0))
    const ledgerEntry = await Ledger.create({
      date: new Date(),
      debitAccountId: cogsAccount._id,
      creditAccountId: item.ledgerAccountId,
      amount,
      description: description || `Stock OUT for ${item.name}`,
      referenceType: 'cogs',
      createdBy: req.user._id,
      updatedBy: req.user._id,
      department: req.user.department,
      currency,
    })

    res.json({ success: true, product: item, ledgerEntry })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Server error' })
  }
})

router.put('/inventory/products/:id', protect, async (req, res) => {
  try {
    if (!canAccessInventory(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const product = await InventoryItem.findById(req.params.id)
    if (!product || product.isDeleted) return res.status(404).json({ success: false, message: 'Product not found' })

    const { sku, name, category, unit, unitCost, sellingPrice, minThreshold, supplierName, weight, wipStage } = req.body
    if (name !== undefined) product.name = name
    if (sku !== undefined) product.sku = sku
    if (category !== undefined) product.category = category
    if (unit !== undefined) product.unit = unit
    if (minThreshold !== undefined) product.minThreshold = Number(minThreshold || 0)
    if (unitCost !== undefined) product.unitCost = Number(unitCost || 0)
    if (sellingPrice !== undefined) product.sellingPrice = Number(sellingPrice || 0)
    if (supplierName !== undefined) product.supplierName = String(supplierName || '').trim()
    if (weight !== undefined) product.weight = Number(weight || 0)
    if (wipStage !== undefined) product.wipStage = String(wipStage || '').trim()
    product.updatedBy = req.user._id
    await product.save()

    res.json({ success: true, product })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Server error' })
  }
})

router.delete('/inventory/products/:id', protect, async (req, res) => {
  try {
    if (!(isSuperAdmin(req.user) || isFinance(req.user))) return res.status(403).json({ success: false, message: 'Forbidden' })
    const product = await InventoryItem.findById(req.params.id)
    if (!product || product.isDeleted) return res.status(404).json({ success: false, message: 'Product not found' })

    if (Number(product.quantity || 0) > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete a product with stock on hand. Reduce stock to zero first.' })
    }

    product.isDeleted = true
    product.updatedBy = req.user._id
    await product.save()

    res.json({ success: true, message: 'Product deleted' })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Server error' })
  }
})

router.get('/inventory/stock-ledger', protect, async (req, res) => {
  try {
    if (!canAccessInventory(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { page, limit, skip } = parsePagination(req.query, 50, 200)
    const [movements, total] = await Promise.all([
      StockMovement.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
      StockMovement.countDocuments({}),
    ])
    res.json({ success: true, movements, total, page, limit })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.delete('/inventory/stock-ledger', protect, async (req, res) => {
  try {
    if (!isSuperAdmin(req.user) && !isFinance(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }
    const result = await StockMovement.deleteMany({})
    res.json({ success: true, deletedCount: result.deletedCount || 0 })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ==========================================
// DIRECT DEALS MODULE (FIXING / NON-FIXING)
// ==========================================
router.get('/direct-deals', protect, async (req, res) => {
  try {
    if (!canAccessDirectDeals(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const { page, limit, skip } = parsePagination(req.query, 25, 100)
    const query = { isDeleted: { $ne: true } }

    if (req.query.entryType && ['fixing', 'non_fixing'].includes(String(req.query.entryType))) {
      query.entryType = String(req.query.entryType)
    }
    if (req.query.status && ['draft', 'confirmed'].includes(String(req.query.status))) {
      query.status = String(req.query.status)
    }
    if (req.query.startDate || req.query.endDate) {
      query.docDate = {}
      if (req.query.startDate) query.docDate.$gte = new Date(req.query.startDate)
      if (req.query.endDate) {
        const end = new Date(req.query.endDate)
        end.setHours(23, 59, 59, 999)
        query.docDate.$lte = end
      }
    }
    if (req.query.search) {
      const rx = new RegExp(String(req.query.search).trim(), 'i')
      query.$or = [
        { docNo: rx },
        { remarks: rx },
        { 'lineItems.customerName': rx },
        { 'lineItems.customerCode': rx },
        { 'lineItems.metal': rx },
      ]
    }

    const [deals, total] = await Promise.all([
      DirectDeal.find(query)
        .populate('createdBy', 'name')
        .populate('updatedBy', 'name')
        .populate('lineItems.customerId', 'name code')
        .sort({ docDate: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      DirectDeal.countDocuments(query),
    ])

    const summary = deals.reduce((acc, deal) => {
      acc.totalQty = toQty(acc.totalQty + Number(deal.totalQty || 0))
      acc.totalAmount = toMoney(acc.totalAmount + Number(deal.totalAmount || 0))
      acc.fixing = acc.fixing + (deal.entryType === 'fixing' ? 1 : 0)
      acc.nonFixing = acc.nonFixing + (deal.entryType === 'non_fixing' ? 1 : 0)
      return acc
    }, { totalQty: 0, totalAmount: 0, fixing: 0, nonFixing: 0 })

    res.json({ success: true, deals, total, page, limit, summary, permissions: { canManage: canManageDirectDeals(req.user) } })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Server error' })
  }
})

router.post('/direct-deals', protect, async (req, res) => {
  try {
    if (!canManageDirectDeals(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const {
      docNo,
      entryType = 'fixing',
      docDate,
      valueDate,
      currency = 'USD',
      branch = 'HO',
      status = 'draft',
      remarks = '',
      lineItems = [],
    } = req.body || {}

    if (!['fixing', 'non_fixing'].includes(String(entryType))) {
      return res.status(400).json({ success: false, message: 'Entry type must be fixing or non_fixing' })
    }
    if (!Array.isArray(lineItems) || !lineItems.length) {
      return res.status(400).json({ success: false, message: 'At least one line item is required' })
    }

    const normalizedLines = await Promise.all(lineItems.map((line, idx) => normalizeDirectDealLine(line, idx)))

    const totalQty = toQty(normalizedLines.reduce((sum, line) => sum + Number(line.qty || 0), 0))
    const totalAmount = toMoney(normalizedLines.reduce((sum, line) => sum + Number(line.amount || 0), 0))

    const deal = await DirectDeal.create({
      docNo: String(docNo || '').trim() || await nextDirectDealDocNo(),
      entryType,
      docDate: docDate ? new Date(docDate) : new Date(),
      valueDate: valueDate ? new Date(valueDate) : (docDate ? new Date(docDate) : new Date()),
      currency: String(currency || 'USD').toUpperCase(),
      branch: String(branch || 'HO').trim(),
      status: ['draft', 'confirmed'].includes(String(status)) ? String(status) : 'draft',
      remarks: String(remarks || '').trim(),
      lineItems: normalizedLines,
      totalQty,
      totalAmount,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    })

    await syncDirectDealLedger({ deal, user: req.user })

    res.status(201).json({ success: true, deal })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message || 'Invalid direct deal payload' })
  }
})

router.put('/direct-deals/:id', protect, async (req, res) => {
  try {
    if (!canManageDirectDeals(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const deal = await DirectDeal.findById(req.params.id)
    if (!deal || deal.isDeleted) return res.status(404).json({ success: false, message: 'Direct deal not found' })
    if (deal.status === 'confirmed' && !isSuperAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Confirmed direct deals are locked. Only Admin can edit.' })
    }

    const {
      docNo,
      entryType,
      docDate,
      valueDate,
      currency,
      branch,
      status,
      remarks,
      lineItems,
    } = req.body || {}

    if (entryType !== undefined) {
      if (!['fixing', 'non_fixing'].includes(String(entryType))) {
        return res.status(400).json({ success: false, message: 'Entry type must be fixing or non_fixing' })
      }
      deal.entryType = String(entryType)
    }
    if (docNo !== undefined) deal.docNo = String(docNo || '').trim() || deal.docNo
    if (docDate !== undefined) deal.docDate = docDate ? new Date(docDate) : deal.docDate
    if (valueDate !== undefined) deal.valueDate = valueDate ? new Date(valueDate) : deal.valueDate
    if (currency !== undefined) deal.currency = String(currency || deal.currency).toUpperCase()
    if (branch !== undefined) deal.branch = String(branch || '').trim()
    if (status !== undefined && ['draft', 'confirmed'].includes(String(status))) {
      const nextStatus = String(status)
      if (deal.status === 'confirmed' && nextStatus !== 'confirmed' && !isSuperAdmin(req.user)) {
        return res.status(403).json({ success: false, message: 'Only Admin can reopen confirmed direct deals' })
      }
      deal.status = nextStatus
    }
    if (remarks !== undefined) deal.remarks = String(remarks || '').trim()

    if (lineItems !== undefined) {
      if (!Array.isArray(lineItems) || !lineItems.length) {
        return res.status(400).json({ success: false, message: 'At least one line item is required' })
      }
      const normalizedLines = await Promise.all(lineItems.map((line, idx) => normalizeDirectDealLine(line, idx)))
      deal.lineItems = normalizedLines
      deal.totalQty = toQty(normalizedLines.reduce((sum, line) => sum + Number(line.qty || 0), 0))
      deal.totalAmount = toMoney(normalizedLines.reduce((sum, line) => sum + Number(line.amount || 0), 0))
    }

    deal.updatedBy = req.user._id
    await deal.save()
    await syncDirectDealLedger({ deal, user: req.user })

    res.json({ success: true, deal })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message || 'Invalid update payload' })
  }
})

router.delete('/direct-deals/:id', protect, async (req, res) => {
  try {
    if (!canManageDirectDeals(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const deal = await DirectDeal.findById(req.params.id)
    if (!deal || deal.isDeleted) return res.status(404).json({ success: false, message: 'Direct deal not found' })
    if (deal.status === 'confirmed' && !isSuperAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Confirmed direct deals are locked. Only Admin can delete.' })
    }

    deal.isDeleted = true
    deal.deletedAt = new Date()
    deal.updatedBy = req.user._id
    await deal.save()

    await Ledger.updateMany(
      { referenceType: 'direct_deal', referenceId: deal._id, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt: new Date(), updatedBy: req.user._id } }
    )

    res.json({ success: true, message: 'Direct deal deleted', deal })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Server error' })
  }
})

// ==========================================
// TRANSACTIONS MODULE (CORE ENGINE)
// ==========================================
router.get('/transactions', protect, async (req, res) => {
  try {
    if (!canAccessTransactions(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    const { page, limit, skip } = parsePagination(req.query, 50, 200)
    const query = { isDeleted: { $ne: true } }
    const allowedTypes = getRoleTransactionTypes(req.user)

    query.type = allowedTypes.length === 1 ? allowedTypes[0] : { $in: allowedTypes }

    if (req.query.type) {
      const requestedType = String(req.query.type)
      if (!allowedTypes.includes(requestedType)) {
        query.type = { $in: [] }
      } else {
        query.type = requestedType
      }
    }

    if (req.query.status && TRANSACTION_STATUSES.includes(String(req.query.status))) {
      query.status = String(req.query.status)
    }

    if (req.query.customerId) query.customerId = req.query.customerId
    if (req.query.vendorId) query.vendorId = req.query.vendorId

    if (req.query.startDate || req.query.endDate) {
      query.date = {}
      if (req.query.startDate) query.date.$gte = new Date(req.query.startDate)
      if (req.query.endDate) query.date.$lte = new Date(`${req.query.endDate}T23:59:59.999Z`)
    }

    if (req.query.search) {
      const search = String(req.query.search).trim()
      if (search) {
        const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        query.$or = [
          { description: regex },
          { type: regex },
          { currency: regex },
        ]
      }
    }

    const [transactions, total, summaryRows] = await Promise.all([
      populateTransactionQuery(Transaction.find(query))
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Transaction.countDocuments(query),
      Transaction.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalCount: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            draft: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
            submitted: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } },
            approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
            posted: { $sum: { $cond: [{ $eq: ['$status', 'posted'] }, 1, 0] } },
            returned: { $sum: { $cond: [{ $eq: ['$status', 'returned'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
          },
        },
      ]),
    ])

    const summary = summaryRows[0] || {
      totalCount: 0,
      totalAmount: 0,
      draft: 0,
      submitted: 0,
      approved: 0,
      posted: 0,
      returned: 0,
      rejected: 0,
    }

    res.json({ success: true, transactions, total, page, limit, summary })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/transactions', protect, async (req, res) => {
  try {
    const { type, amount, date, description, currency, exchangeRate, customerId, vendorId, inventoryItemId, mappingId, debitAccountId, creditAccountId, voucherMeta, metalFixStatus } = req.body
    if (!type || !amount) return res.status(400).json({ success: false, message: 'Type and amount are required' })
    if (!canCreateTransactionFor(req.user, type)) {
      return res.status(403).json({ success: false, message: 'You are not allowed to create this transaction type' })
    }

    const validationMessage = validateTransactionPayload({
      type,
      amount,
      customerId,
      vendorId,
    })
    if (validationMessage) {
      return res.status(400).json({ success: false, message: validationMessage })
    }

    const normalizedMetalFixStatus = normalizeMetalFixStatus(metalFixStatus)
    const voucherMetaPayload = (['sale', 'purchase'].includes(String(type || '').toLowerCase()) && normalizedMetalFixStatus)
      ? {
          ...(voucherMeta || {}),
          fixingType: normalizedMetalFixStatus === 'unfixed' ? 'non-fixing' : 'fixing',
        }
      : (voucherMeta || undefined)

    const tx = await Transaction.create({
      type,
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      description,
      currency: (currency || 'USD').toUpperCase(),
      exchangeRate: Number(exchangeRate || 1),
      customerId: sanitizeOptionalRef(customerId),
      vendorId: sanitizeOptionalRef(vendorId),
      inventoryItemId: sanitizeOptionalRef(inventoryItemId),
      mappingId: sanitizeOptionalRef(mappingId),
      debitAccountId: sanitizeOptionalRef(debitAccountId),
      creditAccountId: sanitizeOptionalRef(creditAccountId),
      voucherMeta: voucherMetaPayload,
      status: 'draft',
      createdBy: req.user._id,
      updatedBy: req.user._id,
    })

    appendTransactionAudit(tx, req.user, 'create', { fromStatus: '', toStatus: 'draft', comment: description })
    await tx.save()

    res.status(201).json({ success: true, transaction: tx })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Server error' })
  }
})

router.put('/transactions/:id', protect, async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })

    const wasPosted = tx.status === 'posted'

    // If editing a posted transaction, reverse its ledger entries and reset to draft
    if (wasPosted) {
      const now = new Date()
      await Ledger.updateMany(
        { referenceId: tx._id, isDeleted: { $ne: true } },
        { $set: { isDeleted: true, deletedAt: now, updatedBy: req.user._id } }
      )
      if (tx.journalEntryId) {
        await Ledger.updateMany(
          { _id: tx.journalEntryId, isDeleted: { $ne: true } },
          { $set: { isDeleted: true, deletedAt: now, updatedBy: req.user._id } }
        )
      }
      tx.status = 'draft'
      tx.journalEntryId = null
    }

    const nextType = req.body.type || tx.type
    if (!canCreateTransactionFor(req.user, nextType) && !isFinance(req.user) && !isSuperAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    const validationMessage = validateTransactionPayload({
      ...tx.toObject(),
      ...req.body,
      type: nextType,
      customerId: req.body.customerId !== undefined ? sanitizeOptionalRef(req.body.customerId) : tx.customerId,
      vendorId: req.body.vendorId !== undefined ? sanitizeOptionalRef(req.body.vendorId) : tx.vendorId,
    })
    if (validationMessage) {
      return res.status(400).json({ success: false, message: validationMessage })
    }

    if (req.body.type !== undefined) tx.type = req.body.type
    if (req.body.amount !== undefined) tx.amount = Number(req.body.amount)
    if (req.body.date !== undefined) tx.date = req.body.date ? new Date(req.body.date) : tx.date
    if (req.body.description !== undefined) tx.description = req.body.description
    if (req.body.currency !== undefined) tx.currency = String(req.body.currency || 'USD').toUpperCase()
    if (req.body.exchangeRate !== undefined) tx.exchangeRate = Number(req.body.exchangeRate || 1)
    if (req.body.customerId !== undefined) tx.customerId = sanitizeOptionalRef(req.body.customerId)
    if (req.body.vendorId !== undefined) tx.vendorId = sanitizeOptionalRef(req.body.vendorId)
    if (req.body.inventoryItemId !== undefined) tx.inventoryItemId = sanitizeOptionalRef(req.body.inventoryItemId)
    if (req.body.mappingId !== undefined) tx.mappingId = sanitizeOptionalRef(req.body.mappingId)
    if (req.body.debitAccountId !== undefined) tx.debitAccountId = sanitizeOptionalRef(req.body.debitAccountId)
    if (req.body.creditAccountId !== undefined) tx.creditAccountId = sanitizeOptionalRef(req.body.creditAccountId)
    if (req.body.voucherMeta !== undefined) tx.voucherMeta = req.body.voucherMeta
    if (req.body.metalFixStatus !== undefined) {
      const normalizedMetalFixStatus = normalizeMetalFixStatus(req.body.metalFixStatus)
      if (!tx.voucherMeta || typeof tx.voucherMeta !== 'object') tx.voucherMeta = {}
      if (normalizedMetalFixStatus) {
        tx.voucherMeta.fixingType = normalizedMetalFixStatus === 'unfixed' ? 'non-fixing' : 'fixing'
      }
    }
    tx.updatedBy = req.user._id
    appendTransactionAudit(tx, req.user, 'update', { fromStatus: tx.status, toStatus: tx.status, comment: req.body.description || '' })
    await tx.save()
    res.json({ success: true, transaction: tx })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/transactions/:id/void', protect, async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })

    const now = new Date()

    // Soft-delete all ledger entries linked to this transaction
    await Ledger.updateMany(
      { referenceId: tx._id, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt: now, updatedBy: req.user._id } }
    )

    // Also soft-delete the journalEntryId ledger entry if present
    if (tx.journalEntryId) {
      await Ledger.updateMany(
        { _id: tx.journalEntryId, isDeleted: { $ne: true } },
        { $set: { isDeleted: true, deletedAt: now, updatedBy: req.user._id } }
      )
    }

    tx.isDeleted = true
    tx.deletedAt = now
    tx.updatedBy = req.user._id
    appendTransactionAudit(tx, req.user, 'void', { fromStatus: tx.status, toStatus: 'voided', comment: req.body?.reason || 'Voided by user' })
    await tx.save()

    res.json({ success: true, message: 'Transaction voided and ledger entries removed' })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Server error' })
  }
})

router.delete('/transactions/:id', protect, async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })
    if (tx.status === 'posted') {
      return res.status(400).json({ success: false, message: 'Posted transaction cannot be deleted' })
    }
    tx.isDeleted = true
    tx.deletedAt = new Date()
    tx.updatedBy = req.user._id
    appendTransactionAudit(tx, req.user, 'delete', { fromStatus: tx.status, toStatus: tx.status })
    await tx.save()
    res.json({ success: true, message: 'Transaction deleted (soft)', transaction: tx })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/transactions/:id/submit', protect, async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })
    const result = await applyTransactionWorkflowAction(tx, req.user, 'submit', { comment: req.body?.comment })
    const populated = await populateTransactionQuery(Transaction.findById(result.transaction._id))
    res.json({ success: true, transaction: populated })
  } catch (e) {
    res.status(getTransactionWorkflowErrorStatus(e.message)).json({ success: false, message: e.message || 'Server error' })
  }
})

router.post('/transactions/:id/approve', protect, async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })
    const result = await applyTransactionWorkflowAction(tx, req.user, 'approve', { comment: req.body?.comment })
    const populated = await populateTransactionQuery(Transaction.findById(result.transaction._id))
    res.json({ success: true, transaction: populated })
  } catch (e) {
    res.status(getTransactionWorkflowErrorStatus(e.message)).json({ success: false, message: e.message || 'Server error' })
  }
})

router.post('/transactions/:id/post', protect, async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })
    const result = await applyTransactionWorkflowAction(tx, req.user, 'post', { comment: req.body?.comment, mappingOverride: req.body || {} })
    const populated = await populateTransactionQuery(Transaction.findById(result.transaction._id))
    res.json({ success: true, transaction: populated, ledgerEntry: result.ledgerEntry })
  } catch (e) {
    res.status(getTransactionWorkflowErrorStatus(e.message)).json({ success: false, message: e.message || 'Server error' })
  }
})

router.post('/transactions/:id/comments', protect, async (req, res) => {
  try {
    if (!canAccessTransactions(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })

    const message = normalizeTransactionNote(req.body?.message)
    if (!message) return res.status(400).json({ success: false, message: 'Comment is required' })

    appendTransactionComment(tx, req.user, message, 'comment')
    appendTransactionAudit(tx, req.user, 'comment', { fromStatus: tx.status, toStatus: tx.status, comment: message })
    tx.updatedBy = req.user._id
    await tx.save()

    const populated = await populateTransactionQuery(Transaction.findById(tx._id))
    res.json({ success: true, transaction: populated })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Server error' })
  }
})

router.post('/transactions/:id/attachments', protect, transactionUpload.single('file'), async (req, res) => {
  try {
    if (!canAccessTransactions(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })
    if (!req.file) return res.status(400).json({ success: false, message: 'Attachment file is required' })

    const attachment = buildTransactionAttachment(req.file, req.user)
    tx.attachments.push(attachment)
    tx.updatedBy = req.user._id
    appendTransactionAudit(tx, req.user, 'upload_attachment', { fromStatus: tx.status, toStatus: tx.status, comment: attachment.originalName })
    await tx.save()

    const populated = await populateTransactionQuery(Transaction.findById(tx._id))
    res.status(201).json({ success: true, transaction: populated, attachment: populated.attachments[populated.attachments.length - 1] })
  } catch (e) {
    res.status(getTransactionWorkflowErrorStatus(e.message)).json({ success: false, message: e.message || 'Server error' })
  }
})

router.delete('/transactions/:id/attachments/:attachmentId', protect, async (req, res) => {
  try {
    if (!canAccessTransactions(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })

    const attachment = tx.attachments.id(req.params.attachmentId)
    if (!attachment) return res.status(404).json({ success: false, message: 'Attachment not found' })

    const filePath = path.resolve(transactionUploadDir, attachment.fileName)
    tx.attachments.pull({ _id: attachment._id })
    tx.updatedBy = req.user._id
    appendTransactionAudit(tx, req.user, 'delete_attachment', { fromStatus: tx.status, toStatus: tx.status, comment: attachment.originalName })
    await tx.save()

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

    const populated = await populateTransactionQuery(Transaction.findById(tx._id))
    res.json({ success: true, transaction: populated })
  } catch (e) {
    res.status(getTransactionWorkflowErrorStatus(e.message)).json({ success: false, message: e.message || 'Server error' })
  }
})

router.post('/transactions/:id/return', protect, async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })
    const result = await applyTransactionWorkflowAction(tx, req.user, 'return', { comment: req.body?.comment })
    const populated = await populateTransactionQuery(Transaction.findById(result.transaction._id))
    res.json({ success: true, transaction: populated })
  } catch (e) {
    res.status(getTransactionWorkflowErrorStatus(e.message)).json({ success: false, message: e.message || 'Server error' })
  }
})

router.post('/transactions/:id/reject', protect, async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })
    const result = await applyTransactionWorkflowAction(tx, req.user, 'reject', { comment: req.body?.comment })
    const populated = await populateTransactionQuery(Transaction.findById(result.transaction._id))
    res.json({ success: true, transaction: populated })
  } catch (e) {
    res.status(getTransactionWorkflowErrorStatus(e.message)).json({ success: false, message: e.message || 'Server error' })
  }
})

router.post('/transactions/bulk-action', protect, async (req, res) => {
  try {
    if (!canAccessTransactions(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Boolean) : []
    const action = String(req.body?.action || '')
    const comment = normalizeTransactionNote(req.body?.comment)
    const mappingOverride = req.body?.mappingOverride || {}

    if (!ids.length) return res.status(400).json({ success: false, message: 'Select at least one transaction' })
    if (!['submit', 'approve', 'post'].includes(action)) return res.status(400).json({ success: false, message: 'Invalid bulk action' })

    const transactions = await Transaction.find({ _id: { $in: ids }, isDeleted: { $ne: true } }).sort({ createdAt: -1 })
    const results = { successIds: [], failed: [] }

    for (const tx of transactions) {
      try {
        if (!canCreateTransactionFor(req.user, tx.type) && !isFinance(req.user) && !isSuperAdmin(req.user)) {
          throw new Error('Forbidden')
        }
        const actionResult = await applyTransactionWorkflowAction(tx, req.user, action, { comment, mappingOverride })
        results.successIds.push(String(actionResult.transaction._id))
      } catch (e) {
        results.failed.push({ id: String(tx._id), message: e.message || 'Failed' })
      }
    }

    const refreshed = await populateTransactionQuery(Transaction.find({ _id: { $in: results.successIds } }))
    res.json({ success: true, action, processed: transactions.length, successCount: results.successIds.length, failureCount: results.failed.length, transactions: refreshed, ...results })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Server error' })
  }
})

router.get('/transactions/source-by-ledger/:ledgerId', protect, async (req, res) => {
  try {
    if (!canAccessTransactions(req.user) && !canAccessReports(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    const ledgerEntry = await Ledger.findById(req.params.ledgerId)
      .populate('debitAccountId', 'accountCode accountName')
      .populate('creditAccountId', 'accountCode accountName')

    if (!ledgerEntry || ledgerEntry.isDeleted) {
      return res.status(404).json({ success: false, message: 'Ledger entry not found' })
    }

    const sourceTransaction = await Transaction.findOne({
      isDeleted: { $ne: true },
      $or: [
        { journalEntryId: ledgerEntry._id },
        { _id: ledgerEntry.referenceId },
      ],
    })
      .populate('customerId', 'name')
      .populate('vendorId', 'name')
      .populate('inventoryItemId', 'sku name')
      .populate('debitAccountId', 'accountCode accountName')
      .populate('creditAccountId', 'accountCode accountName')
      .populate('mappingId', 'mappingType')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('postedBy', 'name email')

    res.json({
      success: true,
      ledgerEntry,
      sourceTransaction: sourceTransaction || null,
      sourceType: sourceTransaction ? 'transaction' : 'manual_journal',
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ==========================================
// REPORTS ENDPOINTS
// ==========================================
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

const buildProfitLossSummary = async (startDate, endDate) => {
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

  entries.forEach((entry) => {
    if (entry.creditAccountId?.accountType === 'Income') {
      const amount = Number(entry.amount || 0)
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
      const amount = Number(entry.amount || 0)
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
    if (debitKey) balanceByAccount.set(debitKey, Number(balanceByAccount.get(debitKey) || 0) + Number(entry.amount || 0))
    if (creditKey) balanceByAccount.set(creditKey, Number(balanceByAccount.get(creditKey) || 0) - Number(entry.amount || 0))
  })

  const assets = []
  const liabilities = []
  const equity = []

  accounts.forEach((account) => {
    const bal = Number(balanceByAccount.get(account._id.toString()) || 0)
    const row = {
      accountId: account._id,
      accountCode: account.accountCode,
      accountName: account.accountName,
      balance: toMoney(Math.abs(bal)),
      signedBalance: toMoney(bal),
    }
    if (account.accountType === 'Asset') assets.push(row)
    if (account.accountType === 'Liability') liabilities.push(row)
    if (account.accountType === 'Equity') equity.push(row)
  })

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

router.get('/reports/trial-balance', protect, async (req, res) => {
  try {
    if (!canAccessReports(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const {
      startDate,
      endDate,
      accountType,
      includeZero = 'true',
      sortBy = 'accountCode',
      sortDir = 'asc',
      minAbsolute = '0',
    } = req.query
    const query = { isDeleted: { $ne: true } }
    const dateQuery = buildDateQuery(startDate, endDate)
    if (dateQuery) query.date = dateQuery

    const entries = await Ledger.find(query)
      .populate('debitAccountId', 'accountName accountCode accountType')
      .populate('creditAccountId', 'accountName accountCode accountType')

    const accountTotals = new Map()
    entries.forEach((entry) => {
      const debitKey = entry.debitAccountId._id.toString()
      const creditKey = entry.creditAccountId._id.toString()

      if (!accountTotals.has(debitKey)) {
        accountTotals.set(debitKey, { account: entry.debitAccountId, debit: 0, credit: 0 })
      }
      if (!accountTotals.has(creditKey)) {
        accountTotals.set(creditKey, { account: entry.creditAccountId, debit: 0, credit: 0 })
      }

      accountTotals.get(debitKey).debit += entry.amount
      accountTotals.get(creditKey).credit += entry.amount
    })

    let trialBalance = Array.from(accountTotals.values()).map((item) => ({
      accountName: item.account.accountName,
      accountCode: item.account.accountCode,
      accountType: item.account.accountType,
      debit: toMoney(item.debit),
      credit: toMoney(item.credit),
      net: toMoney(item.debit - item.credit),
    }))

    if (parseBool(includeZero, true)) {
      const allAccountsQuery = { isActive: true }
      if (accountType) allAccountsQuery.accountType = accountType
      const allAccounts = await ChartOfAccount.find(allAccountsQuery).select('accountCode accountName accountType')
      const existingCodes = new Set(trialBalance.map((row) => row.accountCode))
      allAccounts.forEach((acc) => {
        if (!existingCodes.has(acc.accountCode)) {
          trialBalance.push({
            accountName: acc.accountName,
            accountCode: acc.accountCode,
            accountType: acc.accountType,
            debit: 0,
            credit: 0,
            net: 0,
          })
        }
      })
    }

    if (accountType) {
      trialBalance = trialBalance.filter((row) => row.accountType === accountType)
    }

    const minAbsoluteValue = Number(minAbsolute || 0)
    if (minAbsoluteValue > 0) {
      trialBalance = trialBalance.filter((row) => Math.abs(Number(row.net || 0)) >= minAbsoluteValue)
    }

    const sortMultiplier = String(sortDir).toLowerCase() === 'desc' ? -1 : 1
    const sortable = ['accountCode', 'accountName', 'accountType', 'debit', 'credit', 'net'].includes(sortBy) ? sortBy : 'accountCode'
    trialBalance.sort((a, b) => {
      if (['debit', 'credit', 'net'].includes(sortable)) {
        return (Number(a[sortable] || 0) - Number(b[sortable] || 0)) * sortMultiplier
      }
      return String(a[sortable] || '').localeCompare(String(b[sortable] || '')) * sortMultiplier
    })

    const totalDebit = trialBalance.reduce((sum, item) => sum + item.debit, 0)
    const totalCredit = trialBalance.reduce((sum, item) => sum + item.credit, 0)
    const byType = trialBalance.reduce((acc, row) => {
      const key = row.accountType || 'Unknown'
      if (!acc[key]) acc[key] = { debit: 0, credit: 0, net: 0 }
      acc[key].debit += Number(row.debit || 0)
      acc[key].credit += Number(row.credit || 0)
      acc[key].net += Number(row.net || 0)
      return acc
    }, {})

    res.json({
      success: true,
      period: { startDate: startDate || null, endDate: endDate || null },
      trialBalance,
      totalDebit: toMoney(totalDebit),
      totalCredit: toMoney(totalCredit),
      difference: toMoney(totalDebit - totalCredit),
      balanced: Math.abs(totalDebit - totalCredit) < 0.01,
      byType,
      rowCount: trialBalance.length,
      generatedAt: new Date(),
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/reports/ledger', protect, async (req, res) => {
  try {
    if (!canAccessReports(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { accountId, startDate, endDate } = req.query
    if (!accountId) return res.status(400).json({ success: false, message: 'Account ID required' })

    const query = {
      $or: [{ debitAccountId: accountId }, { creditAccountId: accountId }],
    }
    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) }
    }

    const entries = await Ledger.find(query)
      .populate('debitAccountId', 'accountName accountCode')
      .populate('creditAccountId', 'accountName accountCode')
      .sort({ date: 1 })

    let runningBalance = 0
    const report = entries.map((entry) => {
      const amount = entry.debitAccountId._id.toString() === accountId ? entry.amount : -entry.amount
      runningBalance += amount
      return {
        entryId: entry._id,
        date: entry.date,
        referenceType: entry.referenceType,
        description: entry.description,
        currency: entry.currency,
        amount: entry.amount,
        debitAccount: entry.debitAccountId,
        creditAccount: entry.creditAccountId,
        debit: entry.debitAccountId._id.toString() === accountId ? entry.amount : 0,
        credit: entry.creditAccountId._id.toString() === accountId ? entry.amount : 0,
        runningBalance,
      }
    })

    res.json({ success: true, report })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/reports/profit-loss', protect, async (req, res) => {
  try {
    if (!canAccessReports(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { startDate, endDate, comparePrevious = 'false' } = req.query
    const currentPeriod = await buildProfitLossSummary(startDate, endDate)

    let previousPeriod = null
    if (parseBool(comparePrevious, false) && startDate && endDate) {
      const prevRange = buildPreviousPeriod(startDate, endDate)
      if (prevRange) {
        const prevSummary = await buildProfitLossSummary(prevRange.startDate, prevRange.endDate)
        previousPeriod = {
          startDate: prevRange.startDate,
          endDate: prevRange.endDate,
          totalIncome: prevSummary.totalIncome,
          totalExpense: prevSummary.totalExpense,
          netProfit: prevSummary.netProfit,
        }
      }
    }

    const netProfit = currentPeriod.netProfit
    const prevNet = Number(previousPeriod?.netProfit || 0)
    const varianceVsPrevious = previousPeriod ? toMoney(Number(netProfit) - prevNet) : null

    const comparisonAnchor = endDate ? new Date(endDate) : new Date()
    const monthlyComparison = []
    for (let i = 5; i >= 0; i -= 1) {
      const monthStart = new Date(comparisonAnchor.getFullYear(), comparisonAnchor.getMonth() - i, 1)
      const monthEnd = new Date(comparisonAnchor.getFullYear(), comparisonAnchor.getMonth() - i + 1, 0)
      const summary = await buildProfitLossSummary(monthStart, monthEnd)
      monthlyComparison.push({
        label: monthStart.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        startDate: monthStart,
        endDate: monthEnd,
        totalIncome: summary.totalIncome,
        totalExpense: summary.totalExpense,
        netProfit: summary.netProfit,
      })
    }

    const quarterlyComparison = []
    const anchorQuarter = Math.floor(comparisonAnchor.getMonth() / 3)
    for (let i = 3; i >= 0; i -= 1) {
      const quarterIndex = anchorQuarter - i
      const yearOffset = Math.floor(quarterIndex / 4)
      const normalizedQuarter = ((quarterIndex % 4) + 4) % 4
      const year = comparisonAnchor.getFullYear() + yearOffset
      const quarterStart = new Date(year, normalizedQuarter * 3, 1)
      const quarterEnd = new Date(year, normalizedQuarter * 3 + 3, 0)
      const summary = await buildProfitLossSummary(quarterStart, quarterEnd)
      quarterlyComparison.push({
        label: `Q${normalizedQuarter + 1} ${year}`,
        startDate: quarterStart,
        endDate: quarterEnd,
        totalIncome: summary.totalIncome,
        totalExpense: summary.totalExpense,
        netProfit: summary.netProfit,
      })
    }

    res.json({
      success: true,
      period: { startDate: startDate || null, endDate: endDate || null },
      totalIncome: currentPeriod.totalIncome,
      totalExpense: currentPeriod.totalExpense,
      netProfit,
      incomeBreakdown: currentPeriod.incomeBreakdown,
      expenseBreakdown: currentPeriod.expenseBreakdown,
      topIncome: currentPeriod.topIncome,
      topExpenses: currentPeriod.topExpenses,
      grossMarginPct: currentPeriod.grossMarginPct,
      previousPeriod,
      varianceVsPrevious,
      monthlyComparison,
      quarterlyComparison,
      generatedAt: new Date(),
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/reports/balance-sheet', protect, async (req, res) => {
  try {
    if (!canAccessReports(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { endDate } = req.query
    const snapshot = await buildBalanceSheetSummary(endDate)
    const anchorDate = endDate ? new Date(endDate) : new Date()
    const monthlyComparison = []
    for (let i = 5; i >= 0; i -= 1) {
      const monthEnd = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - i + 1, 0)
      const summary = await buildBalanceSheetSummary(monthEnd)
      monthlyComparison.push({
        label: monthEnd.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        endDate: monthEnd,
        totalAssets: summary.totalAssets,
        totalLiabilities: summary.totalLiabilities,
        totalEquity: summary.totalEquity,
        workingCapital: summary.workingCapital,
      })
    }

    const quarterlyComparison = []
    const anchorQuarter = Math.floor(anchorDate.getMonth() / 3)
    for (let i = 3; i >= 0; i -= 1) {
      const quarterIndex = anchorQuarter - i
      const yearOffset = Math.floor(quarterIndex / 4)
      const normalizedQuarter = ((quarterIndex % 4) + 4) % 4
      const year = anchorDate.getFullYear() + yearOffset
      const quarterEnd = new Date(year, normalizedQuarter * 3 + 3, 0)
      const summary = await buildBalanceSheetSummary(quarterEnd)
      quarterlyComparison.push({
        label: `Q${normalizedQuarter + 1} ${year}`,
        endDate: quarterEnd,
        totalAssets: summary.totalAssets,
        totalLiabilities: summary.totalLiabilities,
        totalEquity: summary.totalEquity,
        workingCapital: summary.workingCapital,
      })
    }

    res.json({
      success: true,
      asOfDate: endDate || null,
      assets: snapshot.assets,
      liabilities: snapshot.liabilities,
      equity: snapshot.equity,
      totalAssets: snapshot.totalAssets,
      totalLiabilities: snapshot.totalLiabilities,
      totalEquity: snapshot.totalEquity,
      liabilitiesPlusEquity: snapshot.liabilitiesPlusEquity,
      difference: snapshot.difference,
      currentAssets: snapshot.currentAssets,
      currentLiabilities: snapshot.currentLiabilities,
      workingCapital: snapshot.workingCapital,
      currentRatio: snapshot.currentRatio,
      balanced: snapshot.balanced,
      monthlyComparison,
      quarterlyComparison,
      generatedAt: new Date(),
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/reports/day-book', protect, async (req, res) => {
  try {
    if (!canAccessReports(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { startDate, endDate, referenceType, minAmount = '0' } = req.query
    const query = { isDeleted: { $ne: true } }
    const dateQuery = buildDateQuery(startDate, endDate)
    if (dateQuery) query.date = dateQuery
    if (referenceType) query.referenceType = referenceType

    let entries = await Ledger.find(query)
      .populate('debitAccountId', 'accountCode accountName')
      .populate('creditAccountId', 'accountCode accountName')
      .sort({ date: 1, createdAt: 1 })

    const min = Number(minAmount || 0)
    if (min > 0) {
      entries = entries.filter((entry) => Number(entry.amount || 0) >= min)
    }

    const totals = entries.reduce((acc, entry) => {
      acc.debit += Number(entry.amount || 0)
      acc.credit += Number(entry.amount || 0)
      acc.count += 1
      return acc
    }, { debit: 0, credit: 0, count: 0 })

    const summaryByType = entries.reduce((acc, entry) => {
      const key = entry.referenceType || 'journal'
      if (!acc[key]) acc[key] = { count: 0, amount: 0 }
      acc[key].count += 1
      acc[key].amount += Number(entry.amount || 0)
      return acc
    }, {})

    res.json({
      success: true,
      period: { startDate: startDate || null, endDate: endDate || null },
      entries,
      totals: {
        debit: toMoney(totals.debit),
        credit: toMoney(totals.credit),
        count: totals.count,
      },
      summaryByType,
      generatedAt: new Date(),
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/reports/customer-outstanding', protect, async (req, res) => {
  try {
    if (!canAccessReports(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const customers = await Customer.find({ isActive: true }).populate('ledgerAccountId', 'accountCode accountName')

    const rows = await Promise.all(customers.map(async (customer) => {
      const aging = await getAgingForAccount(customer.ledgerAccountId?._id)
      return {
        customerId: customer._id,
        customerName: customer.name,
        ledgerAccount: customer.ledgerAccountId,
        outstanding: toMoney(aging.total),
        aging,
        creditLimit: toMoney(customer.creditLimit || 0),
        limitExceeded: Number(aging.total || 0) > Number(customer.creditLimit || 0) && Number(customer.creditLimit || 0) > 0,
      }
    }))

    const totals = rows.reduce((acc, row) => {
      acc.outstanding += Number(row.outstanding || 0)
      acc.bucket0to30 += Number(row.aging?.bucket0to30 || 0)
      acc.bucket31to60 += Number(row.aging?.bucket31to60 || 0)
      acc.bucket61to90 += Number(row.aging?.bucket61to90 || 0)
      acc.bucket90Plus += Number(row.aging?.bucket90Plus || 0)
      if (row.limitExceeded) acc.limitExceededCount += 1
      return acc
    }, { outstanding: 0, bucket0to30: 0, bucket31to60: 0, bucket61to90: 0, bucket90Plus: 0, limitExceededCount: 0 })

    res.json({
      success: true,
      rows,
      totals: {
        outstanding: toMoney(totals.outstanding),
        bucket0to30: toMoney(totals.bucket0to30),
        bucket31to60: toMoney(totals.bucket31to60),
        bucket61to90: toMoney(totals.bucket61to90),
        bucket90Plus: toMoney(totals.bucket90Plus),
        limitExceededCount: totals.limitExceededCount,
      },
      generatedAt: new Date(),
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/reports/vendor-outstanding', protect, async (req, res) => {
  try {
    if (!canAccessReports(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const vendors = await Vendor.find({ isActive: true, deletedAt: null }).populate('ledgerAccountId', 'accountCode accountName')

    const rows = await Promise.all(vendors.map(async (vendor) => {
      const outstanding = await getOutstandingForAccount(vendor.ledgerAccountId?._id)
      return {
        vendorId: vendor._id,
        vendorName: vendor.name,
        ledgerAccount: vendor.ledgerAccountId,
        outstanding: toMoney(Math.abs(outstanding)),
        outstandingType: outstanding >= 0 ? 'Credit' : 'Debit',
      }
    }))

    const totals = rows.reduce((acc, row) => {
      acc.outstanding += Number(row.outstanding || 0)
      if (row.outstandingType === 'Credit') acc.credit += Number(row.outstanding || 0)
      if (row.outstandingType === 'Debit') acc.debit += Number(row.outstanding || 0)
      return acc
    }, { outstanding: 0, credit: 0, debit: 0 })

    res.json({
      success: true,
      rows,
      totals: {
        outstanding: toMoney(totals.outstanding),
        credit: toMoney(totals.credit),
        debit: toMoney(totals.debit),
      },
      generatedAt: new Date(),
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/reports/forex-gain-loss', protect, async (req, res) => {
  try {
    if (!canAccessReports(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { startDate, endDate } = req.query
    const query = { isDeleted: { $ne: true }, exchangeRate: { $ne: 1 } }
    const dateQuery = buildDateQuery(startDate, endDate)
    if (dateQuery) query.date = dateQuery

    const entries = await Ledger.find(query)
    const total = entries.reduce((sum, entry) => sum + Math.abs(Number(entry.amount || 0) * (Number(entry.exchangeRate || 1) - 1)), 0)

    const byCurrency = entries.reduce((acc, entry) => {
      const key = entry.currency || 'BASE'
      if (!acc[key]) acc[key] = { count: 0, impact: 0 }
      acc[key].count += 1
      acc[key].impact += Math.abs(Number(entry.amount || 0) * (Number(entry.exchangeRate || 1) - 1))
      return acc
    }, {})

    res.json({
      success: true,
      entriesCount: entries.length,
      forexImpact: toMoney(total),
      byCurrency,
      generatedAt: new Date(),
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/reports/dashboard', protect, async (req, res) => {
  try {
    if (!canAccessReports(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const today = new Date()
    const { startDate, endDate } = req.query
    const periodStart = startDate ? new Date(startDate) : new Date(today.getFullYear(), today.getMonth(), 1)
    const periodEnd = endDate ? new Date(endDate) : new Date(today.getFullYear(), today.getMonth() + 1, 0)
    periodEnd.setHours(23, 59, 59, 999)

    // --- Period ledger entries (for income / expense / cash-flow) ---
    const periodLedger = await Ledger.find({
      date: { $gte: periodStart, $lte: periodEnd },
      isDeleted: { $ne: true },
    })
      .populate('debitAccountId', 'accountCode accountName accountType')
      .populate('creditAccountId', 'accountCode accountName accountType')

    let income = 0
    let expenseTotal = 0
    const expenseByAccount = {}
    periodLedger.forEach((e) => {
      const debitType = e.debitAccountId?.accountType
      const creditType = e.creditAccountId?.accountType
      if (creditType === 'Income') income += Number(e.amount || 0)
      if (debitType === 'Expense') {
        expenseTotal += Number(e.amount || 0)
        const key = e.debitAccountId?.accountName || 'Other'
        expenseByAccount[key] = (expenseByAccount[key] || 0) + Number(e.amount || 0)
      }
    })
    const expenseBreakdown = Object.entries(expenseByAccount)
      .map(([name, amount]) => ({ name, amount: toMoney(amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6)

    // --- Cash flow: net movement in Asset accounts ---
    let cashInflow = 0
    let cashOutflow = 0
    periodLedger.forEach((e) => {
      const debitType = e.debitAccountId?.accountType
      const creditType = e.creditAccountId?.accountType
      if (debitType === 'Asset') cashInflow += Number(e.amount || 0)
      if (creditType === 'Asset') cashOutflow += Number(e.amount || 0)
    })

    // Monthly cash-flow bar chart data (last 6 months)
    const monthlyCashFlow = []
    for (let i = 5; i >= 0; i -= 1) {
      const ms = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const me = new Date(today.getFullYear(), today.getMonth() - i + 1, 0)
      me.setHours(23, 59, 59, 999)
      const mEntries = await Ledger.find({ date: { $gte: ms, $lte: me }, isDeleted: { $ne: true } })
        .populate('debitAccountId', 'accountType')
        .populate('creditAccountId', 'accountType')
      let inc = 0; let exp = 0; let cfIn = 0; let cfOut = 0
      mEntries.forEach((e) => {
        if (e.creditAccountId?.accountType === 'Income') inc += Number(e.amount || 0)
        if (e.debitAccountId?.accountType === 'Expense') exp += Number(e.amount || 0)
        if (e.debitAccountId?.accountType === 'Asset') cfIn += Number(e.amount || 0)
        if (e.creditAccountId?.accountType === 'Asset') cfOut += Number(e.amount || 0)
      })
      monthlyCashFlow.push({
        month: ms.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
        income: toMoney(inc),
        expense: toMoney(exp),
        cashIn: toMoney(cfIn),
        cashOut: toMoney(cfOut),
        net: toMoney(cfIn - cfOut),
      })
    }

    // --- Bank & Cash balances ---
    const bankAccounts = await ChartOfAccount.find({
      isActive: true,
      accountType: 'Asset',
      $or: [{ accountName: /cash|bank/i }, { accountCode: /^10/ }],
    })
    const cashBankBalances = await Promise.all(bankAccounts.map(async (account) => {
      const balance = await getOutstandingForAccount(account._id)
      return { accountCode: account.accountCode, accountName: account.accountName, balance: toMoney(balance) }
    }))
    const totalBankBalance = cashBankBalances.reduce((s, a) => s + Number(a.balance || 0), 0)
    const bankRows = cashBankBalances.filter((a) => /bank/i.test(a.accountName))
    const cashRows = cashBankBalances.filter((a) => /cash/i.test(a.accountName))

    // --- Assets & Liabilities snapshot ---
    const [assets, liabilities] = await Promise.all([
      ChartOfAccount.find({ accountType: 'Asset' }).select('accountName accountCode'),
      ChartOfAccount.find({ accountType: 'Liability' }).select('accountName accountCode'),
    ])

    // --- AP & AR (via customer / vendor ledger accounts) ---
    const customers = await Customer.find({ isActive: true }).populate('ledgerAccountId', 'accountCode accountName')
    const vendors = await Vendor.find({ isActive: true, deletedAt: null }).populate('ledgerAccountId', 'accountCode accountName')

    const customerOutstanding = await Promise.all(customers.map(async (c) => {
      const aging = await getAgingForAccount(c.ledgerAccountId?._id)
      return { customerName: c.name, outstanding: toMoney(aging.total) }
    }))
    const vendorOutstanding = await Promise.all(vendors.map(async (v) => {
      const out = await getOutstandingForAccount(v.ledgerAccountId?._id)
      return { vendorName: v.name, outstanding: toMoney(Math.abs(out)) }
    }))
    const totalAR = customerOutstanding.reduce((s, r) => s + Number(r.outstanding || 0), 0)
    const totalAP = vendorOutstanding.reduce((s, r) => s + Number(r.outstanding || 0), 0)

    // --- Customer margin: expenses and cash-flow per customer (no profit/income) ---
    const customerMargins = await Promise.all(customers.map(async (c) => {
      if (!c.ledgerAccountId?._id) return null
      const cLedger = await Ledger.find({
        $or: [{ debitAccountId: c.ledgerAccountId._id }, { creditAccountId: c.ledgerAccountId._id }],
        date: { $gte: periodStart, $lte: periodEnd },
        isDeleted: { $ne: true },
      }).populate('debitAccountId', 'accountType').populate('creditAccountId', 'accountType')
      let custExpense = 0; let custCashIn = 0; let custCashOut = 0
      cLedger.forEach((e) => {
        if (e.debitAccountId?.accountType === 'Expense') custExpense += Number(e.amount || 0)
        if (e.debitAccountId?.accountType === 'Asset') custCashIn += Number(e.amount || 0)
        if (e.creditAccountId?.accountType === 'Asset') custCashOut += Number(e.amount || 0)
      })
      if (custExpense === 0 && custCashIn === 0 && custCashOut === 0) return null
      return {
        customerName: c.name,
        expenses: toMoney(custExpense),
        cashInflow: toMoney(custCashIn),
        cashOutflow: toMoney(custCashOut),
        netCashFlow: toMoney(custCashIn - custCashOut),
      }
    }))
    const filteredCustomerMargins = customerMargins.filter(Boolean).slice(0, 10)

    // --- Supplier margins via mapped purchase/sales accounts ---
    const purchaseMappings = await AccountMapping.find({ isActive: true, mappingType: { $in: ['purchase', 'expense', 'vendor_payment'] } })
      .populate('debitAccountId', 'accountCode accountName accountType')
      .populate('creditAccountId', 'accountCode accountName accountType')
    const supplierAccountIds = [...new Set(purchaseMappings.map((m) => String(m.debitAccountId?._id || '')))]
    let supplierExpenseTotal = 0
    let supplierCashOut = 0
    if (supplierAccountIds.length) {
      const suppEntries = await Ledger.find({
        date: { $gte: periodStart, $lte: periodEnd },
        isDeleted: { $ne: true },
        $or: [
          { debitAccountId: { $in: supplierAccountIds } },
          { creditAccountId: { $in: supplierAccountIds } },
        ],
      }).populate('debitAccountId', 'accountType').populate('creditAccountId', 'accountType')
      suppEntries.forEach((e) => {
        if (e.debitAccountId?.accountType === 'Expense') supplierExpenseTotal += Number(e.amount || 0)
        if (e.creditAccountId?.accountType === 'Asset') supplierCashOut += Number(e.amount || 0)
      })
    }

    // --- Fixing positions from DirectDeal ---
    const fixingDeals = await DirectDeal.find({
      entryType: 'fixing',
      isDeleted: { $ne: true },
      docDate: { $gte: periodStart, $lte: periodEnd },
    })
    const fixingByMetal = {}
    fixingDeals.forEach((deal) => {
      deal.lineItems.forEach((line) => {
        const metal = line.metal || 'XAU'
        if (!fixingByMetal[metal]) fixingByMetal[metal] = { qty: 0, amount: 0 }
        fixingByMetal[metal].qty += Number(line.eqOz || line.qty || 0)
        fixingByMetal[metal].amount += Number(line.amount || 0)
      })
    })
    const fixingPositions = Object.entries(fixingByMetal).map(([metal, data]) => ({
      metal,
      qty: toMoney(data.qty),
      amount: toMoney(data.amount),
    }))

    // --- Volume traded from StockMovement + DirectDeal lines ---
    const stockMoves = await StockMovement.find({
      isDeleted: { $ne: true },
      date: { $gte: periodStart, $lte: periodEnd },
    })
    const volumeByMetal = {}
    stockMoves.forEach((m) => {
      const metal = String(m.category || m.metal || 'Other').toUpperCase()
      if (!volumeByMetal[metal]) volumeByMetal[metal] = { qty: 0, value: 0 }
      volumeByMetal[metal].qty += Number(m.quantity || 0)
      volumeByMetal[metal].value += Number(m.totalValue || m.unitCost * m.quantity || 0)
    })
    fixingDeals.forEach((deal) => {
      deal.lineItems.forEach((line) => {
        const metal = line.metal || 'XAU'
        if (!volumeByMetal[metal]) volumeByMetal[metal] = { qty: 0, value: 0 }
        volumeByMetal[metal].qty += Number(line.eqOz || line.qty || 0)
        volumeByMetal[metal].value += Number(line.amount || 0)
      })
    })
    const volumeTraded = Object.entries(volumeByMetal).map(([metal, data]) => ({
      metal,
      qty: toMoney(data.qty),
      value: toMoney(data.value),
    }))

    // --- Metal rates (latest) ---
    const latestRate = await MetalRate.findOne().sort({ updatedAt: -1 })
    // Source of truth for dashboard metals: stock type records from Inventory (exclude product rows)
    const stockTypeDocs = await InventoryItem.find({
      isDeleted: { $ne: true },
      $and: [
        { category: /mainStock=/i },
        { category: { $not: /recordType=product/i } },
      ],
    }).select('category unitCost currency updatedAt')

    const stockPriceMap = {}
    stockTypeDocs.forEach((doc) => {
      const raw = String(doc.category || '')
      const meta = {}
      raw.split(';').forEach((pair) => {
        const [key, ...rest] = pair.split('=')
        if (!key || rest.length === 0) return
        meta[String(key).trim()] = rest.join('=').trim()
      })
      const metal = String(meta.mainStock || meta.metalType || '').trim().toLowerCase()
      if (!metal) return

      const price = Number(doc.unitCost || 0)
      if (!Number.isFinite(price) || price <= 0) return

      const prev = stockPriceMap[metal]
      if (!prev || new Date(doc.updatedAt || 0) > new Date(prev.updatedAt || 0)) {
        stockPriceMap[metal] = {
          price,
          currency: String(doc.currency || meta.priceCurrency || 'USD').toUpperCase(),
          unit: String(meta.priceUnit || 'OZ').toUpperCase(),
          updatedAt: doc.updatedAt || null,
        }
      }
    })

    const latestStockUpdatedAt = Object.values(stockPriceMap)
      .map((entry) => entry.updatedAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0] || null

    const metalRates = {
      // Prefer inventory stock-type prices; fallback to legacy metal-rates for compatibility.
      gold: stockPriceMap.gold?.price || (latestRate ? latestRate.goldPrice : 0),
      silver: stockPriceMap.silver?.price || (latestRate ? latestRate.silverPrice : 0),
      platinum: stockPriceMap.platinum?.price || 0,
      palladium: stockPriceMap.palladium?.price || 0,
      currency: stockPriceMap.gold?.currency || stockPriceMap.silver?.currency || (latestRate ? latestRate.priceCurrency : 'USD'),
      updatedAt: latestStockUpdatedAt || (latestRate ? latestRate.updatedAt : null),
      stockPrices: stockPriceMap,
    }

    // --- Vendor compliance / doc expiry ---
    const vendorDocumentExpiry = buildDocumentExpiryBuckets(vendors, today)
    const complianceRows = vendors.map((v) => evaluateVendorCompliance(v, today))
    const vendorComplianceRisk = {
      nonCompliant: complianceRows.filter((r) => !r.compliant).length,
      averageScore: complianceRows.length > 0
        ? toMoney(complianceRows.reduce((s, r) => s + Number(r.complianceScore || 0), 0) / complianceRows.length)
        : 0,
    }

    // --- Low stock ---
    const inventoryLowStock = await InventoryItem.find({
      isDeleted: { $ne: true },
      $expr: { $lt: ['$quantity', '$minThreshold'] },
    }).select('name sku quantity minThreshold').limit(10)

    res.json({
      success: true,
      period: { startDate: periodStart, endDate: periodEnd },
      summary: {
        monthIncome: toMoney(income),
        monthExpense: toMoney(expenseTotal),
        monthProfit: toMoney(income - expenseTotal),
      },
      metalRates,
      bankBalances: bankRows,
      cashBalances: cashRows,
      allCashBankBalances: cashBankBalances,
      totalBankBalance: toMoney(totalBankBalance),
      cashFlow: {
        inflow: toMoney(cashInflow),
        outflow: toMoney(cashOutflow),
        net: toMoney(cashInflow - cashOutflow),
        monthly: monthlyCashFlow,
      },
      expenses: {
        total: toMoney(expenseTotal),
        breakdown: expenseBreakdown,
      },
      apAr: {
        totalAR: toMoney(totalAR),
        totalAP: toMoney(totalAP),
        netPosition: toMoney(totalAR - totalAP),
        arCount: customerOutstanding.filter((x) => x.outstanding > 0).length,
        apCount: vendorOutstanding.filter((x) => x.outstanding > 0).length,
        customerOutstanding: customerOutstanding.filter((x) => x.outstanding > 0).slice(0, 10),
        vendorOutstanding: vendorOutstanding.filter((x) => x.outstanding > 0).slice(0, 10),
      },
      customerMargins: filteredCustomerMargins,
      supplierMargins: {
        expenses: toMoney(supplierExpenseTotal),
        cashOutflow: toMoney(supplierCashOut),
        mappingsCount: purchaseMappings.length,
      },
      fixingPositions,
      volumeTraded,
      assets: assets.slice(0, 5),
      liabilities: liabilities.slice(0, 5),
      vendorDocumentExpiry: vendorDocumentExpiry.buckets,
      vendorComplianceRisk,
      lowStockAlerts: inventoryLowStock,
      generatedAt: new Date(),
    })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', detail: err.message })
  }
})

module.exports = router
