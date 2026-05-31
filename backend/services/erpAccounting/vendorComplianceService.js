/**
 * Vendor document compliance, expiry buckets, summaries, and payment calendar helpers.
 */

const REQUIRED_VENDOR_DOCUMENTS_BY_CATEGORY = {
  general: ['contract', 'trade_license', 'vat_certificate', 'bank_proof'],
  logistics: ['contract', 'trade_license', 'vat_certificate', 'bank_proof'],
  manufacturing: ['contract', 'trade_license', 'vat_certificate', 'bank_proof'],
  services: ['contract', 'trade_license', 'vat_certificate'],
  raw_material: ['contract', 'trade_license', 'vat_certificate', 'bank_proof'],
  contractor: ['contract', 'trade_license', 'vat_certificate', 'bank_proof'],
}

const normalizeVendorCategory = (value) => {
  const normalized = String(value || 'general')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
  return normalized || 'general'
}

const classifyDueAlert = (daysToDue) => {
  if (daysToDue < 0) return 'overdue'
  if (daysToDue <= 7) return 'due_soon'
  if (daysToDue <= 30) return 'upcoming'
  return 'later'
}

function createVendorComplianceService({
  Transaction,
  Ledger,
  toMoney,
  getOutstandingForAccount,
  getAgingForAccount,
}) {
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

  const buildVendorSummary = async (vendor) => {
    const ledgerAccountId = vendor.ledgerAccountId?._id
    const [outstandingRaw, aging, purchaseCount, paymentCount, postedAmountSummary, recentTransaction] = await Promise.all([
      getOutstandingForAccount(ledgerAccountId),
      getAgingForAccount(ledgerAccountId),
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
      if (row._id.type === 'payment') { m.paymentCount = row.count; m.paymentAmount = toMoney(row.total) }
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

  const buildVendorPaymentCalendar = async (vendor, options = {}) => {
    const [purchases, payments] = await Promise.all([
      Transaction.find({
        vendorId: vendor._id,
        type: 'purchase',
        status: 'posted',
        isDeleted: { $ne: true },
      })
        .sort({ date: 1, createdAt: 1 })
        .select('amount date currency description')
        .lean(),
      Transaction.find({
        vendorId: vendor._id,
        type: 'payment',
        status: 'posted',
        isDeleted: { $ne: true },
      })
        .sort({ date: 1, createdAt: 1 })
        .select('amount date currency description')
        .lean(),
    ])
    return computeVendorPaymentCalendar(vendor, purchases, payments, options)
  }

  const computeVendorPaymentCalendar = (vendor, purchases, payments, options = {}) => {
    const asOfDate = options.asOfDate ? new Date(options.asOfDate) : new Date()
    const horizonDays = Number(options.horizonDays || 45)
    const startDate = options.startDate ? new Date(options.startDate) : null
    const endDate = options.endDate ? new Date(options.endDate) : null

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

  const batchVendorPaymentCalendars = async (vendors, options = {}) => {
    if (!Array.isArray(vendors) || !vendors.length) return new Map()
    const vendorIds = vendors.map((vendor) => vendor._id).filter(Boolean)
    const [purchases, payments] = await Promise.all([
      Transaction.find({
        vendorId: { $in: vendorIds },
        type: 'purchase',
        status: 'posted',
        isDeleted: { $ne: true },
      })
        .sort({ date: 1, createdAt: 1 })
        .select('vendorId amount date currency description')
        .lean(),
      Transaction.find({
        vendorId: { $in: vendorIds },
        type: 'payment',
        status: 'posted',
        isDeleted: { $ne: true },
      })
        .sort({ date: 1, createdAt: 1 })
        .select('vendorId amount date currency description')
        .lean(),
    ])
    const purchasesByVendor = new Map()
    const paymentsByVendor = new Map()
    purchases.forEach((tx) => {
      const vendorId = String(tx.vendorId || '')
      if (!vendorId) return
      if (!purchasesByVendor.has(vendorId)) purchasesByVendor.set(vendorId, [])
      purchasesByVendor.get(vendorId).push(tx)
    })
    payments.forEach((tx) => {
      const vendorId = String(tx.vendorId || '')
      if (!vendorId) return
      if (!paymentsByVendor.has(vendorId)) paymentsByVendor.set(vendorId, [])
      paymentsByVendor.get(vendorId).push(tx)
    })
    const calendars = new Map()
    vendors.forEach((vendor) => {
      const vendorId = String(vendor._id || '')
      calendars.set(
        vendorId,
        computeVendorPaymentCalendar(
          vendor,
          purchasesByVendor.get(vendorId) || [],
          paymentsByVendor.get(vendorId) || [],
          options
        )
      )
    })
    return calendars
  }

  return {
    evaluateVendorCompliance,
    buildDocumentExpiryBuckets,
    buildVendorPaymentCalendar,
    batchVendorPaymentCalendars,
    buildVendorSummary,
    batchVendorSummaries,
  }
}

module.exports = {
  REQUIRED_VENDOR_DOCUMENTS_BY_CATEGORY,
  normalizeVendorCategory,
  classifyDueAlert,
  createVendorComplianceService,
}
