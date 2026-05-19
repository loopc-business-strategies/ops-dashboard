require('./_destructive-guard')({
  scriptName: __filename,
  allowDryRunNoApply: !process.argv.includes('--apply'),
})
require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')
const {
  planVendorRegistryMaintenance,
  applyVendorRegistryMaintenance,
} = require('../../services/vendorRegistryMaintenance')

dns.setServers((process.env.DNS_SERVERS || '8.8.8.8,8.8.4.4').split(',').map((s) => s.trim()).filter(Boolean))

const TENANT = 'mg'
const URI = process.env.MONGO_URI_MG

async function main() {
  if (!URI) throw new Error('MONGO_URI_MG is not set')

  const apply = process.argv.includes('--apply')
  await mongoose.connect(URI)
  const db = mongoose.connection.db

  const plan = await planVendorRegistryMaintenance(db, {
    purgeDeleted: true,
    removePlaceholders: true,
  })

  const summary = {
    mode: apply ? 'apply' : 'dry_run',
    tenant: TENANT,
    ...plan,
  }

  console.log(JSON.stringify(summary, null, 2))

  if (plan.blockedRemovals.length) {
    console.error('\nBlocked removals (ledger/transaction activity present):')
    plan.blockedRemovals.forEach((row) => {
      console.error(`  - ${row.name} (${row.vendorCode}) [${row.reason}] tx=${row.transactionCount} ledger=${row.ledgerCount}`)
    })
    process.exitCode = 1
    return
  }

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply --tenant=mg --reason="..." --confirm=$CLEANUP_CONFIRM_TOKEN')
    return
  }

  const result = await applyVendorRegistryMaintenance(db, plan)
  console.log('\nApplied successfully.', result)
}

main()
  .catch((error) => {
    console.error('Migration failed:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
  })
