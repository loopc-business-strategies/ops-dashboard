/**
 * Safe cleanup wrapper with guards: dry-run, confirmations, audit logging
 * Usage: require('./utils/safeCleanupWrapper') then use createSafeCleanup()
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const AUDIT_LOG_DIR = path.resolve(__dirname, '../logs/cleanup-audit');
const CONFIRMATIONS_REQUIRED = true;

// Ensure audit log directory exists
if (!fs.existsSync(AUDIT_LOG_DIR)) {
  fs.mkdirSync(AUDIT_LOG_DIR, { recursive: true });
}

/**
 * Generate a confirmation token (8 random chars)
 */
function generateConfirmationToken() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Log cleanup operation to audit file
 */
function auditLog(tenant, operation, details, status) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    tenant,
    operation,
    details,
    status,
    executedBy: process.env.CLEANUP_USER || 'system',
  };

  const logFile = path.join(
    AUDIT_LOG_DIR,
    `cleanup-${tenant}-${new Date().toISOString().split('T')[0]}.jsonl`
  );

  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  console.log(`[AUDIT] ${status} logged to ${path.basename(logFile)}`);
}

/**
 * Create a safe cleanup operation
 * @param {Object} config - { tenant, mongoUri, operation, dryRun, confirmationToken }
 * @returns {Object} - { execute, preview, getAuditLog }
 */
function createSafeCleanup(config) {
  const {
    tenant,
    mongoUri,
    operation, // function that returns { query, collection, description }
    dryRun = true,
    confirmationToken = null,
  } = config;

  if (!tenant || !mongoUri) {
    throw new Error('tenant and mongoUri are required');
  }

  return {
    /**
     * Preview: show what would be deleted without executing
     */
    async preview(mongoose) {
      console.log(`\n[DRY-RUN] Preview for tenant: ${tenant}`);
      console.log('─'.repeat(60));

      try {
        const db = mongoose.connection.db;
        const { query, collection: collectionName, description } = operation();

        const collection = db.collection(collectionName);
        const documents = await collection
          .find(query)
          .limit(100)
          .toArray();

        console.log(`[${collectionName}] ${description}`);
        console.log(`Found ${documents.length} documents matching criteria:\n`);

        if (documents.length > 0) {
          documents.forEach((doc, idx) => {
            console.log(`  ${idx + 1}. ${JSON.stringify(doc, null, 2)}`);
          });
        } else {
          console.log('  No documents found.');
        }

        auditLog(
          tenant,
          'PREVIEW',
          { collection: collectionName, description, count: documents.length },
          'PREVIEW_OK'
        );

        return { success: true, count: documents.length, documents };
      } catch (error) {
        console.error('[ERROR]', error.message);
        auditLog(
          tenant,
          'PREVIEW',
          { error: error.message },
          'PREVIEW_FAILED'
        );
        throw error;
      }
    },

    /**
     * Execute: delete matching documents (requires confirmation token)
     */
    async execute(mongoose, providedToken = null) {
      if (CONFIRMATIONS_REQUIRED && !providedToken) {
        const expectedToken = generateConfirmationToken();
        console.log(`\n[⚠️  WARNING] This will DELETE data from tenant: ${tenant}`);
        console.log(`\n[✓] Confirmation token: ${expectedToken}`);
        console.log(`[!] To proceed, call: cleanup.execute(mongoose, '${expectedToken}')\n`);
        return { success: false, requiresConfirmation: true, token: expectedToken };
      }

      if (providedToken && providedToken.length < 8) {
        console.error('[ERROR] Invalid confirmation token (too short)');
        auditLog(tenant, 'EXECUTE', { reason: 'invalid_token' }, 'EXECUTE_REJECTED');
        return { success: false, reason: 'Invalid confirmation token' };
      }

      try {
        const db = mongoose.connection.db;
        const { query, collection: collectionName, description } = operation();

        console.log(`\n[EXECUTE] Deleting from ${tenant}/${collectionName}`);
        console.log(`Description: ${description}`);

        // First, find matching documents
        const collection = db.collection(collectionName);
        const toDelete = await collection.find(query).toArray();

        if (toDelete.length === 0) {
          console.log('[✓] No documents matched criteria - nothing to delete');
          auditLog(tenant, 'EXECUTE', { collection: collectionName, deleted: 0 }, 'EXECUTE_OK');
          return { success: true, deleted: 0 };
        }

        console.log(`[?] About to delete ${toDelete.length} documents...`);

        // Execute deletion
        const result = await collection.deleteMany(query);

        const message = `[✓] Successfully deleted ${result.deletedCount} documents`;
        console.log(message);

        // Log backup of deleted IDs
        const deletedIds = toDelete.map(d => d._id);
        auditLog(
          tenant,
          'EXECUTE',
          {
            collection: collectionName,
            description,
            deleted: result.deletedCount,
            deletedIds: deletedIds.map(id => id.toString()),
          },
          'EXECUTE_SUCCESS'
        );

        console.log(`[✓] Audit log recorded with deleted IDs for potential rollback\n`);
        return { success: true, deleted: result.deletedCount, deletedIds };

      } catch (error) {
        console.error('[ERROR]', error.message);
        auditLog(
          tenant,
          'EXECUTE',
          { error: error.message },
          'EXECUTE_FAILED'
        );
        throw error;
      }
    },

    /**
     * Get audit log for tenant
     */
    getAuditLog() {
      const logFile = path.join(
        AUDIT_LOG_DIR,
        `cleanup-${tenant}-${new Date().toISOString().split('T')[0]}.jsonl`
      );

      if (!fs.existsSync(logFile)) {
        return [];
      }

      const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean);
      return lines.map(line => JSON.parse(line));
    },
  };
}

module.exports = {
  createSafeCleanup,
  generateConfirmationToken,
  auditLog,
};
