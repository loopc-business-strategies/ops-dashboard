// ==========================================
// FILE: backend/middleware/audit.js
// Helper to write an audit log entry.
// Usage in any route handler:
//   await auditLog(req, { resource: 'Transaction', resourceId: tx._id, action: 'status_change', detail: 'draft → posted' })
// ==========================================

const AuditLog = require('../models/AuditLog')

/**
 * Write an immutable audit record.
 * Never throws — audit failures must not break the main request.
 *
 * @param {import('express').Request} req  - Express request (for actor + IP info)
 * @param {{ resource: string, resourceId?: any, action: string, detail?: string, changes?: any }} entry
 */
async function auditLog(req, { resource, resourceId = null, action, detail = '', changes = null }) {
  try {
    await AuditLog.create({
      actorId:   req.user?._id   || null,
      actorName: req.user?.name  || 'system',
      actorRole: req.user?.role  || '',
      resource,
      resourceId,
      action,
      detail,
      changes,
      ip:        req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    })
  } catch (err) {
    // Audit write failure is non-fatal — log to console only
    console.error('[audit] Failed to write audit log:', err.message)
  }
}

module.exports = { auditLog }
