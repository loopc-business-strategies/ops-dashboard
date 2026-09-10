const AuditLog = require('../../models/AuditLog')
const { writeOpts } = require('../../utils/mongoTransaction')

/**
 * Session-aware audit write for production custody operations.
 * Participates in Mongo transactions when `session` is provided.
 * Unlike the fire-and-forget helper, this throws so the transaction can abort.
 */
async function writeProductionAudit(req, {
  resource,
  resourceId = null,
  action,
  detail = '',
  changes = null,
  session = null,
}) {
  const doc = {
    actorId: req.user?._id || null,
    actorName: req.user?.name || 'system',
    actorRole: req.user?.productionRole || req.user?.role || '',
    resource,
    resourceId,
    action,
    detail,
    changes,
    ip: req.ip || '',
    userAgent: req.headers?.['user-agent'] || '',
  }
  await AuditLog.create([doc], writeOpts(session))
}

module.exports = { writeProductionAudit }
