function registerCustomerRoutes(deps) {
  const {
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
  } = deps

  const strictBody = validateBodyStrict || validateBody
  const isUnfixedFixingType = (value) => {
    const normalized = String(value || '').trim().toLowerCase()
    return ['non-fixing', 'non_fixing', 'nonfixing', 'unfixed', 'unfix'].includes(normalized)
  }

  const roundPosition = (value) => Number(Number(value || 0).toFixed(6))
  const calculateCustomerMargin = ({ totalFunds, goldPosition, silverPosition, goldPrice, silverPrice }) => {
    const funds = Number(totalFunds || 0)
    const revaluation = (Number(goldPosition || 0) * Number(goldPrice || 0)) + (Number(silverPosition || 0) * Number(silverPrice || 0))
    const margin = Math.abs(revaluation) * 0.02
    const equity = funds + revaluation
    const excess = equity - margin
    const marginPercent = margin > 0 ? (Math.abs(funds) / margin) * 100 : 0
    return {
      totalFunds: toMoney(funds),
      revaluation: toMoney(revaluation),
      margin: toMoney(margin),
      equity: toMoney(equity),
      excess: toMoney(excess),
      marginPercent: toMoney(marginPercent),
      status: equity > 0 ? 'POSITIVE' : equity < 0 ? 'NEGATIVE' : 'NEUTRAL',
    }
  }

  router.get('/customers', protect, async (req, res) => {
    try {
      if (!canViewCustomers(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

      const { page, limit, skip } = parsePagination(req.query, 25, 100)

      const [customers, total] = await Promise.all([
        Customer.find({ isActive: true })
          .populate({
            path: 'ledgerAccountId',
            select: 'accountName accountCode accountType isActive openingBalance',
            match: { isActive: true },
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Customer.countDocuments({ isActive: true }),
      ])

      const accountIds = customers.map((customer) => customer.ledgerAccountId?._id).filter(Boolean)
      const customerIds = customers.map((customer) => customer._id).filter(Boolean)
      const [debitAggs, creditAggs, latestRate, metalTxs] = await Promise.all([
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
        typeof getLatestMetalRate === 'function' ? getLatestMetalRate() : Promise.resolve(null),
        customerIds.length && Transaction
          ? Transaction.find({
              customerId: { $in: customerIds },
              type: { $in: ['sale', 'purchase'] },
              status: 'posted',
              isDeleted: { $ne: true },
            }).select('customerId type metalFixStatus voucherMeta.fixingType voucherMeta.lineItems').lean()
          : Promise.resolve([]),
      ])
      const debitMap = new Map(debitAggs.map((row) => [String(row._id), row.total]))
      const creditMap = new Map(creditAggs.map((row) => [String(row._id), row.total]))
      const rates = latestRate
        ? {
            goldPrice: Number(latestRate.goldPrice || 0),
            silverPrice: Number(latestRate.silverPrice || 0),
          }
        : DEFAULT_METAL_RATES || { goldPrice: 0, silverPrice: 0 }
      const metalPositionMap = new Map()
      ;(metalTxs || []).forEach((tx) => {
        const customerId = String(tx.customerId || '')
        if (!customerId) return
        const fixingType = tx?.voucherMeta?.fixingType || tx?.metalFixStatus || ''
        if (!isUnfixedFixingType(fixingType)) return
        const position = metalPositionMap.get(customerId) || { goldPosition: 0, silverPosition: 0 }
        const sign = tx.type === 'purchase' ? 1 : -1
        const lines = Array.isArray(tx.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
        lines.forEach((line) => {
          const pureWeight = Number(line?.pureWeight || 0)
          if (!Number.isFinite(pureWeight) || pureWeight === 0) return
          const stockCode = String(line?.stockCode || '').toUpperCase()
          if (stockCode.includes('XAG') || stockCode.includes('SILV')) {
            position.silverPosition += sign * pureWeight
          } else {
            position.goldPosition += sign * pureWeight
          }
        })
        metalPositionMap.set(customerId, position)
      })

      const data = customers.map((customer) => {
        const accountId = String(customer.ledgerAccountId?._id || '')
        const customerId = String(customer._id || '')
        const debit = debitMap.get(accountId) || 0
        const credit = creditMap.get(accountId) || 0
        const opening = Number(customer.ledgerAccountId?.openingBalance ?? customer.openingBalance ?? 0)
        const net = opening + (debit - credit)
        const outstanding = toMoney(net)
        const metalPosition = metalPositionMap.get(customerId) || { goldPosition: 0, silverPosition: 0 }
        const goldPosition = roundPosition(metalPosition.goldPosition)
        const silverPosition = roundPosition(metalPosition.silverPosition)
        const margin = calculateCustomerMargin({
          totalFunds: net,
          goldPosition,
          silverPosition,
          goldPrice: rates.goldPrice,
          silverPrice: rates.silverPrice,
        })
        return {
          ...customer.toObject(),
          outstandingBalance: outstanding,
          goldPosition,
          silverPosition,
          marginAmount: margin.margin,
          marginExcess: margin.excess,
          marginEquity: margin.equity,
          marginPercent: margin.marginPercent,
          marginStatus: margin.status,
          marginRevaluation: margin.revaluation,
          metalRates: {
            goldPrice: Number(rates.goldPrice || 0),
            silverPrice: Number(rates.silverPrice || 0),
          },
          aging: {
            bucket0to30: 0,
            bucket31to60: 0,
            bucket61to90: 0,
            bucket90Plus: 0,
            total: toMoney(Math.abs(net)),
          },
        }
      })

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

  router.post('/customers', protect, validateBody(customerCreateSchema), async (req, res) => {
    try {
      if (!canManageCustomers(req.user)) {
        return res.status(403).json({ success: false, message: 'Forbidden' })
      }

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

      if (!name) {
        return res.status(400).json({ success: false, message: 'Customer name is required' })
      }

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
    } catch (error) {
      res.status(getTransactionWorkflowErrorStatus(error.message)).json({ success: false, message: error.message || 'Server error' })
    }
  })

  router.put('/customers/:id', protect, validateParams(idParam), strictBody(customerPatchSchema), async (req, res) => {
    try {
      if (!canManageCustomers(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
      const updates = {}
      const allowedFields = ['name', 'phone', 'email', 'address', 'gstVat', 'creditLimit', 'paymentTermsDays', 'currency', 'notes', 'isActive', 'ledgerAccountId']
      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) updates[field] = req.body[field]
      })

      const customer = await Customer.findByIdAndUpdate(req.params.id, updates, { returnDocument: 'after' })
      if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' })

      if ((updates.name || updates.currency) && customer.ledgerAccountId) {
        const ledgerUpdates = {}
        if (updates.name) ledgerUpdates.accountName = `${updates.name} (Debtor)`
        if (updates.currency) ledgerUpdates.currency = updates.currency
        if (Object.keys(ledgerUpdates).length) {
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
}

module.exports = {
  registerCustomerRoutes,
}
