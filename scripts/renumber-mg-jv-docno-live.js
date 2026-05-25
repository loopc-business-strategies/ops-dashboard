/**
 * Renumber MG journal / bank_jv vouchers into chronological order (unique doc no each).
 *
 * Usage:
 *   MG_ADMIN_PASSWORD=... node scripts/renumber-mg-jv-docno-live.js --journal
 *   MG_ADMIN_PASSWORD=... node scripts/renumber-mg-jv-docno-live.js --bank-jv
 *   MG_ADMIN_PASSWORD=... node scripts/renumber-mg-jv-docno-live.js --journal --apply
 */
const API = (process.env.API_BASE || 'https://api.loopcstrategies.com').replace(/\/$/, '')
const TENANT = 'mg'
const APPLY = process.argv.includes('--apply')
const MODES = [
  ...(process.argv.includes('--journal') || (!process.argv.includes('--bank-jv') && !process.argv.includes('--journal')) ? ['journal'] : []),
  ...(process.argv.includes('--bank-jv') ? ['bank_jv'] : []),
]
if (process.argv.includes('--journal') && process.argv.includes('--bank-jv')) {
  MODES.length = 0
  MODES.push('journal', 'bank_jv')
}

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
  return { status: res.status, data, cookie: cookieHeader, csrfToken: data?.csrfToken || res.headers.get('x-csrf-token') || '' }
}

async function loadHelpers() {
  return import('../frontend/src/components/tabs/erp/journalVoucherHelpers.js')
}

async function fetchAllByType(cookie, referenceType) {
  const all = []
  let cursor = null
  for (let page = 0; page < 40; page += 1) {
    const qs = new URLSearchParams({ referenceType, limit: '500' })
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

function buildRenumberPlan(grouped, extractLedgerJvDocNoFromDescription) {
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
          date: voucher.date,
          fromDocNo: voucher.currentDocNo,
          toDocNo: targetDocNo,
          toDescription: replaceDocNoInDescription(line.description, targetDocNo),
        })
      }
    })
  }

  plan.sort((a, b) => {
    const toSeq = Number(String(b.toDocNo).split('/').pop() || 0)
    const fromSeq = Number(String(a.fromDocNo).split('/').pop() || 0)
    return toSeq - fromSeq || fromSeq - Number(String(b.toDocNo).split('/').pop() || 0)
  })
  return plan
}

async function main() {
  const password = process.env.MG_ADMIN_PASSWORD || process.env.SMOKE_AUTH_PASSWORD_MG
  if (!password) throw new Error('Set MG_ADMIN_PASSWORD (or SMOKE_AUTH_PASSWORD_MG)')

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { name: process.env.MG_ADMIN_NAME || 'Nan', password, company: TENANT },
  })
  if (login.status !== 200 || !login.data?.success) {
    throw new Error(`Login failed (${login.status}): ${login.data?.message || 'no access'}`)
  }
  const csrfToken = login.data?.csrfToken || login.csrfToken || ''

  const { groupJvLedgerEntries, extractLedgerJvDocNoFromDescription } = await loadHelpers()
  const types = MODES.length ? MODES : ['journal']

  for (const referenceType of types) {
    const entries = await fetchAllByType(login.cookie, referenceType)
    const grouped = groupJvLedgerEntries(entries)
    const plan = buildRenumberPlan(grouped, extractLedgerJvDocNoFromDescription)

    console.log(`\n=== MG ${referenceType} doc no renumber ===`)
    console.log(`Vouchers: ${grouped.length} | Lines to update: ${plan.length} | Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)

    const voucherChanges = [...new Set(plan.map((row) => `${row.fromDocNo} -> ${row.toDocNo} (${new Date(row.date).toISOString().slice(0, 10)})`))]
    if (!voucherChanges.length) {
      console.log('No renumbering needed.')
      continue
    }
    console.log('\nPlanned changes:')
    voucherChanges.forEach((line) => console.log(`  ${line}`))

    if (!APPLY) continue

    const results = []
    for (const row of plan) {
      const res = await request(`/api/erp-accounting/ledger/${row.entryId}`, {
        method: 'PUT',
        cookie: login.cookie,
        headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
        body: { description: row.toDescription },
      })
      results.push({ entryId: row.entryId, status: res.status, ok: res.status >= 200 && res.status < 300 })
    }
    const failed = results.filter((r) => !r.ok)
    console.log(`Updated ${results.filter((r) => r.ok).length}/${results.length} ledger lines`)
    if (failed.length) {
      failed.forEach((r) => console.log(`  FAIL ${r.entryId}: ${r.status}`))
      process.exit(1)
    }

    const verifyGrouped = groupJvLedgerEntries(await fetchAllByType(login.cookie, referenceType))
    console.log('\nAfter renumber:')
    verifyGrouped.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach((g) => {
      console.log(`  ${new Date(g.date).toISOString().slice(0, 10)}  ${g.voucherNo}  (${g.lineCount} line(s))`)
    })
  }

  if (!APPLY) console.log('\nDry run complete. Add --apply to update ledger descriptions.\n')
  else console.log('\nDone.\n')
}

main().catch((err) => {
  console.error(`\n${err.message}\n`)
  process.exit(1)
})
