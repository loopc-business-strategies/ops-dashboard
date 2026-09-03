const User = require('../../models/User')
const AccountingPeriod = require('../../models/AccountingPeriod')
const { auditLog } = require('../../middleware/audit')
const { respondRouteError } = require('../../utils/routeErrorHelpers')
const { isAccountingPeriodClosingEnabled } = require('../../../shared/accountingPeriodClosing')

function registerAccountingPeriodRoutes(deps) {
  const {
    router,
    protect,
    canManageAccountingPeriods,
    canViewLedger,
    canAccessReports,
    accountingPeriodLockService,
  } = deps

  const {
    listPeriodsForYear,
    getClosingChecklist,
    periodLabel,
    ensureMonthlyPeriod,
    ensureYearlyPeriod,
  } = accountingPeriodLockService

  function requireFeature(req, res) {
    const tenant = req.tenant || req.user?.company
    if (!isAccountingPeriodClosingEnabled(tenant)) {
      res.status(404).json({ success: false, message: 'Accounting period closing is not enabled for this company.' })
      return false
    }
    return true
  }

  function canViewPeriods(user) {
    return canManageAccountingPeriods(user) || canViewLedger(user) || canAccessReports(user)
  }

  async function verifySuperAdminPassword(req, password) {
    if (!canManageAccountingPeriods(req.user)) {
      const err = new Error('Only Super Admin can close or reopen accounting periods.')
      err.status = 403
      throw err
    }
    const pwd = String(password || '')
    if (!pwd) {
      const err = new Error('Password confirmation is required.')
      err.status = 400
      throw err
    }
    const user = await User.findById(req.user._id).select('+password')
    if (!user || !(await user.comparePassword(pwd))) {
      const err = new Error('Invalid password confirmation.')
      err.status = 401
      throw err
    }
    return user
  }

  router.get('/accounting-periods', protect, async (req, res) => {
    try {
      if (!requireFeature(req, res)) return
      if (!canViewPeriods(req.user)) {
        return res.status(403).json({ success: false, message: 'Forbidden' })
      }
      const year = Number(req.query.financialYear) || new Date().getUTCFullYear()
      const data = await listPeriodsForYear(year)
      return res.json({
        success: true,
        financialYear: year,
        yearly: data.yearly,
        months: data.months,
        canManage: canManageAccountingPeriods(req.user),
      })
    } catch (err) {
      return respondRouteError(res, err, { tag: 'accounting-periods.list' })
    }
  })

  router.get('/accounting-periods/:id/closing-check', protect, async (req, res) => {
    try {
      if (!requireFeature(req, res)) return
      if (!canManageAccountingPeriods(req.user) && !canViewPeriods(req.user)) {
        return res.status(403).json({ success: false, message: 'Forbidden' })
      }
      const period = await AccountingPeriod.findById(req.params.id)
      if (!period) return res.status(404).json({ success: false, message: 'Period not found' })
      const checklist = await getClosingChecklist(period)
      return res.json({
        success: true,
        period,
        checklist,
        label: periodLabel(period.periodType, period.financialYear, period.month),
      })
    } catch (err) {
      return respondRouteError(res, err, { tag: 'accounting-periods.closing-check' })
    }
  })

  router.post('/accounting-periods/:id/close', protect, async (req, res) => {
    try {
      if (!requireFeature(req, res)) return
      await verifySuperAdminPassword(req, req.body?.password)

      const reason = String(req.body?.reason || '').trim()
      const period = await AccountingPeriod.findById(req.params.id)
      if (!period) return res.status(404).json({ success: false, message: 'Period not found' })
      if (period.status === 'CLOSED') {
        return res.status(400).json({ success: false, message: 'Period is already closed.' })
      }

      const checklist = await getClosingChecklist(period)
      if (!checklist.canClose) {
        return res.status(400).json({
          success: false,
          message: 'CANNOT CLOSE PERIOD',
          code: 'CLOSING_CHECK_FAILED',
          checklist,
        })
      }

      const previousStatus = period.status
      period.status = 'CLOSED'
      period.closedAt = new Date()
      period.closedBy = req.user._id
      period.closeReason = reason
      await period.save()

      const action = period.periodType === 'YEARLY' ? 'YEAR_CLOSED' : 'PERIOD_CLOSED'
      const label = periodLabel(period.periodType, period.financialYear, period.month)
      await auditLog(req, {
        resource: 'AccountingPeriod',
        resourceId: period._id,
        action,
        detail: `${label} closed`,
        changes: { previousStatus, newStatus: 'CLOSED', reason },
      })

      return res.json({ success: true, period, label, checklist })
    } catch (err) {
      return respondRouteError(res, err, { tag: 'accounting-periods.close' })
    }
  })

  router.post('/accounting-periods/:id/reopen', protect, async (req, res) => {
    try {
      if (!requireFeature(req, res)) return
      await verifySuperAdminPassword(req, req.body?.password)

      const reason = String(req.body?.reason || '').trim()
      if (!reason) {
        return res.status(400).json({ success: false, message: 'Reopen reason is required.' })
      }

      const period = await AccountingPeriod.findById(req.params.id)
      if (!period) return res.status(404).json({ success: false, message: 'Period not found' })
      if (period.status !== 'CLOSED') {
        return res.status(400).json({ success: false, message: 'Period is not closed.' })
      }

      // Yearly reopen does not auto-reopen months; monthly reopen still blocked if year closed
      if (period.periodType === 'MONTHLY') {
        await ensureYearlyPeriod(period.financialYear)
        const yearly = await AccountingPeriod.findOne({
          periodType: 'YEARLY',
          financialYear: period.financialYear,
          month: null,
        })
        if (yearly?.status === 'CLOSED') {
          return res.status(400).json({
            success: false,
            message: `FY ${period.financialYear} is closed. Reopen the financial year before reopening this month.`,
            code: 'YEAR_STILL_CLOSED',
          })
        }
      }

      const previousStatus = period.status
      period.status = 'OPEN'
      period.reopenedAt = new Date()
      period.reopenedBy = req.user._id
      period.reopenReason = reason
      await period.save()

      // Ensure sibling docs exist after reopen
      if (period.periodType === 'MONTHLY') {
        await ensureMonthlyPeriod(period.financialYear, period.month)
      } else {
        await ensureYearlyPeriod(period.financialYear)
      }

      const action = period.periodType === 'YEARLY' ? 'YEAR_REOPENED' : 'PERIOD_REOPENED'
      const label = periodLabel(period.periodType, period.financialYear, period.month)
      await auditLog(req, {
        resource: 'AccountingPeriod',
        resourceId: period._id,
        action,
        detail: `${label} reopened: ${reason}`,
        changes: { previousStatus, newStatus: 'OPEN', reason },
      })

      return res.json({ success: true, period, label })
    } catch (err) {
      return respondRouteError(res, err, { tag: 'accounting-periods.reopen' })
    }
  })
}

module.exports = { registerAccountingPeriodRoutes }
