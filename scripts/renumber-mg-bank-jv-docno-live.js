if (!process.argv.some((arg) => arg.startsWith('--tenant='))) process.argv.push('--tenant=mg')
require('../backend/scripts/destructive/_destructive-guard')({
  scriptName: 'renumber-mg-bank-jv-docno-live.js',
  allowDryRunNoApply: true,
  defaultTenant: 'mg',
})

/**
 * Renumber MG bank_jv vouchers into chronological order (one doc no per voucher).
 *
 * Usage:
 *   MG_ADMIN_PASSWORD=... node scripts/renumber-mg-bank-jv-docno-live.js --tenant=mg
 *   MG_ADMIN_PASSWORD=... node scripts/renumber-mg-bank-jv-docno-live.js --tenant=mg --apply --reason="..." --confirm=...
 */

const API = (process.env.API_BASE || 'https://api.loopcstrategies.com').replace(/\/$/, '')
const TENANT = 'mg'
const APPLY = process.argv.includes('--apply')

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
  const csrfToken = res.headers.get('x-csrf-token') || data?.csrfToken || ''
  return { status: res.status, data, cookie: cookieHeader, csrfToken }
}

async function loadHelpers() {
  return import('../frontend/src/components/tabs/erp/journalVoucherHelpers.js')
}

async function fetchAllBankJv(cookie) {
  const all = []
  let cursor = null
  for (let page = 0; page < 20; page += 1) {
    const qs = new URLSearchParams({ referenceType: 'bank_jv', limit: '500' })
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

function replaceDocNoInDescription(description, newDocNo) {
  const raw = String(description || '')
  const sepIdx = raw.includes(' — ') ? raw.indexOf(' — ') : raw.indexOf(' - ')
  if (sepIdx >= 0) return `${newDocNo}${raw.slice(sepIdx)}`
  return newDocNo
}

function toDocNo(prefix, year, seq) {
  return `${prefix}/${year}/${String(seq).padStart(4, '0')}`
}

async function main() {
  const name = process.env.MG_ADMIN_NAME || 'Nan'
  const password = process.env.MG_ADMIN_PASSWORD || process.env.SMOKE_AUTH_PASSWORD_MG
  if (!password) throw new Error('Set MG_ADMIN_PASSWORD (or SMOKE_AUTH_PASSWORD_MG)')

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { name, password, company: TENANT },
  })
  if (login.status !== 200 || !login.data?.success) {
    throw new Error(`Login failed (${login.status}): ${login.data?.message || 'no access'}`)
  }
  const csrfToken = login.data?.csrfToken || login.csrfToken || ''

  const { groupJvLedgerEntries, extractLedgerJvDocNoFromDescription } = await loadHelpers()
  const entries = await fetchAllBankJv(login.cookie)
  const grouped = groupJvLedgerEntries(entries)

  const byYear = new Map()
  for (const voucher of grouped) {
    const docNo = extractLedgerJvDocNoFromDescription(voucher.representative?.description) || voucher.voucherNo
    const match = String(docNo).match(/^([A-Za-z]+)\/(\d{4})\/(\d+)$/i)
    if (!match) continue
    const prefix = match[1]
    const year = Number(match[2])
    const key = `${prefix}/${year}`
    if (!byYear.has(key)) byYear.set(key, { prefix, year, vouchers: [] })
    byYear.get(key).vouchers.push({ ...voucher, currentDocNo: docNo })
  }

  const plan = []
  for (const { prefix, year, vouchers } of byYear.values()) {
    const sorted = [...vouchers].sort((a, b) => {
      const d = new Date(a.date) - new Date(b.date)
      if (d !== 0) return d
      return new Date(a.representative?.createdAt || a.date) - new Date(b.representative?.createdAt || b.date)
    })
    sorted.forEach((voucher, index) => {
      const targetDocNo = toDocNo(prefix, year, index + 1)
      if (targetDocNo === voucher.currentDocNo) return
      for (const line of voucher.entries) {
        plan.push({
          entryId: line._id,
          voucherKey: voucher.key,
          date: voucher.date,
          fromDocNo: voucher.currentDocNo,
          toDocNo: targetDocNo,
          fromDescription: line.description,
          toDescription: replaceDocNoInDescription(line.description, targetDocNo),
        })
      }
    })
  }

  plan.sort((a, b) => {
    const fromSeq = Number(String(a.fromDocNo).split('/').pop() || 0)
    const toSeq = Number(String(b.toDocNo).split('/').pop() || 0)
    const fromTarget = Number(String(b.toDocNo).split('/').pop() || 0)
    if (toSeq !== fromSeq) return toSeq - fromSeq
    return fromTarget - toSeq
  })

  console.log('\n=== MG Bank JV doc no renumber ===\n')
  console.log(`Vouchers: ${grouped.length} | Lines to update: ${plan.length} | Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)

  const voucherChanges = [...new Set(plan.map((row) => `${row.fromDocNo} -> ${row.toDocNo} (${new Date(row.date).toISOString().slice(0, 10)})`))]
  if (voucherChanges.length) {
    console.log('\nPlanned voucher renumbers:')
    voucherChanges.forEach((line) => console.log(`  ${line}`))
  } else {
    console.log('\nNo renumbering needed — all doc numbers are already in chronological order.')
    return
  }

  if (!APPLY) {
    console.log('\nDry run complete. Re-run with --apply to update ledger descriptions.\n')
    return
  }

  const results = []
  for (const row of plan) {
    const res = await request(`/api/erp-accounting/ledger/${row.entryId}`, {
      method: 'PUT',
      cookie: login.cookie,
      headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
      body: { description: row.toDescription },
    })
    results.push({
      entryId: row.entryId,
      fromDocNo: row.fromDocNo,
      toDocNo: row.toDocNo,
      status: res.status,
      ok: res.status >= 200 && res.status < 300,
      message: res.data?.message || '',
    })
  }

  const failed = results.filter((r) => !r.ok)
  console.log(`\nUpdated ${results.filter((r) => r.ok).length}/${results.length} ledger lines`)
  if (failed.length) {
    console.log('Failures:')
    failed.forEach((r) => console.log(`  ${r.entryId}: ${r.status} ${r.message}`))
    process.exit(1)
  }

  const verifyEntries = await fetchAllBankJv(login.cookie)
  const verifyGrouped = groupJvLedgerEntries(verifyEntries)
  console.log('\nAfter renumber:')
  for (const g of verifyGrouped.sort((a, b) => new Date(b.date) - new Date(a.date))) {
    console.log(`  ${new Date(g.date).toISOString().slice(0, 10)}  ${g.voucherNo}  (${g.lineCount} line(s))`)
  }
  console.log('\nDone.\n')
}

main().catch((err) => {
  console.error(`\n${err.message}\n`)
  process.exit(1)
})
