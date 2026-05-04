const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

// ==========================================
// AuditLog — immutable record of who did what and when.
// Written via the auditLog() helper (see middleware/audit.js).
// Never update or delete audit records.
// ==========================================
const auditLogSchema = new mongoose.Schema(
  {
    // Who performed the action
    actorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, trim: true, default: 'system' },
    actorRole: { type: String, trim: true, default: '' },

    // What resource was affected
    resource:   { type: String, required: true, trim: true }, // e.g. 'Transaction', 'Vendor'
    resourceId: { type: mongoose.Schema.Types.ObjectId, default: null },

    // What happened
    action: { type: String, required: true, trim: true }, // e.g. 'create', 'update', 'delete', 'status_change'
    detail: { type: String, trim: true, default: '' },    // human-readable summary

    // Optional: what changed (old vs new)
    changes: { type: mongoose.Schema.Types.Mixed, default: null },

    // Request context
    ip:        { type: String, trim: true, default: '' },
    userAgent: { type: String, trim: true, default: '' },
  },
  {
    timestamps: true,
  }
)

auditLogSchema.index({ resource: 1, resourceId: 1, createdAt: -1 })
auditLogSchema.index({ actorId: 1, createdAt: -1 })
auditLogSchema.index({ action: 1, createdAt: -1 })

module.exports = createTenantModel('AuditLog', auditLogSchema)
