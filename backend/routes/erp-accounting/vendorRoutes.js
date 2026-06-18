const { Joi } = require('../../middleware/validate')
const { escapeRegex } = require('../../utils/escapeRegex')
const { restrictTo } = require('../../middleware/auth')
const {
  planVendorRegistryMaintenance,
  applyVendorRegistryMaintenance,
} = require('../../services/vendorRegistryMaintenance')
const fs = require('fs')
const path = require('path')
const { computeMarginMetricsRaw } = require('../../services/erpAccounting/metalMarginPolicy')

const vendorDocumentParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
  documentId: Joi.string().hex().length(24).required(),
})
const vendorWorkflowSchema = Joi.object({
  status: Joi.string().trim().lowercase().valid('draft', 'review', 'approved', 'blacklisted').required(),
  reason: Joi.string().trim().allow('').max(1000).optional(),
})
const vendorDocumentSchema = Joi.object({
  docType: Joi.string().valid('contract', 'trade_license', 'vat_certificate', 'bank_proof', 'other').optional(),
  title: Joi.string().trim().min(1).max(200).required(),
  documentNo: Joi.string().trim().allow('').max(120).optional(),
  fileUrl: Joi.string().trim().allow('').max(1000).optional(),
  issueDate: Joi.date().allow('', null).optional(),
  expiryDate: Joi.date().allow('', null).optional(),
  status: Joi.string().valid('active', 'expired', 'pending_verification').optional(),
  verified: Joi.boolean().optional(),
  notes: Joi.string().trim().allow('').max(1000).optional(),
})
const vendorDocumentPatchSchema = vendorDocumentSchema.fork(['title'], (schema) => schema.optional()).min(1)

