#!/usr/bin/env node
/**
 * Safe Cleanup CLI with guards
 * Usage: node scripts/safe-cleanup-cli.js <tenant> [--operation=NAME] [--dry-run]
 *
 * Examples:
 *   node scripts/safe-cleanup-cli.js mg --operation=exchangeEntries --dry-run
 *   node scripts/safe-cleanup-cli.js mg --operation=exchangeEntries
 */

require('dotenv').config();
const readline = require('readline');
const mongoose = require('mongoose');
const { createSafeCleanup, generateConfirmationToken } = require('../utils/safeCleanupWrapper');

const TENANT_URIS = {
  mg: process.env.MONGO_URI_MG,
  cg: process.env.MONGO_URI_CG,
  loopc: process.env.MONGO_URI_LOOPC,
};

// Define available cleanup operations
const CLEANUP_OPERATIONS = {
  exchangeEntries: () => ({
    collection: 'ledgers',
    query: {
      referenceType: 'journal',
      isDeleted: { $ne: true },
      description: /Exchange (gain|loss) adjustment/i,
    },
    description: 'Exchange gain/loss adjustment entries',
  }),

  cash1000BadEntries: () => {
    // This is a placeholder - would need to be tenant-specific
    return {
      collection: 'ledgers',
      query: {
        referenceType: 'journal',
        isDeleted: { $ne: true },
        amount: { $in: [5954.65, 85.95, 8.26] },
      },
      description: 'Specific bad entries on Cash 1000',
    };
  },

  orphanTestParties: () => ({
    collection: 'customers',
    query: {
      $or: [
        { name: /test|dummy|fake/i },
        { code: /TEST|DUMMY/ },
      ],
      createdAt: { $gte: new Date('2025-01-01') },
    },
    description: 'Orphan test customer/party entries',
  }),
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function main() {
  try {
    const args = process.argv.slice(2);
    let tenant = args[0];
    let operationName = 'exchangeEntries';
    let dryRunOnly = false;

    // Parse arguments
    for (let i = 1; i < args.length; i++) {
      if (args[i].startsWith('--operation=')) {
        operationName = args[i].split('=')[1];
      }
      if (args[i] === '--dry-run') {
        dryRunOnly = true;
      }
    }

    // Validate tenant
    if (!tenant || !TENANT_URIS[tenant]) {
      console.log('\n[!] Valid tenants: mg, cg, loopc\n');
      tenant = await prompt('Select tenant (mg/cg/loopc): ');
    }

    if (!TENANT_URIS[tenant]) {
      console.error(`[✗] Invalid tenant: ${tenant}`);
      process.exit(1);
    }

    const mongoUri = TENANT_URIS[tenant];

    // Validate operation
    if (!CLEANUP_OPERATIONS[operationName]) {
      console.log('\n[!] Available operations:');
      Object.keys(CLEANUP_OPERATIONS).forEach(op => console.log(`  - ${op}`));
      console.log();
      operationName = await prompt('Select operation: ');
    }

    if (!CLEANUP_OPERATIONS[operationName]) {
      console.error(`[✗] Invalid operation: ${operationName}`);
      process.exit(1);
    }

    console.log(`\n[→] Cleanup Configuration:`);
    console.log(`    Tenant: ${tenant}`);
    console.log(`    Operation: ${operationName}`);
    console.log(`    Mode: ${dryRunOnly ? 'DRY-RUN ONLY' : 'PREVIEW + EXECUTE'}`);
    console.log();

    // Connect to MongoDB
    console.log('[🔌] Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    });
    console.log('[✓] Connected\n');

    // Create cleanup operation
    const cleanup = createSafeCleanup({
      tenant,
      mongoUri,
      operation: CLEANUP_OPERATIONS[operationName],
      dryRun: true,
    });

    // Run preview
    console.log('[STEP 1] Previewing records that would be deleted...\n');
    const preview = await cleanup.preview(mongoose);

    if (!preview.success) {
      console.error('[✗] Preview failed');
      await mongoose.disconnect();
      process.exit(1);
    }

    if (preview.count === 0) {
      console.log('[✓] No records to clean up');
      await mongoose.disconnect();
      process.exit(0);
    }

    if (dryRunOnly) {
      console.log('[✓] Dry-run complete. Pass without --dry-run to execute.\n');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Ask for confirmation
    console.log('\n[STEP 2] Requesting confirmation token...\n');
    const token = generateConfirmationToken();
    console.log(`[⚠️  WARNING] This will permanently DELETE ${preview.count} records!`);
    console.log(`[✓] Your confirmation token is: ${token}\n`);

    const userResponse = await prompt(`Type the token to confirm deletion: `);

    if (userResponse !== token) {
      console.log('\n[✗] Token mismatch - deletion cancelled');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Execute deletion
    console.log('\n[STEP 3] Executing deletion...\n');
    const result = await cleanup.execute(mongoose, token);

    if (!result.success) {
      console.error('[✗] Execution failed');
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`[✓] Operation complete! Deleted ${result.deleted} records.\n`);

    // Show audit log
    const auditLog = cleanup.getAuditLog();
    if (auditLog.length > 0) {
      console.log('[📋] Recent audit log entries:');
      auditLog.slice(-5).forEach(entry => {
        console.log(`  - ${entry.timestamp}: ${entry.operation} (${entry.status})`);
      });
      console.log();
    }

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('[✗] Fatal error:', error.message);
    process.exit(1);
  }
}

main();
