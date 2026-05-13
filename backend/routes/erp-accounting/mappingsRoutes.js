function registerMappingsRoutes(deps) {
  const {
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
  } = deps

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

router.post('/mappings', protect, validateBody(mappingCreateSchema), async (req, res) => {
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

router.put('/mappings/:id', protect, validateParams(idParam), validateBody(mappingPatchSchema), async (req, res) => {
  try {
    if (!canManageMappings(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const updates = {}
    const allowedFields = ['mappingType', 'debitAccountId', 'creditAccountId', 'description', 'department', 'isActive']
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field]
    })
    if (updates.department !== undefined) updates.department = String(updates.department || '').trim().toLowerCase()
    const mapping = await AccountMapping.findByIdAndUpdate(req.params.id, updates, { returnDocument: 'after' })
    if (!mapping) return res.status(404).json({ success: false, message: 'Mapping not found' })
    res.json({ success: true, mapping })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.delete('/mappings/:id', protect, async (req, res) => {
  try {
    if (!canManageMappings(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const mapping = await AccountMapping.findByIdAndUpdate(req.params.id, { isActive: false }, { returnDocument: 'after' })
    if (!mapping) return res.status(404).json({ success: false, message: 'Mapping not found' })
    res.json({ success: true, message: 'Mapping deactivated', mapping })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

}

module.exports = {
  registerMappingsRoutes,
}

