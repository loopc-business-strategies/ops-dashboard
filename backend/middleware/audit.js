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
 * @param {{ resource: string, resourceId?: any, action: string, detail?: string, changes?: any, module?: string, documentNo?: string }} entry
 */
async function auditLog(req, {
  resource,
  resourceId = null,
  action,
  detail = '',
  changes = null,
  module = '',
  documentNo = '',
} = {}) {
  try {
    if (!resource || !action) return
    await AuditLog.create({
      actorId:   req.user?._id   || null,
      actorName: req.user?.name  || 'system',
      actorRole: req.user?.role  || '',
      resource,
      resourceId: resourceId || null,
      action,
      detail: String(detail || ''),
      module: String(module || ''),
      documentNo: String(documentNo || ''),
      changes,
      ip:        req.ip || req.headers?.['x-forwarded-for'] || '',
      userAgent: req.headers?.['user-agent'] || '',
    })
  } catch (err) {
    // Audit write failure is non-fatal — log to console only
    console.error('[audit] Failed to write audit log:', err.message)
  }
}

/**
 * Write audit when ALS tenant context is not available (e.g. login before protect).
 * Never throws.
 */
async function auditLogForTenant(tenant, actor, {
  resource,
  resourceId = null,
  action,
  detail = '',
  changes = null,
  module = '',
  documentNo = '',
  ip = '',
  userAgent = '',
} = {}) {
  try {
    if (!tenant || !resource || !action) return
    const Model = await AuditLog.getTenantModel(tenant)
    await Model.create({
      actorId:   actor?._id   || null,
      actorName: actor?.name  || 'system',
      actorRole: actor?.role  || '',
      resource,
      resourceId: resourceId || null,
      action,
      detail: String(detail || ''),
      module: String(module || ''),
      documentNo: String(documentNo || ''),
      changes,
      ip: String(ip || ''),
      userAgent: String(userAgent || ''),
    })
  } catch (err) {
    console.error('[audit] Failed to write tenant audit log:', err.message)
  }
}

module.exports = { auditLog, auditLogForTenant }
