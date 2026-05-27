/**
 * Direct-deal doc sequencing, customer/line normalization, ledger sync for fixing deals,
 * department mapping scope, vendor code sequencing, and FX exchange adjustment account resolution.
 * Extracted from `erp-accountingContext` to keep route wiring thinner.
 */
const { withSession } = require('../../utils/mongoTransaction')

function createErpAccountingDirectDealAndExchangeService(deps) {
  const {
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
  } = deps

  const ensureExchangeDifferenceAccounts = async (user, session = null) => {
    const gain = await ensureAccountByCode({
      user,
      code: '4190',
      name: 'Exchange Gain',
      accountType: 'Income',
      currency: BASE_CURRENCY_CODE,
      session,
    })

    const loss = await ensureAccountByCode({
      user,
      code: '5190',
      name: 'Exchange Loss',
      accountType: 'Expense',
      currency: BASE_CURRENCY_CODE,
      session,
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
      { $set: { isDeleted: true, deletedAt: new Date(), updatedBy: user._id } },
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

  const nextVendorCode = async () => {
    const rows = await Vendor.find({ vendorCode: /^VEN-\d+$/i }).select('vendorCode').lean()
    return getNextPrefixedCode(rows.map((row) => row.vendorCode), 'VEN')
  }

  const resolveExchangeAdjustmentAccounts = async ({
    user,
    isGain,
    transactionType = 'receipt',
    offsetAccountId = null,
    session = null,
  }) => {
    const mappingType = isGain ? 'exchange_gain' : 'exchange_loss'
    const mapping = await withSession(AccountMapping.findOne({ mappingType, isActive: true })
      .select('debitAccountId creditAccountId')
      .lean(), session)

    if (mapping?.debitAccountId && mapping?.creditAccountId) {
      const [debitAccount, creditAccount] = await Promise.all([
        withSession(ChartOfAccount.findOne({ _id: mapping.debitAccountId, isActive: true }).select('_id').lean(), session),
        withSession(ChartOfAccount.findOne({ _id: mapping.creditAccountId, isActive: true }).select('_id').lean(), session),
      ])

      if (debitAccount && creditAccount) {
        return {
          debitAccountId: mapping.debitAccountId,
          creditAccountId: mapping.creditAccountId,
        }
      }
    }

    const txType = String(transactionType || 'receipt').toLowerCase()
    const isReceipt = txType === 'receipt'

    let arApAccountId = offsetAccountId
    if (!arApAccountId) {
      if (isReceipt) {
        const arAccount = await ensureAccountByCode({
          user,
          code: '1100',
          name: 'Accounts Receivable',
          accountType: 'Asset',
          session,
        })
        arApAccountId = arAccount._id
      } else {
        const apAccount = await ensureAccountByCode({
          user,
          code: '2000',
          name: 'Accounts Payable',
          accountType: 'Liability',
          session,
        })
        arApAccountId = apAccount._id
      }
    }

    const { gain, loss } = await ensureExchangeDifferenceAccounts(user, session)

    return isGain
      ? { debitAccountId: arApAccountId, creditAccountId: gain._id }
      : { debitAccountId: loss._id, creditAccountId: arApAccountId }
  }

  return {
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
  }
}

module.exports = { createErpAccountingDirectDealAndExchangeService }
