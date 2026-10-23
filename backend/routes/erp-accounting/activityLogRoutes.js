const { protect } = require('../../middleware/auth')
const AuditLog = require('../../models/AuditLog')
const { respondRouteError } = require('../../utils/routeErrorHelpers')
const { parseOffsetPagination } = require('../../utils/pagination')

function parseDateBound(value, endOfDay = false) {
  if (!value) return null
  const raw = String(value).trim()
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    if (endOfDay) d.setUTCHours(23, 59, 59, 999)
    else d.setUTCHours(0, 0, 0, 0)
  }
  return d
}

function resolveRange({ startDate, endDate, month, financialYear }) {
  const start = parseDateBound(startDate, false)
  const end = parseDateBound(endDate, true)

  const fy = Number(financialYear)
  if (Number.isFinite(fy) && fy >= 2000 && fy <= 2100) {
    const fyStart = new Date(Date.UTC(fy, 0, 1, 0, 0, 0, 0))
    const fyEnd = new Date(Date.UTC(fy, 11, 31, 23, 59, 59, 999))
    return {
      start: start && start > fyStart ? start : fyStart,
      end: end && end < fyEnd ? end : fyEnd,
    }
  }

  const monthKey = String(month || '').trim()
  if (/^\d{4}-\d{2}$/.test(monthKey)) {
    const [y, m] = monthKey.split('-').map(Number)
    const monthStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0))
    const monthEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999))
    return {
      start: start && start > monthStart ? start : monthStart,
      end: end && end < monthEnd ? end : monthEnd,
    }
  }

  return { start, end }
}

function registerActivityLogRoutes({ router, canAccessReports }) {
  router.get('/activity-logs', protect, async (req, res) => {
    try {
      if (typeof canAccessReports === 'function' && !canAccessReports(req.user)) {
        return res.status(403).json({ success: false, message: 'Forbidden' })
      }

      const {
        module: moduleFilter = '',
        action = '',
        actorId = '',
        documentNo = '',
        q = '',
        startDate = '',
        endDate = '',
        month = '',
        financialYear = '',
      } = req.query || {}

      const { page, limit, skip } = parseOffsetPagination(req.query, 50, 200)
      const { start, end } = resolveRange({ startDate, endDate, month, financialYear })

      const filter = {}
      if (moduleFilter) filter.module = String(moduleFilter).trim()
      if (action) filter.action = String(action).trim()
      if (actorId) filter.actorId = String(actorId).trim()
      if (documentNo) filter.documentNo = { $regex: String(documentNo).trim(), $options: 'i' }
      if (start || end) {
        filter.createdAt = {}
        if (start) filter.createdAt.$gte = start
        if (end) filter.createdAt.$lte = end
      }
      if (q) {
        const term = String(q).trim()
        filter.$or = [
          { detail: { $regex: term, $options: 'i' } },
          { documentNo: { $regex: term, $options: 'i' } },
          { actorName: { $regex: term, $options: 'i' } },
          { resource: { $regex: term, $options: 'i' } },
          { action: { $regex: term, $options: 'i' } },
        ]
      }

      const [items, total] = await Promise.all([
        AuditLog.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        AuditLog.countDocuments(filter),
      ])

      res.json({
        success: true,
        items,
        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
        filters: {
          modules: ['auth', 'voucher', 'journal', 'account', 'period'],
          actions: [
            'login', 'logout', 'logout_all',
            'create', 'update', 'submit', 'post', 'void', 'return', 'reject', 'delete',
          ],
        },
      })
    } catch (err) {
      respondRouteError(res, err, { tag: 'erp-accounting/activityLogRoutes' })
    }
  })
}

module.exports = {
  registerActivityLogRoutes,
  resolveRange,
}
