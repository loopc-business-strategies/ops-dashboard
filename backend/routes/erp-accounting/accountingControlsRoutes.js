const { auditLog } = require('../../middleware/audit')
const { respondRouteError } = require('../../utils/routeErrorHelpers')
const { isVoucher24HourLockFeatureEnabled } = require('../../shared/voucher24HourLock')
const {
  getOrCreateAccountingControls,
  setVoucher24HourLockEnabled,
} = require('../../services/erpAccounting/voucher24HourLockService')
const { isSuperAdmin } = require('../../services/erpAccounting/accessPolicy')

function registerAccountingControlsRoutes(deps) {
  const { router, protect } = deps

  function requireFeature(req, res) {
    const tenant = req.tenant || req.user?.company
    if (!isVoucher24HourLockFeatureEnabled(tenant)) {
      res.status(404).json({
        success: false,
        message: '24-hour voucher lock is not enabled for this company.',
      })
      return false
    }
    return true
  }

  router.get('/accounting-controls', protect, async (req, res) => {
    try {
      if (!requireFeature(req, res)) return
      const doc = await getOrCreateAccountingControls()
      return res.json({
        success: true,
        voucher24HourLockEnabled: doc.voucher24HourLockEnabled !== false,
        canManage: isSuperAdmin(req.user),
      })
    } catch (err) {
      return respondRouteError(res, err, { tag: 'accounting-controls.get' })
    }
  })

  router.put('/accounting-controls', protect, async (req, res) => {
    try {
      if (!requireFeature(req, res)) return
      if (!isSuperAdmin(req.user)) {
        return res.status(403).json({
          success: false,
          message: 'Only Super Admin can change 24-hour voucher lock settings.',
        })
      }
      if (typeof req.body?.voucher24HourLockEnabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'voucher24HourLockEnabled (boolean) is required.',
        })
      }

      const { previous, current, doc } = await setVoucher24HourLockEnabled(req.body.voucher24HourLockEnabled)
      if (previous !== current) {
        await auditLog(req, {
          resource: 'AccountingControls',
          resourceId: doc?._id,
          action: current ? 'VOUCHER_24H_LOCK_ENABLED' : 'VOUCHER_24H_LOCK_DISABLED',
          detail: `24-Hour Voucher/JV Lock ${current ? 'enabled' : 'disabled'}`,
          changes: { voucher24HourLockEnabled: { from: previous, to: current } },
        })
      }

      return res.json({
        success: true,
        voucher24HourLockEnabled: current,
        canManage: true,
      })
    } catch (err) {
      return respondRouteError(res, err, { tag: 'accounting-controls.put' })
    }
  })
}

module.exports = { registerAccountingControlsRoutes }
