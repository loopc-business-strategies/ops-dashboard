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

async function fetchBaseCurrency(cookie) {
  const res = await request('/api/erp-accounting/currencies', { cookie })
  const rows = Array.isArray(res.data?.currencies) ? res.data.currencies : []
  return String(rows.find((c) => c.baseCurrency)?.code || 'USD').toUpperCase()
}

const SOM_HINT_RE = /\bsoms?\b|\buzs\b|\bsum\b(?!\w)/i

/**
 * How a voucher is stored:
 *   stored-fc       all rows in one foreign currency (e.g. UZS) — shows exactly as saved
 *   base-only       base currency, rate 1, no foreign-currency account — genuine base voucher
 *   base-with-fc    base currency, rate 1, but touches a foreign-currency account — either a
 *                   voucher saved with a base header, or a legacy soms voucher stored in base
 *   mixed           rows in different currencies
 */
function classifyVoucher(group, base, normalize) {
  const curs = new Set(group.entries.map((e) => normalize(e.currency || base) || base))
  if (curs.size > 1) return 'mixed'
  const [cur] = [...curs]
  if (cur !== base) return 'stored-fc'
  const legFc = group.entries.some((e) => [e.debitAccountId, e.creditAccountId].some((acc) => {
    const code = normalize(acc?.currency || '')
    return code && code !== base
  }))
  return legFc ? 'base-with-fc' : 'base-only'
}

function printCurrencyReport(grouped, base, normalize) {
  const day = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '—')
  const rows = grouped
    .map((g) => {
      const first = g.entries[0] || {}
      const createdAt = g.entries.map((e) => e.createdAt).filter(Boolean).sort()[0]
      const blob = g.entries.map((e) => `${e.description || ''} ${e.notes || ''}`).join(' ')
      return {
        g,
        cls: classifyVoucher(g, base, normalize),
        createdAt,
        currency: normalize(first.currency || base) || base,
        rate: Number(first.exchangeRate ?? 1),
        stored: g.entries.reduce((s, e) => s + Number(e.amount || 0), 0),
        somHint: SOM_HINT_RE.test(blob),
      }
    })
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))

  console.log('\nStored currency per Bank JV (oldest first):')
  console.log('─'.repeat(130))
  for (const r of rows) {
    console.log(
      `${day(r.g.date)}  created ${day(r.createdAt)}  ${String(r.g.voucherNo).padEnd(18)}  `
      + `${r.cls.padEnd(13)}  ${String(r.stored.toFixed(2)).padStart(16)} ${r.currency.padEnd(4)}  `
      + `rate ${String(Number(r.rate.toPrecision(6))).padEnd(12)}  ≈ ${Number(r.g.totalBaseAmount || 0).toFixed(2)} ${base}`
      + `${r.somHint ? '  [narration mentions soms]' : ''}  ${String(r.g.narration || '').slice(0, 40)}`,
    )
  }
  console.log('─'.repeat(130))

  const counts = rows.reduce((m, r) => ({ ...m, [r.cls]: (m[r.cls] || 0) + 1 }), {})
  console.log('\nSummary:')
  for (const cls of ['stored-fc', 'base-only', 'base-with-fc', 'mixed']) {
    console.log(`  ${cls.padEnd(13)} ${counts[cls] || 0}`)
  }
  const review = rows.filter((r) => r.cls === 'base-with-fc' || r.cls === 'mixed')
  if (review.length) {
    console.log(
      `\nREVIEW: ${review.length} voucher(s) stored in ${base} that touch a foreign-currency account `
      + `(created ${day(review[0].createdAt)} → ${day(review[review.length - 1].createdAt)}). `
      + 'These show in the list in ' + base + '; check whether each was meant in soms.',
    )
  }
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

  const { groupJvLedgerEntries, normalizeJvCurrencyCode } = await loadHelpers()
  const baseCurrency = await fetchBaseCurrency(login.cookie)
  const entries = await fetchAllBankJv(login.cookie)
  const grouped = groupJvLedgerEntries(entries, { baseCurrencyCode: baseCurrency })

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

  printCurrencyReport(grouped, baseCurrency, normalizeJvCurrencyCode)

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
