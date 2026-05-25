/**
 * Verify MG bank_jv grouping against live API (read-only).
 * Usage: node scripts/verify-mg-bank-jv-live.js
 */
const API = (process.env.API_BASE || 'https://api.loopcstrategies.com').replace(/\/$/, '')
const TENANT = 'mg'

async function request(path, { method = 'GET', body, cookie, headers = {} } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-tenant': TENANT,
      'x-company': TENANT,
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
  const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  const cookieHeader = setCookie.map((row) => String(row).split(';')[0]).filter(Boolean).join('; ')
  return { status: res.status, data, cookie: cookieHeader }
}

async function loadHelpers() {
  return import('../frontend/src/components/tabs/erp/journalVoucherHelpers.js')
}

async function fetchAllBankJv(cookie) {
  const all = []
  let cursor = null
  let page = 0
  for (;;) {
    page += 1
    const qs = new URLSearchParams({ referenceType: 'bank_jv', limit: '500' })
    if (cursor) qs.set('cursor', cursor)
    const res = await request(`/api/erp-accounting/ledger?${qs}`, { cookie })
    if (res.status !== 200) throw new Error(`Ledger fetch failed (${res.status}): ${res.data?.message || 'unknown'}`)
    const batch = Array.isArray(res.data?.entries) ? res.data.entries : []
    all.push(...batch)
    if (!res.data?.hasMore || !res.data?.nextCursor || batch.length === 0 || page > 20) break
    cursor = res.data.nextCursor
  }
  return all
}

async function main() {
  const name = process.env.MG_ADMIN_NAME || 'Nan'
  const password = process.env.MG_ADMIN_PASSWORD || process.env.SMOKE_AUTH_PASSWORD_MG
  if (!password) throw new Error('Set MG_ADMIN_PASSWORD (or SMOKE_AUTH_PASSWORD_MG) to run live MG verification')

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { name, password, company: TENANT },
  })
  if (login.status !== 200 || !login.data?.success) {
    throw new Error(`Login failed (${login.status}): ${login.data?.message || 'no access'}`)
  }

  const { groupJvLedgerEntries, extractLedgerJvDocNoFromDescription } = await loadHelpers()
  const entries = await fetchAllBankJv(login.cookie)
  const grouped = groupJvLedgerEntries(entries)

  const docNoCounts = new Map()
  for (const g of grouped) {
    docNoCounts.set(g.voucherNo, (docNoCounts.get(g.voucherNo) || 0) + 1)
  }

  console.log('\n=== MG Bank JV live check ===\n')
  console.log(`API: ${API}`)
  console.log(`Ledger lines (bank_jv): ${entries.length}`)
  console.log(`Grouped voucher rows (UI): ${grouped.length}`)
  console.log(`Reduction: ${entries.length - grouped.length} duplicate list rows removed`)

  const dupDocs = [...docNoCounts.entries()].filter(([, n]) => n > 1)
  if (dupDocs.length) {
    console.log(`\nFAIL: ${dupDocs.length} duplicate doc number(s):`)
    dupDocs.forEach(([doc, n]) => console.log(`  ${doc}: ${n} voucher row(s)`))
    process.exit(1)
  }

  console.log('\nAll Bank JV vouchers:')
  console.log('─'.repeat(105))
  for (const g of grouped.sort((a, b) => new Date(b.date) - new Date(a.date))) {
    const date = g.date ? new Date(g.date).toISOString().slice(0, 10) : '—'
    console.log(
      `${date}  ${String(g.voucherNo).padEnd(18)}  ${String(g.lineCount).padStart(2)} line(s)  `
      + `Dr ${String(g.debitAccounts).padEnd(18)}  Cr ${String(g.creditAccounts).padEnd(12)}  `
      + `≈ ${Number(g.totalBaseAmount || 0).toFixed(2)} USD`,
    )
  }
  console.log('─'.repeat(105))

  const ungrouped = entries.length !== grouped.reduce((n, g) => n + g.lineCount, 0)
  if (ungrouped) {
    console.error('\nFAIL: some lines did not map into voucher groups')
    process.exit(1)
  }

  console.log('\nPASS: every bank_jv line belongs to exactly one grouped voucher row.\n')
}

main().catch((err) => {
  console.error(`\n${err.message}\n`)
  process.exit(1)
})
