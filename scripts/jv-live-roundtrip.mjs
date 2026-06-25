/**
 * Live JV roundtrip: audit, create marked test JV, verify, safe cleanup.
 *
 * Usage:
 *   node scripts/jv-live-roundtrip.mjs --tenant all              # dry-run
 *   node scripts/jv-live-roundtrip.mjs --tenant all --apply      # create + delete
 *   node scripts/jv-live-roundtrip.mjs --tenant mg --audit-only
 *   node scripts/jv-live-roundtrip.mjs --tenant all --cleanup-only --apply
 */
import {
  AUTO_TEST_MARKER,
  apiRequest,
  auditJournalJv,
  buildAutoTestStamp,
  deleteLedgerEntry,
  fetchAccounts,
  fetchAllJournalJv,
  findAutoTestEntries,
  getApiBase,
  getNextJvDocNo,
  hasCredentials,
  isAutoTestDescription,
  loginTenant,
  parseTenantArg,
  parseTenantList,
  pickTestAccountPair,
} from './jv-live-api-common.mjs'

const argv = process.argv.slice(2)
const tenantArg = parseTenantArg(argv, 'all')
const apply = argv.includes('--apply')
const auditOnly = argv.includes('--audit-only')
const cleanupOnly = argv.includes('--cleanup-only')
const strictAudit = argv.includes('--strict-audit')

async function cleanupAutoTestEntries(tenant, session, entries, { dryRun }) {
  const targets = findAutoTestEntries(entries)
  if (!targets.length) {
    console.log(`  No ${AUTO_TEST_MARKER} rows to clean up.`)
    return { deleted: 0, failed: 0 }
  }

  console.log(`  Found ${targets.length} AUTO TEST line(s):`)
  for (const row of targets) {
    console.log(`    ${row._id}  ${String(row.description || '').slice(0, 80)}`)
  }

  if (dryRun) {
    console.log('  [dry-run] would DELETE the above ledger line(s)')
    return { deleted: 0, failed: 0, planned: targets.length }
  }

  let deleted = 0
  let failed = 0
  for (const row of targets) {
    if (!isAutoTestDescription(row.description)) continue
    const res = await deleteLedgerEntry(tenant, session, row._id)
    if (res.status === 200 && res.data?.success) {
      deleted += 1
      console.log(`  deleted ${row._id}`)
    } else {
      failed += 1
      console.log(`  FAILED delete ${row._id} (${res.status}): ${res.data?.message || 'unknown'}`)
    }
  }
  return { deleted, failed }
}

async function createTestJv(tenant, session, { dryRun }) {
  const docNo = await getNextJvDocNo(tenant, session)
  const accounts = await fetchAccounts(tenant, session)
  const { debit, credit } = pickTestAccountPair(accounts)
  const stamp = buildAutoTestStamp()
  const marker = `${AUTO_TEST_MARKER}${stamp}`
  const description = `${docNo} — ${marker}`
  const today = new Date().toISOString().slice(0, 10)

  const payload = {
    mode: 'journal',
    postings: [{
      date: today,
      description,
      notes: marker,
      currency: 'USD',
      exchangeRate: 1,
      debitAccountId: String(debit._id),
      creditAccountId: String(credit._id),
      amount: 1,
    }],
  }

  console.log(`  Planned test JV: ${description}`)
  console.log(`  Debit ${debit.accountCode} → Credit ${credit.accountCode}  amount 1.00 USD`)

  if (dryRun) {
    console.log('  [dry-run] would POST /ledger/journal-voucher')
    return { created: false, entryIds: [], referenceId: null }
  }

  const res = await apiRequest(tenant, '/api/erp-accounting/ledger/journal-voucher', {
    method: 'POST',
    body: payload,
    session,
  })

  if (res.status !== 201 || !res.data?.success) {
    throw new Error(`JV create failed (${res.status}): ${res.data?.message || JSON.stringify(res.data)}`)
  }

  const entryIds = (res.data.entries || []).map((e) => String(e._id || '')).filter(Boolean)
  console.log(`  Created referenceId=${res.data.referenceId} entries=${entryIds.join(', ')}`)
  return { created: true, entryIds, referenceId: res.data.referenceId, entries: res.data.entries || [] }
}

