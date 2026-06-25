/**
 * Reclassify legacy system FX adjustment ledger rows from referenceType journal → expense.
 * These rows lack Jv/YYYY/#### doc numbers and should not appear in the Normal JV list.
 *
 * Usage:
 *   node scripts/migrate-fx-adjustment-journal-to-expense.mjs --tenant cg
 *   node scripts/migrate-fx-adjustment-journal-to-expense.mjs --tenant all --apply
 */
import {
  apiRequest,
  fetchAllJournalJv,
  filterManualJournalJvEntries,
  isSystemFxAdjustmentLedgerEntry,
  loginTenant,
  parseTenantArg,
  parseTenantList,
  TENANTS,
} from './jv-live-api-common.mjs'

const APPLY = process.argv.includes('--apply')

async function migrateTenant(tenant) {
  const session = await loginTenant(tenant)
  const journalEntries = await fetchAllJournalJv(tenant, session)
  const fxRows = journalEntries.filter((entry) => (
    !entry.isDeleted && isSystemFxAdjustmentLedgerEntry(entry)
  ))

  console.log(`\n=== ${tenant.toUpperCase()} FX journal → expense migration ===`)
  console.log(`Journal ledger lines: ${journalEntries.length}`)
  console.log(`System FX adjustment rows to reclassify: ${fxRows.length}`)

  if (!fxRows.length) {
    console.log('Nothing to migrate.')
    return { tenant, migrated: 0, failed: 0 }
  }

  for (const row of fxRows) {
    const date = row.date ? new Date(row.date).toISOString().slice(0, 10) : '—'
    console.log(`  ${row._id}  ${date}  ${row.amount}  ${row.description}`)
  }

  if (!APPLY) {
    console.log('Dry run — pass --apply to PATCH referenceType to expense')
    return { tenant, migrated: 0, failed: 0, pending: fxRows.length }
  }

  let migrated = 0
  let failed = 0
  for (const row of fxRows) {
    const res = await apiRequest(tenant, `/api/erp-accounting/ledger/${row._id}`, {
      method: 'PUT',
      session,
      body: { referenceType: 'expense' },
    })
    if (res.status === 200 && res.data?.success) {
      migrated += 1
    } else {
      failed += 1
      console.error(`  FAIL ${row._id}: ${res.status} ${res.data?.message || 'unknown'}`)
    }
  }

  const after = await fetchAllJournalJv(tenant, session)
  const manual = await filterManualJournalJvEntries(after)
  const remainingFx = after.filter((entry) => !entry.isDeleted && isSystemFxAdjustmentLedgerEntry(entry))
  console.log(`Migrated: ${migrated}, failed: ${failed}`)
  console.log(`Remaining journal lines: ${after.length} (manual JV lines: ${manual.length}, FX still journal: ${remainingFx.length})`)

  return { tenant, migrated, failed, remainingFx: remainingFx.length }
}

async function main() {
  const tenantArg = parseTenantArg(process.argv, 'cg')
  const tenants = tenantArg === 'all' ? [...TENANTS] : parseTenantList(tenantArg)
  const results = []
  for (const tenant of tenants) {
    results.push(await migrateTenant(tenant))
  }

  const totalPending = results.reduce((sum, r) => sum + (r.pending || 0), 0)
  const totalMigrated = results.reduce((sum, r) => sum + (r.migrated || 0), 0)
  const totalFailed = results.reduce((sum, r) => sum + (r.failed || 0), 0)
  const totalRemainingFx = results.reduce((sum, r) => sum + (r.remainingFx || 0), 0)

  console.log('\n=== Summary ===')
  if (!APPLY) {
    console.log(`Pending FX rows (dry run): ${totalPending}`)
    process.exit(totalPending > 0 ? 0 : 0)
  }
  console.log(`Migrated: ${totalMigrated}, failed: ${totalFailed}, FX still journal: ${totalRemainingFx}`)
  process.exit(totalFailed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