function registerVendorRoutes(deps) {
  const {
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
    _canAccessVendors,
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
  } = deps

  const strictBody = validateBodyStrict || validateBody
  const isUnfixedFixingType = (value) => {
    const normalized = String(value || '').trim().toLowerCase()
    return ['non-fixing', 'non_fixing', 'nonfixing', 'unfixed', 'unfix'].includes(normalized)
  }
  const roundPosition = (value) => Number(Number(value || 0).toFixed(6))
  const calculateVendorMargin = ({ totalFunds, goldPosition, silverPosition, goldPrice, silverPrice }) => {
    const raw = computeMarginMetricsRaw({
      totalFunds,
      goldPosition,
      silverPosition,
      goldPrice,
      silverPrice,
      suppressMetalSpotMtm: true,
      fundsMode: 'asIs',
    })
    return {
      revaluation: toMoney(raw.revaluation),
      margin: toMoney(raw.margin),
      equity: toMoney(raw.equity),
      excess: toMoney(raw.excess),
      marginPercent: toMoney(raw.marginPercent),
      status: raw.status,
    }
  }

  router.get('/vendors', protect, async (req, res) => {
    try {
      if (!canReadErpParties(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

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
        const regex = new RegExp(escapeRegex(search), 'i')
        query.$or = [
          { name: regex },
          { vendorCode: regex },
          { contactPerson: regex },
          { phone: regex },
          { email: regex },
        ]
      }

      const [vendors, total] = await Promise.all([
        Vendor.find(query)
          .populate({
            path: 'ledgerAccountId',
            select: 'accountCode accountName accountType isActive',
            match: { isActive: true },
          })
          .sort({ vendorCode: 1, name: 1 })
          .skip(skip)
          .limit(limit),
        Vendor.countDocuments(query),
      ])

      const vendorIds = vendors.map((vendor) => vendor._id).filter(Boolean)
      const [summaries, paymentScheduleMap, latestRate, metalTxs] = await Promise.all([
        batchVendorSummaries(vendors),
        batchVendorPaymentCalendars(vendors, { horizonDays: 45 }),
        typeof getLatestMetalRate === 'function' ? getLatestMetalRate() : Promise.resolve(null),
        vendorIds.length && Transaction
          ? Transaction.find({
              vendorId: { $in: vendorIds },
              type: { $in: ['sale', 'purchase'] },
              status: 'posted',
              isDeleted: { $ne: true },
            }).select('vendorId type metalFixStatus voucherMeta.fixingType voucherMeta.lineItems').lean()
          : Promise.resolve([]),
      ])
      const rates = latestRate
        ? {
            goldPrice: Number(latestRate.goldPrice || 0),
            silverPrice: Number(latestRate.silverPrice || 0),
          }
        : DEFAULT_METAL_RATES || { goldPrice: 0, silverPrice: 0 }
      const metalPositionMap = new Map()
      ;(metalTxs || []).forEach((tx) => {
        const vendorId = String(tx.vendorId || '')
        if (!vendorId) return
        const fixingType = tx?.voucherMeta?.fixingType || tx?.metalFixStatus || ''
        if (!isUnfixedFixingType(fixingType)) return
        const position = metalPositionMap.get(vendorId) || { goldPosition: 0, silverPosition: 0 }
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
        metalPositionMap.set(vendorId, position)
      })
      const data = vendors.map((vendor, index) => ({
        ...(() => {
          const summary = summaries[index] || {}
          const paymentSchedule = paymentScheduleMap.get(String(vendor._id || '')) || { calendar: [], alertCounts: {}, totalDue: 0 }
          const rawPosition = metalPositionMap.get(String(vendor._id || '')) || { goldPosition: 0, silverPosition: 0 }
          const goldPosition = roundPosition(rawPosition.goldPosition)
          const silverPosition = roundPosition(rawPosition.silverPosition)
          const outstanding = Number(summary.outstanding ?? summary.outstandingBalance ?? 0)
          const margin = calculateVendorMargin({
            totalFunds: -Math.abs(outstanding),
            goldPosition,
            silverPosition,
            goldPrice: rates.goldPrice,
            silverPrice: rates.silverPrice,
          })
          return {
            ...vendor.toObject(),
            ...summary,
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
            nextDue: paymentSchedule.calendar?.[0] || null,
            dueAlerts: paymentSchedule.alertCounts || { overdue: 0, due_soon: 0, upcoming: 0, later: 0 },
            dueAmount: paymentSchedule.totalDue || 0,
          }
        })(),
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
      if (!canReadErpParties(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

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
      if (!canReadErpParties(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

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

      const paymentScheduleMap = await batchVendorPaymentCalendars(vendors, { horizonDays })
      const queue = []
      vendors.forEach((vendor) => {
        const schedule = paymentScheduleMap.get(String(vendor._id || '')) || { calendar: [] }
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
      })

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

  router.post('/vendors', protect, validateBody(vendorCreateSchema), async (req, res) => {
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

      if (!name) {
        return res.status(400).json({ success: false, message: 'Vendor name is required' })
      }

      const normalizedCode = String(vendorCode || '').trim().toUpperCase() || await nextVendorCode()
      const duplicateCode = await Vendor.exists({ vendorCode: normalizedCode, deletedAt: null })
      if (duplicateCode) {
        return res.status(400).json({ success: false, message: 'Vendor code already exists' })
      }

      const payableParent = await ChartOfAccount.findOne({
        accountType: 'Liability',
        isActive: true,
        $or: [
          { accountCode: '2000' },
          { accountName: /accounts payable|payable/i },
        ],
      }).sort({ accountCode: 1 })

      const accountCode = await nextVendorAccountCode()
      const creditorAccount = await ChartOfAccount.create({
        accountName: `${name} (Creditor)`,
        accountCode,
        accountType: 'Liability',
        parentAccountId: payableParent?._id || null,
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
    } catch (error) {
      console.error('[vendor] error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  })

  router.put('/vendors/:id', protect, validateParams(idParam), strictBody(vendorPatchSchema), async (req, res) => {
    try {
      if (!canUpdateVendorOperational(req.user)) {
        return res.status(403).json({ success: false, message: 'Only Admin/Finance/Operations can update vendors' })
      }

      const vendor = await Vendor.findById(req.params.id)
      if (!vendor || vendor.deletedAt) return res.status(404).json({ success: false, message: 'Vendor not found' })

      const isFinanceManager = canManageVendors(req.user)
      const financeAllowed = ['vendorCode', 'name', 'contactPerson', 'phone', 'email', 'address', 'city', 'country', 'postalCode', 'gstVat', 'taxRegistrationNo', 'currency', 'preferredCurrency', 'paymentTermsDays', 'creditLimit', 'category', 'rating', 'riskLevel', 'status', 'notes', 'tags', 'bankName', 'bankAccountNumber', 'iban', 'swiftCode', 'isActive']
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
      if (updates.riskLevel !== undefined) updates.riskLevel = String(updates.riskLevel || 'medium').toLowerCase()
      if (updates.tags !== undefined) {
        updates.tags = Array.isArray(updates.tags)
          ? updates.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 20)
          : String(updates.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 20)
      }
      updates.updatedBy = req.user._id

      const updatedVendor = await Vendor.findByIdAndUpdate(req.params.id, updates, { returnDocument: 'after' })
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
      if (!canReadErpParties(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

      const vendor = await Vendor.findById(req.params.id)
        .populate('ledgerAccountId', 'accountCode accountName accountType currency')
      if (!vendor || vendor.deletedAt) return res.status(404).json({ success: false, message: 'Vendor not found' })

      const [summary, paymentCalendar, recentTransactions, recentLedgerEntries] = await Promise.all([
        buildVendorSummary(vendor),
        buildVendorPaymentCalendar(vendor, { horizonDays: 45 }),
        Transaction.find({ vendorId: vendor._id, isDeleted: { $ne: true } })
          .sort({ date: -1, createdAt: -1 })
          .limit(20)
          .select('type amount date description currency status journalEntryId')
          .lean(),
        vendor.ledgerAccountId?._id
          ? Ledger.find({
              isDeleted: { $ne: true },
              $or: [
                { debitAccountId: vendor.ledgerAccountId._id },
                { creditAccountId: vendor.ledgerAccountId._id },
              ],
            })
              .sort({ date: -1, createdAt: -1 })
              .limit(20)
              .populate('debitAccountId', 'accountCode accountName')
              .populate('creditAccountId', 'accountCode accountName')
              .select('date amount description referenceType currency debitAccountId creditAccountId')
              .lean()
          : Promise.resolve([]),
      ])

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

  router.post('/vendors/:id/workflow', protect, validateParams(idParam), validateBody(vendorWorkflowSchema), async (req, res) => {
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
      if (!canReadErpParties(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
      const vendor = await Vendor.findById(req.params.id).select('name vendorCode documents')
      if (!vendor || vendor.deletedAt) return res.status(404).json({ success: false, message: 'Vendor not found' })
      res.json({ success: true, vendorId: vendor._id, vendorName: vendor.name, vendorCode: vendor.vendorCode || '', documents: vendor.documents || [] })
    } catch {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  })

  router.post('/vendors/:id/documents', protect, validateParams(idParam), validateBody(vendorDocumentSchema), async (req, res) => {
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

  router.post('/vendors/:id/documents/upload', protect, validateParams(idParam), vendorDocumentUpload.single('file'), async (req, res) => {
    try {
      if (!canUpdateVendorOperational(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
      if (!req.file) return res.status(400).json({ success: false, message: 'File is required' })

      const vendor = await Vendor.findById(req.params.id)
      if (!vendor || vendor.deletedAt) return res.status(404).json({ success: false, message: 'Vendor not found' })

      if (!validateAttachmentContent(req.file)) {
        const filePath = path.resolve(vendorDocumentUploadDir, req.file.filename)
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
        return res.status(400).json({ success: false, message: 'Unsupported or invalid attachment content' })
      }

      const TenantVendor = await Vendor.getTenantModel(req.tenant)
      const stored = await storeUploadedAttachment({
        req,
        file: req.file,
        user: req.user,
        model: TenantVendor,
        relativePathPrefix: '/uploads/vendor-documents',
        bucketName: 'vendorDocuments',
        metadata: { vendorId: String(vendor._id) },
      })

      const title = String(req.body.title || req.file.originalname || 'Vendor attachment').trim()
      vendor.documents.push({
        docType: ['contract', 'trade_license', 'vat_certificate', 'bank_proof', 'other'].includes(String(req.body.docType || '').trim()) ? req.body.docType : 'other',
        title,
        documentNo: String(req.body.documentNo || '').trim(),
        fileUrl: stored.url,
        originalName: stored.originalName,
        fileName: stored.fileName,
        relativePath: stored.relativePath,
        storageDriver: stored.storageDriver,
        storageKey: stored.storageKey,
        mimeType: stored.mimeType,
        size: stored.size,
        issueDate: req.body.issueDate ? new Date(req.body.issueDate) : null,
        expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : null,
        status: ['active', 'expired', 'pending_verification'].includes(String(req.body.status || '').trim()) ? req.body.status : 'active',
        notes: String(req.body.notes || '').trim(),
        uploadedBy: req.user._id,
      })
      vendor.updatedBy = req.user._id
      await vendor.save()

      res.status(201).json({ success: true, documents: vendor.documents || [] })
    } catch (error) {
      if (req.file?.filename) {
        const filePath = path.resolve(vendorDocumentUploadDir, req.file.filename)
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      }
      res.status(500).json({ success: false, message: error?.message || 'Server error' })
    }
  })

  router.get('/vendors/:id/documents/:documentId/download', protect, validateParams(vendorDocumentParamSchema), async (req, res) => {
    try {
      if (!canReadErpParties(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

      const vendor = await Vendor.findById(req.params.id)
      if (!vendor || vendor.deletedAt) return res.status(404).json({ success: false, message: 'Vendor not found' })

      const doc = vendor.documents.id(req.params.documentId)
      if (!doc || !doc.fileName) return res.status(404).json({ success: false, message: 'Document file not found' })

      if (doc.mimeType) res.type(doc.mimeType)
      const disposition = req.query.download === '1' ? 'attachment' : 'inline'
      res.setHeader('Content-Disposition', `${disposition}; filename="${String(doc.originalName || doc.title || doc.fileName).replace(/"/g, '')}"`)

      const TenantVendor = await Vendor.getTenantModel(req.tenant)
      const filePath = path.resolve(vendorDocumentUploadDir, doc.fileName)
      return sendStoredAttachment({ res, attachment: doc, transactionModel: TenantVendor, localFilePath: filePath, bucketName: 'vendorDocuments' })
    } catch {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  })

  router.put('/vendors/:id/documents/:documentId', protect, validateParams(vendorDocumentParamSchema), strictBody(vendorDocumentPatchSchema), async (req, res) => {
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

  router.delete('/vendors/:id/documents/:documentId', protect, validateParams(vendorDocumentParamSchema), async (req, res) => {
    try {
      if (!canUpdateVendorOperational(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

      const vendor = await Vendor.findById(req.params.id)
      if (!vendor || vendor.deletedAt) return res.status(404).json({ success: false, message: 'Vendor not found' })

      const doc = vendor.documents.id(req.params.documentId)
      if (!doc) return res.status(404).json({ success: false, message: 'Document not found' })
      const filePath = doc.fileName ? path.resolve(vendorDocumentUploadDir, doc.fileName) : ''
      const TenantVendor = doc.fileName ? await Vendor.getTenantModel(req.tenant) : null
      if (TenantVendor) {
        await removeStoredAttachment({ attachment: doc, transactionModel: TenantVendor, localFilePath: filePath, bucketName: 'vendorDocuments' })
      }
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
      if (!canReadErpParties(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

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

      const paymentScheduleMap = await batchVendorPaymentCalendars(vendors, { horizonDays, startDate, endDate })
      const rows = []
      vendors.forEach((vendor) => {
        const schedule = paymentScheduleMap.get(String(vendor._id || '')) || { calendar: [] }
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
      })

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

  router.post('/vendors/registry-maintenance', protect, restrictTo('super_admin'), async (req, res) => {
    try {
      const db = Vendor.db?.db
      if (!db) {
        return res.status(500).json({ success: false, message: 'Tenant database unavailable' })
      }

      const dryRun = req.body?.dryRun !== false && req.body?.apply !== true
      const purgeDeleted = req.body?.purgeDeleted !== false
      const removePlaceholders = req.body?.removePlaceholders !== false

      const plan = await planVendorRegistryMaintenance(db, { purgeDeleted, removePlaceholders })

      if (plan.blockedRemovals.length) {
        return res.status(400).json({
          success: false,
          message: 'Vendor registry maintenance blocked for vendors with ledger or transaction activity',
          plan,
        })
      }

      if (dryRun) {
        return res.json({ success: true, mode: 'dry_run', plan })
      }

      const result = await applyVendorRegistryMaintenance(db, plan)
      return res.json({ success: true, mode: 'apply', plan, result })
    } catch (error) {
      console.error('[Vendor registry maintenance]', error.message)
      return res.status(500).json({ success: false, message: error.message })
    }
  })

  router.delete('/vendors/:id', protect, validateParams(idParam), async (req, res) => {
    try {
      if (!canManageVendors(req.user)) {
        return res.status(403).json({ success: false, message: 'Only Admin/Finance can delete vendors' })
      }

      const vendor = await Vendor.findById(req.params.id)
      if (!vendor || vendor.deletedAt) return res.status(404).json({ success: false, message: 'Vendor not found' })

      const [transactionCount, ledgerCount] = await Promise.all([
        Transaction.countDocuments({ vendorId: vendor._id, isDeleted: { $ne: true } }),
        vendor.ledgerAccountId
          ? Ledger.countDocuments({
              isDeleted: { $ne: true },
              $or: [{ debitAccountId: vendor.ledgerAccountId }, { creditAccountId: vendor.ledgerAccountId }],
            })
          : Promise.resolve(0),
      ])

      if (transactionCount > 0 || ledgerCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot remove vendor with ledger activity or transactions. Deactivate instead or clear postings first.',
          transactionCount,
          ledgerCount,
        })
      }

      vendor.isActive = false
      vendor.deletedAt = new Date()
      vendor.updatedBy = req.user._id
      await vendor.save()

      if (vendor.ledgerAccountId) {
        await ChartOfAccount.findByIdAndUpdate(vendor.ledgerAccountId, { isActive: false })
      }

      res.json({ success: true, message: 'Vendor removed', vendor })
    } catch {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  })
}

module.exports = {
  registerVendorRoutes,
}
