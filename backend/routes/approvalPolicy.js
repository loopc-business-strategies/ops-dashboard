const { protect } = require('../middleware/auth')
const { hasModuleVerb, resolveApprovalPolicy, assertMakerChecker, isFinanceUser, VERBS } = require('../services/permissions/approvalPolicy')
const express = require('express')

const router = express.Router()

/** Diagnostic / settings preview — does not mutate data */
router.get('/approval-policy', protect, (req, res) => {
  const entityType = String(req.query.entityType || 'payment')
  const policy = resolveApprovalPolicy(entityType, req.query.settings ? {} : {})
  res.json({
    success: true,
    verbs: VERBS,
    isFinanceUser: isFinanceUser(req.user),
    policy,
    sampleVerbChecks: {
      financeView: hasModuleVerb(req.user, 'finance', 'view', {
        legacyAllow: () => isFinanceUser(req.user) || req.user?.role === 'management',
      }),
      financeExport: hasModuleVerb(req.user, 'finance', 'export'),
    },
  })
})

router.post('/approval-policy/check', protect, (req, res) => {
  const policy = resolveApprovalPolicy(req.body?.entityType, req.body?.settings || {})
  const blocked = assertMakerChecker({
    policy,
    creatorId: req.body?.creatorId,
    approverId: req.body?.approverId || req.user?._id,
    amount: req.body?.amount,
  })
  if (blocked) {
    return res.status(403).json({ success: false, message: blocked, code: 'SOD_VIOLATION', policy })
  }
  return res.json({ success: true, allowed: true, policy })
})

module.exports = router
