#!/usr/bin/env node
/**
 * Safe Cleanup CLI with guards.
 *
 * Dry-run preview:
 *   node scripts/safe-cleanup-cli.js mg --operation=exchangeEntries --dry-run
 *
 * Apply mode:
 *   CLEANUP_CONFIRM_TOKEN=... node scripts/safe-cleanup-cli.js mg --operation=exchangeEntries --apply --reason="approved cleanup"
 */

require('dotenv').config()
const readline = require('readline')
const mongoose = require('mongoose')
const { createSafeCleanup } = require('../utils/safeCleanupWrapper')

const TENANT_URIS = {
  mg: process.env.MONGO_URI_MG,
  cg: process.env.MONGO_URI_CG,
  loopc: process.env.MONGO_URI_LOOPC,
}

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

  cash1000BadEntries: () => ({
    collection: 'ledgers',
    query: {
      referenceType: 'journal',
      isDeleted: { $ne: true },
      amount: { $in: [5954.65, 85.95, 8.26] },
    },
    description: 'Specific bad entries on Cash 1000',
  }),

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
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve)
  })
}

function readArgValue(args, name) {
  const exactPrefix = `${name}=`
  const inline = args.find((arg) => arg.startsWith(exactPrefix))
  if (inline) return inline.slice(exactPrefix.length)

  const idx = args.indexOf(name)
  if (idx >= 0) return args[idx + 1] || ''
  return ''
}

async function main() {
  try {
    const args = process.argv.slice(2)
    let tenant = args[0]
    let operationName = readArgValue(args, '--operation') || 'exchangeEntries'
    const dryRunOnly = args.includes('--dry-run')
    const apply = args.includes('--apply')
    let reason = readArgValue(args, '--reason') || readArgValue(args, '--comment')
    let token = readArgValue(args, '--token')

    if (!tenant || !TENANT_URIS[tenant]) {
      console.log('\n[!] Valid tenants: mg, cg, loopc\n')
      tenant = await prompt('Select tenant (mg/cg/loopc): ')
    }

    if (!TENANT_URIS[tenant]) {
      console.error(`[ERROR] Invalid tenant: ${tenant}`)
      process.exit(1)
    }

    const mongoUri = TENANT_URIS[tenant]

    if (!CLEANUP_OPERATIONS[operationName]) {
      console.log('\n[!] Available operations:')
      Object.keys(CLEANUP_OPERATIONS).forEach((op) => console.log(`  - ${op}`))
      console.log()
      operationName = await prompt('Select operation: ')
    }

    if (!CLEANUP_OPERATIONS[operationName]) {
      console.error(`[ERROR] Invalid operation: ${operationName}`)
      process.exit(1)
    }

    console.log('\n[CONFIG] Cleanup Configuration:')
    console.log(`    Tenant: ${tenant}`)
    console.log(`    Operation: ${operationName}`)
    console.log(`    Mode: ${dryRunOnly || !apply ? 'DRY-RUN ONLY' : 'PREVIEW + EXECUTE'}`)
    console.log()

    console.log('[CONNECT] Connecting to MongoDB...')
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    })
    console.log('[OK] Connected\n')

    const cleanup = createSafeCleanup({
      tenant,
      mongoUri,
      operation: CLEANUP_OPERATIONS[operationName],
      apply,
      reason,
    })

    console.log('[STEP 1] Previewing records that would be deleted...\n')
    const preview = await cleanup.preview(mongoose)

    if (!preview.success) {
      console.error('[ERROR] Preview failed')
      await mongoose.disconnect()
      process.exit(1)
    }

    if (preview.count === 0) {
      console.log('[OK] No records to clean up')
      await mongoose.disconnect()
      process.exit(0)
    }

    if (dryRunOnly || !apply) {
      console.log('[OK] Dry-run complete. Pass --apply with --reason and a confirmation token to execute.\n')
      await mongoose.disconnect()
      process.exit(0)
    }

    if (!reason || reason.trim().length < 8) {
      reason = await prompt('Reason/comment for this cleanup (min 8 chars): ')
    }
    process.env.CLEANUP_REASON = reason

    if (!token) {
      console.log('\n[STEP 2] Confirmation token required')
      console.log('[WARNING] This will DELETE data. Enter the private CLEANUP_CONFIRM_TOKEN value; it is never printed by this tool.\n')
      token = await prompt('Confirmation token: ')
    }

    console.log('\n[STEP 3] Executing deletion...\n')
    const result = await cleanup.execute(mongoose, token)

    if (!result.success) {
      console.error(`[ERROR] Execution blocked: ${result.reason || 'unknown reason'}`)
      await mongoose.disconnect()
      process.exit(1)
    }

    console.log(`[OK] Operation complete. Deleted ${result.deleted} records.\n`)

    const auditLog = cleanup.getAuditLog()
    if (auditLog.length > 0) {
      console.log('[AUDIT] Recent audit log entries:')
      auditLog.slice(-5).forEach((entry) => {
        console.log(`  - ${entry.timestamp}: ${entry.operation} (${entry.status})`)
      })
      console.log()
    }

    await mongoose.disconnect()
    process.exit(0)
  } catch (error) {
    console.error('[ERROR] Fatal error:', error.message)
    process.exit(1)
  } finally {
    rl.close()
  }
}

main()
