/**
 * Safe cleanup wrapper with guards: dry-run preview, exact confirmation token,
 * explicit apply mode, production guard, reason capture, and audit logging.
 */

const fs = require('fs')
const path = require('path')

const AUDIT_LOG_DIR = path.resolve(__dirname, '../logs/cleanup-audit')
const VALID_TENANTS = new Set(['mg', 'cg', 'loopc'])

if (!fs.existsSync(AUDIT_LOG_DIR)) {
  fs.mkdirSync(AUDIT_LOG_DIR, { recursive: true })
}

function readArgValue(name) {
  const exactPrefix = `${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(exactPrefix))
  if (inline) return inline.slice(exactPrefix.length)

  const idx = process.argv.indexOf(name)
  if (idx >= 0) return process.argv[idx + 1] || ''
  return ''
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function envBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue
  return String(value).trim().toLowerCase() === 'true'
}

function isProductionLike() {
  const envName = String(
    process.env.NODE_ENV ||
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.VERCEL_ENV ||
    ''
  ).trim().toLowerCase()

  return envName === 'production' || hasFlag('--production')
}

function resolveExpectedToken(configToken) {
  return String(
    configToken ||
    process.env.CLEANUP_CONFIRM_TOKEN ||
    process.env.DESTRUCTIVE_ADMIN_CONFIRM_TOKEN ||
    ''
  ).trim()
}

function resolveReason(configReason) {
  return String(
    configReason ||
    readArgValue('--reason') ||
    readArgValue('--comment') ||
    process.env.CLEANUP_REASON ||
    ''
  ).trim()
}

function auditLog(tenant, operation, details, status) {
  const timestamp = new Date().toISOString()
  const logEntry = {
    timestamp,
    tenant,
    operation,
    details,
    status,
    executedBy: process.env.CLEANUP_USER || 'system',
  }

  const logFile = path.join(
    AUDIT_LOG_DIR,
    `cleanup-${tenant}-${new Date().toISOString().split('T')[0]}.jsonl`
  )

  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n')
  console.log(`[AUDIT] ${status} logged to ${path.basename(logFile)}`)
}

function validateExecutionRequest({ tenant, apply, confirmationToken, providedToken, reason }) {
  if (!apply && !hasFlag('--apply')) {
    return { ok: false, reason: 'Missing --apply flag.' }
  }

  const expectedToken = resolveExpectedToken(confirmationToken)
  if (!expectedToken) {
    return { ok: false, reason: 'CLEANUP_CONFIRM_TOKEN or DESTRUCTIVE_ADMIN_CONFIRM_TOKEN is required.' }
  }

  if (String(providedToken || '').trim() !== expectedToken) {
    return { ok: false, reason: 'Invalid confirmation token' }
  }

  const cleanupReason = resolveReason(reason)
  if (cleanupReason.length < 8) {
    return { ok: false, reason: 'A cleanup reason/comment of at least 8 characters is required.' }
  }

  if (
    isProductionLike() &&
    !envBool(process.env.ALLOW_PRODUCTION_DESTRUCTIVE_SCRIPT) &&
    !envBool(process.env.ALLOW_PRODUCTION_CLEANUP)
  ) {
    return {
      ok: false,
      reason: 'Production cleanup is blocked unless ALLOW_PRODUCTION_DESTRUCTIVE_SCRIPT=true or ALLOW_PRODUCTION_CLEANUP=true.',
    }
  }

  return { ok: true, cleanupReason, tenant }
}

function createSafeCleanup(config) {
  const {
    tenant,
    mongoUri,
    operation,
    confirmationToken = null,
    apply = false,
    reason = '',
  } = config

  const normalizedTenant = String(tenant || '').trim().toLowerCase()
  if (!normalizedTenant || !mongoUri) {
    throw new Error('tenant and mongoUri are required')
  }
  if (!VALID_TENANTS.has(normalizedTenant)) {
    throw new Error('tenant must be one of: mg, cg, loopc')
  }
  if (typeof operation !== 'function') {
    throw new Error('operation function is required')
  }

  return {
    async preview(mongoose) {
      console.log(`\n[DRY-RUN] Preview for tenant: ${normalizedTenant}`)
      console.log('-'.repeat(60))

      try {
        const db = mongoose.connection.db
        const { query, collection: collectionName, description } = operation()

        const collection = db.collection(collectionName)
        const documents = await collection
          .find(query)
          .limit(100)
          .toArray()

        console.log(`[${collectionName}] ${description}`)
        console.log(`Found ${documents.length} documents matching criteria:\n`)

        if (documents.length > 0) {
          documents.forEach((doc, idx) => {
            console.log(`  ${idx + 1}. ${JSON.stringify(doc, null, 2)}`)
          })
        } else {
          console.log('  No documents found.')
        }

        auditLog(
          normalizedTenant,
          'PREVIEW',
          { collection: collectionName, description, count: documents.length },
          'PREVIEW_OK'
        )

        return { success: true, count: documents.length, documents }
      } catch (error) {
        console.error('[ERROR]', error.message)
        auditLog(normalizedTenant, 'PREVIEW', { error: error.message }, 'PREVIEW_FAILED')
        throw error
      }
    },

    async execute(mongoose, providedToken = null) {
      const validation = validateExecutionRequest({
        tenant: normalizedTenant,
        apply,
        confirmationToken,
        providedToken,
        reason,
      })

      if (!validation.ok) {
        console.error(`[ERROR] ${validation.reason}`)
        auditLog(normalizedTenant, 'EXECUTE', { reason: validation.reason }, 'EXECUTE_REJECTED')
        return { success: false, reason: validation.reason }
      }

      try {
        const db = mongoose.connection.db
        const { query, collection: collectionName, description } = operation()

        console.log(`\n[EXECUTE] Deleting from ${normalizedTenant}/${collectionName}`)
        console.log(`Description: ${description}`)
        console.log(`Reason: ${validation.cleanupReason}`)

        const collection = db.collection(collectionName)
        const toDelete = await collection.find(query).toArray()

        if (toDelete.length === 0) {
          console.log('[OK] No documents matched criteria - nothing to delete')
          auditLog(normalizedTenant, 'EXECUTE', {
            collection: collectionName,
            reason: validation.cleanupReason,
            deleted: 0,
          }, 'EXECUTE_OK')
          return { success: true, deleted: 0 }
        }

        console.log(`[WARNING] About to delete ${toDelete.length} documents...`)
        const result = await collection.deleteMany(query)

        const deletedIds = toDelete.map((doc) => doc._id)
        auditLog(
          normalizedTenant,
          'EXECUTE',
          {
            collection: collectionName,
            description,
            reason: validation.cleanupReason,
            deleted: result.deletedCount,
            deletedIds: deletedIds.map((id) => id.toString()),
          },
          'EXECUTE_SUCCESS'
        )

        console.log(`[OK] Successfully deleted ${result.deletedCount} documents`)
        return { success: true, deleted: result.deletedCount, deletedIds }
      } catch (error) {
        console.error('[ERROR]', error.message)
        auditLog(normalizedTenant, 'EXECUTE', { error: error.message }, 'EXECUTE_FAILED')
        throw error
      }
    },

    getAuditLog() {
      const logFile = path.join(
        AUDIT_LOG_DIR,
        `cleanup-${normalizedTenant}-${new Date().toISOString().split('T')[0]}.jsonl`
      )

      if (!fs.existsSync(logFile)) {
        return []
      }

      const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean)
      return lines.map((line) => JSON.parse(line))
    },
  }
}

module.exports = {
  createSafeCleanup,
  auditLog,
  validateExecutionRequest,
}
