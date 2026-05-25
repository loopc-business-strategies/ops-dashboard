/**
 * Verify / inspect MG normal journal vouchers (grouping + duplicate doc nos).
 * Usage: MG_ADMIN_PASSWORD=... node scripts/verify-mg-journal-jv-live.js
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

async function fetchAllJournalJv(cookie) {
  const all = []
  let cursor = null
  for (let page = 0; page < 40; page += 1) {
    const qs = new URLSearchParams({ referenceType: 'journal', limit: '500' })
    if (cursor) qs.set('cursor', cursor)
    const res = await request(`/api/erp-accounting/ledger?${qs}`, { cookie })
    if (res.status !== 200) throw new Error(`Ledger fetch failed (${res.status}): ${res.data?.message || 'unknown'}`)
    const batch = Array.isArray(res.data?.entries) ? res.data.entries : []
    all.push(...batch)
    if (!res.data?.hasMore || !res.data?.nextCursor || !batch.length) break
    cursor = res.data.nextCursor
  }
  return all
}

async function main() {
  const password = process.env.MG_ADMIN_PASSWORD || process.env.SMOKE_AUTH_PASSWORD_MG
  if (!password) throw new Error('Set MG_ADMIN_PASSWORD')

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { name: process.env.MG_ADMIN_NAME || 'Nan', password, company: TENANT },
  })
  if (login.status !== 200 || !login.data?.success) {
    throw new Error(`Login failed (${login.status}): ${login.data?.message || 'no access'}`)
  }

  const { groupJvLedgerEntries } = await loadHelpers()
  const entries = await fetchAllJournalJv(login.cookie)
  const grouped = groupJvLedgerEntries(entries)

  const docNoCounts = new Map()
  for (const g of grouped) {
    docNoCounts.set(g.voucherNo, (docNoCounts.get(g.voucherNo) || 0) + 1)
  }
  const dupDocs = [...docNoCounts.entries()].filter(([, n]) => n > 1)

  console.log('\n=== MG Normal JV live check ===\n')
  console.log(`Ledger lines: ${entries.length}`)
  console.log(`Grouped voucher rows: ${grouped.length}`)
  console.log(`Duplicate doc numbers: ${dupDocs.length}`)

  if (dupDocs.length) {
    console.log(`\nFAIL: ${dupDocs.length} duplicate doc number(s):`)
    for (const [doc, count] of dupDocs) {
      console.log(`  ${doc} x${count}:`)
      grouped.filter((g) => g.voucherNo === doc).forEach((g) => {
        console.log(`    ${new Date(g.date).toISOString().slice(0, 10)}  ${g.lineCount} lines  ref=${g.representative?.referenceId || 'legacy'}`)
      })
    }
    process.exit(1)
  }

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

main().catch((e) => { console.error(e.message); process.exit(1) })