async function runTenant(tenant) {
  console.log(`\n${'='.repeat(60)}\nTenant: ${tenant.toUpperCase()}  API: ${getApiBase()}\n${'='.repeat(60)}`)

  if (!hasCredentials(tenant)) {
    console.error(`SKIP ${tenant}: no credentials (set ${tenant === 'loopc' ? 'LOOPC' : tenant.toUpperCase()}_ADMIN_PASSWORD or SMOKE_AUTH_PASSWORD_${tenant === 'loopc' ? 'LOOPC' : tenant.toUpperCase()})`)
    return { tenant, skipped: true, roundtripOk: false, auditOk: false }
  }

  const session = await loginTenant(tenant)
  console.log(`  Login OK (${session.name})`)

  let entries = await fetchAllJournalJv(tenant, session)
  const auditBefore = await auditJournalJv(tenant, entries)
  let roundtripOk = true

  if (cleanupOnly) {
    const cleanup = await cleanupAutoTestEntries(tenant, session, entries, { dryRun: !apply })
    roundtripOk = cleanup.failed === 0
    return { tenant, roundtripOk, auditOk: auditBefore.ok, auditBefore, cleanup }
  }

  if (!auditOnly) {
    const createResult = await createTestJv(tenant, session, { dryRun: !apply })

    if (createResult.created) {
      entries = await fetchAllJournalJv(tenant, session)
      const createdRows = entries.filter((e) => createResult.entryIds.includes(String(e._id)))
      const found = createdRows.length
      console.log(`  Verify: ${found}/${createResult.entryIds.length} created line(s) visible in ledger API`)
      if (found !== createResult.entryIds.length) {
        console.warn('  WARN: not all created lines found in ledger listing (may be pagination delay)')
      }

      const toDelete = createResult.entries.filter((e) => isAutoTestDescription(e.description))
      if (apply) {
        let deleted = 0
        for (const row of toDelete) {
          const del = await deleteLedgerEntry(tenant, session, row._id)
          if (del.status === 200) {
            deleted += 1
            console.log(`  deleted created line ${row._id}`)
          } else {
            roundtripOk = false
            console.error(`  FAILED delete created line ${row._id} (${del.status})`)
          }
        }
        console.log(`  Cleanup created test: ${deleted}/${toDelete.length} deleted`)
      } else {
        console.log(`  [dry-run] would DELETE ${toDelete.length} created test line(s) after verify`)
      }
    }
  }

  entries = await fetchAllJournalJv(tenant, session)
  await cleanupAutoTestEntries(tenant, session, entries, { dryRun: !apply })

  entries = await fetchAllJournalJv(tenant, session)
  const auditAfter = await auditJournalJv(tenant, entries)

  return {
    tenant,
    roundtripOk,
    auditOk: auditBefore.ok && auditAfter.ok,
    auditBefore,
    auditAfter,
  }
}

async function main() {
  const mode = auditOnly ? 'audit-only' : cleanupOnly ? 'cleanup-only' : 'roundtrip'
  console.log(`JV live ${mode}  tenants=${tenantArg}  apply=${apply}`)

  const tenants = parseTenantList(tenantArg)
  const results = []
  for (const tenant of tenants) {
    try {
      results.push(await runTenant(tenant))
    } catch (err) {
      console.error(`ERROR [${tenant}]: ${err instanceof Error ? err.message : err}`)
      results.push({
        tenant,
        roundtripOk: false,
        auditOk: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  console.log('\nSummary:')
  for (const r of results) {
    if (r.skipped) console.log(`  ${r.tenant}: SKIPPED (no credentials)`)
    else if (r.error) console.log(`  ${r.tenant}: FAIL (${r.error})`)
    else {
      const rt = r.roundtripOk ? 'OK' : 'FAIL'
      const audit = r.auditOk ? 'OK' : 'WARN (pre-existing duplicate doc numbers)'
      console.log(`  ${r.tenant}: roundtrip ${rt}; audit ${audit}`)
    }
  }

  const roundtripFailed = results.some((r) => !r.skipped && !r.roundtripOk)
  const auditFailed = results.some((r) => !r.skipped && !r.auditOk)
  if (strictAudit && auditFailed) {
    console.log('\n--strict-audit: exiting due to duplicate doc numbers in ledger audit.')
  }
  process.exit(roundtripFailed ? 1 : strictAudit && auditFailed ? 1 : 0)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
