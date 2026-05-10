function registerDirectDealsRoutes(deps) {
  const {
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
  } = deps

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
        acc.fixing += deal.entryType === 'fixing' ? 1 : 0
        acc.nonFixing += deal.entryType === 'non_fixing' ? 1 : 0
        return acc
      }, { totalQty: 0, totalAmount: 0, fixing: 0, nonFixing: 0 })

      res.json({ success: true, deals, total, page, limit, summary, permissions: { canManage: canManageDirectDeals(req.user) } })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message || 'Server error' })
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

      const normalizedLines = await Promise.all(lineItems.map((line, index) => normalizeDirectDealLine(line, index)))

      const totalQty = toQty(normalizedLines.reduce((sum, line) => sum + Number(line.qty || 0), 0))
      const totalAmount = toMoney(normalizedLines.reduce((sum, line) => sum + Number(line.amount || 0), 0))
      const resolvedDocNo = String(docNo || '').trim() || await nextDirectDealDocNo()

      const deal = await DirectDeal.create({
        docNo: resolvedDocNo,
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
    } catch (error) {
      res.status(400).json({ success: false, message: error.message || 'Invalid direct deal payload' })
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

      const { docNo, entryType, docDate, valueDate, currency, branch, status, remarks, lineItems } = req.body || {}

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
        const normalizedLines = await Promise.all(lineItems.map((line, index) => normalizeDirectDealLine(line, index)))
        deal.lineItems = normalizedLines
        deal.totalQty = toQty(normalizedLines.reduce((sum, line) => sum + Number(line.qty || 0), 0))
        deal.totalAmount = toMoney(normalizedLines.reduce((sum, line) => sum + Number(line.amount || 0), 0))
      }

      deal.updatedBy = req.user._id
      await deal.save()
      await syncDirectDealLedger({ deal, user: req.user })

      res.json({ success: true, deal })
    } catch (error) {
      res.status(400).json({ success: false, message: error.message || 'Invalid update payload' })
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
    } catch (error) {
      res.status(500).json({ success: false, message: error.message || 'Server error' })
    }
  })
}

module.exports = {
  registerDirectDealsRoutes,
}