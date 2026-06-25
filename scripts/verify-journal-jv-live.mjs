/**
 * Verify normal journal vouchers on production (grouping + duplicate doc nos).
 * Usage: TENANT=mg MG_ADMIN_PASSWORD=... node scripts/verify-journal-jv-live.mjs
 */
import {
  auditJournalJv,
  fetchAllJournalJv,
  loginTenant,
  parseTenantArg,
  TENANTS,
} from './jv-live-api-common.mjs'

const tenant = process.env.TENANT || parseTenantArg(process.argv, 'mg')
if (!TENANTS.includes(tenant)) {
  throw new Error(`Invalid TENANT ${tenant}`)
}

async function main() {
  const session = await loginTenant(tenant)
  const entries = await fetchAllJournalJv(tenant, session)
  const { grouped, dupDocs } = await auditJournalJv(tenant, entries)

  if (dupDocs.length) process.exit(1)

  console.log('\nAll vouchers (by date desc):')
  console.log('─'.repeat(110))
  for (const g of grouped.sort((a, b) => new Date(b.date) - new Date(a.date))) {
    console.log(
      `${new Date(g.date).toISOString().slice(0, 10)}  ${String(g.voucherNo).padEnd(16)}  ${String(g.lineCount).padStart(2)} lines  `
      + `Dr ${String(g.debitAccounts).padEnd(20)}  Cr ${String(g.creditAccounts).padEnd(16)}  `
      + `${Number(g.totalBaseAmount || 0).toFixed(2)} USD`,
    )
  }
  console.log('─'.repeat(110))
  console.log('')
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
