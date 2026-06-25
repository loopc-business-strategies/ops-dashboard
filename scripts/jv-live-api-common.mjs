/**
 * Shared production API helpers for JV live verify + roundtrip scripts.
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const require = createRequire(import.meta.url)

try {
  require(path.join(rootDir, 'backend', 'node_modules', 'dotenv')).config({
    path: path.join(rootDir, 'backend', '.env'),
  })
} catch {
  // optional
}

export const TENANTS = ['mg', 'cg', 'loopc']
export const AUTO_TEST_MARKER = 'AUTO TEST OPS-'
const SYSTEM_FX_ADJUSTMENT_DESC_RE = /Exchange (gain|loss) adjustment for transaction /i

export function isSystemFxAdjustmentLedgerEntry(entry) {
  return SYSTEM_FX_ADJUSTMENT_DESC_RE.test(String(entry?.description || ''))
}

export function isManualJvLedgerEntrySync(entry) {
  const refType = String(entry?.referenceType || '').toLowerCase()
  if (refType !== 'journal' && refType !== 'bank_jv') return false
  if (refType === 'journal' && isSystemFxAdjustmentLedgerEntry(entry)) return false
  return true
}

export function getApiBase() {
  return (process.env.API_BASE || 'https://api.loopcstrategies.com').replace(/\/$/, '')
}

export function tenantEnvPrefix(tenant) {
  const key = String(tenant || '').trim().toLowerCase()
  if (key === 'loopc') return 'LOOPC'
  return key.toUpperCase()
}

export function resolveCredentials(tenant) {
  const prefix = tenantEnvPrefix(tenant)
  const tenantKey = String(tenant || '').trim().toLowerCase()
  const password = process.env[`${prefix}_ADMIN_PASSWORD`]
    || process.env[`SMOKE_AUTH_PASSWORD_${prefix}`]
    || process.env.SMOKE_AUTH_PASSWORD
  const name = process.env[`${prefix}_ADMIN_NAME`]
    || process.env[`SMOKE_AUTH_NAME_${prefix}`]
    || process.env.SMOKE_AUTH_NAME
    || (tenantKey === 'mg' ? 'Nan' : '')
  return { name: String(name || '').trim(), password: String(password || '').trim() }
}

export function hasCredentials(tenant) {
  return Boolean(resolveCredentials(tenant).password)
}

export function parseTenantArg(argv, defaultTenant = 'mg') {
  const idx = argv.indexOf('--tenant')
  if (idx === -1 || !argv[idx + 1]) return defaultTenant
  const value = String(argv[idx + 1]).trim().toLowerCase()
  if (value === 'all') return 'all'
  if (TENANTS.includes(value)) return value
  throw new Error(`Invalid --tenant ${value}; use mg, cg, loopc, or all`)
}

export function parseTenantList(tenantArg) {
  return tenantArg === 'all' ? [...TENANTS] : [tenantArg]
}

export async function loadJvHelpers() {
  return import('../frontend/src/components/tabs/erp/journalVoucherHelpers.js')
}

export async function apiRequest(tenant, pathname, {
  method = 'GET',
  body,
  session = null,
  apiBase = getApiBase(),
} = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'x-tenant': tenant,
    'x-company': tenant,
  }
  if (session?.cookie) headers.Cookie = session.cookie
  if (session?.csrfToken) headers['x-csrf-token'] = session.csrfToken
  if (session?.token) headers.Authorization = `Bearer ${session.token}`

  const res = await fetch(`${apiBase}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }

  const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  const cookieHeader = setCookie.map((row) => String(row).split(';')[0]).filter(Boolean).join('; ')
  const csrfHeader = res.headers.get('x-csrf-token')

  return {
    status: res.status,
    data,
    cookie: cookieHeader,
    csrfToken: data?.csrfToken || csrfHeader || session?.csrfToken || null,
  }
}

export async function loginTenant(tenant) {
  const { name, password } = resolveCredentials(tenant)
  if (!password) {
    throw new Error(
      `Missing credentials for ${tenant}. Set ${tenantEnvPrefix(tenant)}_ADMIN_PASSWORD or SMOKE_AUTH_PASSWORD_${tenantEnvPrefix(tenant)}`,
    )
  }
  if (!name) {
    throw new Error(
      `Missing login name for ${tenant}. Set ${tenantEnvPrefix(tenant)}_ADMIN_NAME or SMOKE_AUTH_NAME_${tenantEnvPrefix(tenant)}`,
    )
  }

  const login = await apiRequest(tenant, '/api/auth/login', {
    method: 'POST',
    body: { name, password, company: tenant },
  })
  if (login.status !== 200 || !login.data?.success) {
    throw new Error(`Login failed for ${tenant} (${login.status}): ${login.data?.message || 'no access'}`)
  }

  return {
    tenant,
    name,
    cookie: login.cookie,
    csrfToken: login.csrfToken || login.data?.csrfToken || null,
    token: login.data?.token || null,
  }
}

export async function fetchAllJournalJv(tenant, session) {
  const all = []
  let cursor = null
  for (let page = 0; page < 40; page += 1) {
    const qs = new URLSearchParams({ referenceType: 'journal', limit: '500' })
    if (cursor) qs.set('cursor', cursor)
    const res = await apiRequest(tenant, `/api/erp-accounting/ledger?${qs}`, { session })
    if (res.status !== 200) {
      throw new Error(`Ledger fetch failed for ${tenant} (${res.status}): ${res.data?.message || 'unknown'}`)
    }
    const batch = Array.isArray(res.data?.entries) ? res.data.entries : []
    all.push(...batch)
    if (!res.data?.hasMore || !res.data?.nextCursor || !batch.length) break
    cursor = res.data.nextCursor
  }
  return all
}

export async function filterManualJournalJvEntries(entries) {
  return (entries || []).filter((entry) => isManualJvLedgerEntrySync(entry))
}

export async function auditJournalJv(tenant, entries) {
  const { groupJvLedgerEntries } = await loadJvHelpers()
  const manualEntries = await filterManualJournalJvEntries(entries)
  const fxSkipped = entries.length - manualEntries.length
  const grouped = groupJvLedgerEntries(manualEntries)

  const docNoCounts = new Map()
  for (const g of grouped) {
    docNoCounts.set(g.voucherNo, (docNoCounts.get(g.voucherNo) || 0) + 1)
  }
  const dupDocs = [...docNoCounts.entries()].filter(([, n]) => n > 1)

  console.log(`\n=== ${tenant.toUpperCase()} normal JV audit ===`)
  console.log(`Ledger lines: ${entries.length}`)
  if (fxSkipped > 0) {
    console.log(`Excluded system FX adjustment lines (not manual JV): ${fxSkipped}`)
  }
  console.log(`Grouped vouchers: ${grouped.length}`)
  console.log(`Duplicate doc numbers: ${dupDocs.length}`)

  if (dupDocs.length) {
    console.log(`FAIL: ${dupDocs.length} duplicate doc number(s):`)
    for (const [doc, count] of dupDocs) {
      console.log(`  ${doc} x${count}`)
      grouped.filter((g) => g.voucherNo === doc).forEach((g) => {
        console.log(`    ${new Date(g.date).toISOString().slice(0, 10)}  ${g.lineCount} lines  ref=${g.representative?.referenceId || 'legacy'}`)
      })
    }
  }

  return { grouped, dupDocs, ok: dupDocs.length === 0 }
}

export function isAutoTestDescription(description) {
  return String(description || '').includes(AUTO_TEST_MARKER)
}

export function findAutoTestEntries(entries) {
  return entries.filter((entry) => !entry.isDeleted && isAutoTestDescription(entry.description))
}

export async function fetchAccounts(tenant, session) {
  const res = await apiRequest(tenant, '/api/erp-accounting/accounts?page=1&limit=5000', { session })
  if (res.status !== 200) {
    throw new Error(`Accounts fetch failed (${res.status}): ${res.data?.message || 'unknown'}`)
  }
  const accounts = Array.isArray(res.data?.accounts) ? res.data.accounts : []
  return accounts.filter((a) => a?.isActive !== false && a?._id)
}

export function pickTestAccountPair(accounts) {
  const byCode = new Map(
    accounts.map((a) => [String(a.accountCode || '').trim(), a]).filter(([code]) => code),
  )
  const preferredDebit = byCode.get('1000') || accounts[0]
  const preferredCredit = byCode.get('4000') || accounts.find((a) => String(a._id) !== String(preferredDebit?._id)) || accounts[1]
  if (!preferredDebit?._id || !preferredCredit?._id) {
    throw new Error('Need at least two active accounts to build a test JV')
  }
  if (String(preferredDebit._id) === String(preferredCredit._id)) {
    throw new Error('Could not find two distinct accounts for test JV')
  }
  return { debit: preferredDebit, credit: preferredCredit }
}

export async function getNextJvDocNo(tenant, session) {
  const res = await apiRequest(tenant, '/api/erp-accounting/ledger/next-voucher-no?referenceType=journal', { session })
  if (res.status !== 200 || !res.data?.docNo) {
    throw new Error(`next-voucher-no failed (${res.status}): ${res.data?.message || 'unknown'}`)
  }
  return res.data.docNo
}

export function buildAutoTestStamp() {
  return new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
}

export async function deleteLedgerEntry(tenant, session, entryId) {
  return apiRequest(tenant, `/api/erp-accounting/ledger/${entryId}`, {
    method: 'DELETE',
    session,
  })
}
