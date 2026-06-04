#!/usr/bin/env node
/**
 * Void a posted ERP transaction via the same route as the UI:
 *   POST /api/erp-accounting/transactions/:id/void
 *
 * Auth (pick one):
 *   - JWT: set VOID_API_JWT, or ERP_API_JWT, or JWT (Bearer sent as-is).
 *   - Cookie session: omit JWT and set SMOKE_LOGIN_PASSWORD (and optional SMOKE_LOGIN_NAME, SMOKE_LOGIN_COMPANY);
 *     script logs in like smoke-erp-api.js and uses the session cookie.
 *
 * Base URL: VOID_API_BASE_URL | API_URL | SMOKE_API_BASE_URL | API_BASE_URL (default http://localhost:5000)
 * Tenant headers: VOID_TENANT | SMOKE_LOGIN_COMPANY | DEFAULT_TENANT | loopc
 * Destructive body: confirmToken from VOID_CONFIRM_TOKEN | DESTRUCTIVE_ADMIN_CONFIRM_TOKEN | CLEANUP_CONFIRM_TOKEN (must match server)
 * Reason: VOID_REASON (min 8 chars) or built-in default
 *
 * Target:
 *   --id=<mongoId>   OR  --voc-no=Rec/2026/0001 [--type=receipt]
 *
 * Dry-run (default): resolves voc-no if needed, prints planned POST; no void.
 *   --apply          performs the void.
 *
 * Examples:
 *   node scripts/void-transaction-via-api.js --voc-no=Rec/2026/0001 --type=receipt
 *   node scripts/void-transaction-via-api.js --id=674a... --apply
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const BASE_URL = String(
  process.env.VOID_API_BASE_URL ||
    process.env.API_URL ||
    process.env.SMOKE_API_BASE_URL ||
    process.env.API_BASE_URL ||
    'http://localhost:5000',
).replace(/\/$/, '')

const TENANT = String(
  process.env.VOID_TENANT ||
    process.env.SMOKE_LOGIN_COMPANY ||
    process.env.DEFAULT_TENANT ||
    'loopc',
).trim().toLowerCase()

const JWT = String(
  process.env.VOID_API_JWT ||
    process.env.ERP_API_JWT ||
    process.env.JWT ||
    '',
).trim()

const LOGIN_NAME = process.env.SMOKE_LOGIN_NAME || process.env.SMOKE_DEFAULT_NAME || 'Nan'
const LOGIN_PASSWORD = process.env.SMOKE_LOGIN_PASSWORD || process.env.SMOKE_DEFAULT_PASSWORD

const CONFIRM_TOKEN = String(
  process.env.VOID_CONFIRM_TOKEN ||
    process.env.DESTRUCTIVE_ADMIN_CONFIRM_TOKEN ||
    process.env.CLEANUP_CONFIRM_TOKEN ||
    '',
).trim()

const REASON = String(
  process.env.VOID_REASON ||
    'Void posted voucher via void-transaction-via-api.js (ops maintenance)',
).trim()

const APPLY = process.argv.includes('--apply')

function argValue(name, fallback) {
  const prefix = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  if (!hit) return fallback
  return hit.slice(prefix.length).trim() || fallback
}

async function safeJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function tenantHeaders() {
  return {
    'x-tenant': TENANT,
    'x-company': TENANT,
  }
}

async function loginCookie() {
  if (!LOGIN_PASSWORD) {
    throw new Error('No JWT set (VOID_API_JWT / ERP_API_JWT / JWT). Set one of those, or set SMOKE_LOGIN_PASSWORD for cookie login.')
  }
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ company: TENANT, name: LOGIN_NAME, password: LOGIN_PASSWORD }),
  })
  const data = await safeJson(response)
  const setCookie = response.headers.get('set-cookie') || ''
  const sessionCookie = setCookie.split(',').find((value) => value.includes('sessionToken=')) || ''
  if (!response.ok || !sessionCookie) {
    const message = data?.message || `HTTP ${response.status}`
    throw new Error(`Login failed: ${message}`)
  }
  return sessionCookie.trim()
}

async function authHeaders() {
  const base = { 'Content-Type': 'application/json', ...tenantHeaders() }
  if (JWT) {
    return { ...base, Authorization: `Bearer ${JWT}` }
  }
  const cookie = await loginCookie()
  return { ...base, Cookie: cookie }
}

async function listTransactions(headers, { type, search }) {
  const params = new URLSearchParams({ limit: '50', page: '1' })
  if (type) params.set('type', type)
  if (search) params.set('search', search)
  const url = `${BASE_URL}/api/erp-accounting/transactions?${params.toString()}`
  const response = await fetch(url, { method: 'GET', headers })
  const data = await safeJson(response)
  if (!response.ok) {
    const message = data?.message || `HTTP ${response.status}`
    throw new Error(`List transactions failed: ${message}`)
  }
  const rows = Array.isArray(data?.transactions) ? data.transactions : []
  return { rows, raw: data }
}

function pickExactVocNo(rows, vocNo) {
  const want = String(vocNo || '').trim().toLowerCase()
  return rows.filter((t) => String(t?.voucherMeta?.vocNo || '').trim().toLowerCase() === want)
}

async function resolveTransactionId(headers) {
  const idArg = argValue('id', '').trim()
  if (idArg) return { id: idArg, source: 'arg-id', matches: [] }

  const vocNo = argValue('voc-no', '').trim() || argValue('vocNo', '').trim()
  if (!vocNo) {
    throw new Error('Provide --id=<transactionMongoId> or --voc-no=Rec/2026/0001')
  }
  const type = (argValue('type', 'receipt') || 'receipt').trim().toLowerCase()
  const { rows } = await listTransactions(headers, { type, search: vocNo })
  const matches = pickExactVocNo(rows, vocNo)
  if (!matches.length) {
    throw new Error(`No active transaction with voucherMeta.vocNo exactly "${vocNo}" (type=${type}). Try --id= or widen search.`)
  }
  if (matches.length > 1) {
    const ids = matches.map((m) => String(m._id))
    throw new Error(`Ambiguous: ${matches.length} rows match vocNo "${vocNo}": ${ids.join(', ')}. Use --id=.`)
  }
  return { id: String(matches[0]._id), source: 'voc-no', matches }
}

async function voidTransaction(headers, transactionId) {
  if (REASON.length < 8) {
    throw new Error(`VOID_REASON must be at least 8 characters (got ${REASON.length}).`)
  }
  if (!CONFIRM_TOKEN) {
    throw new Error('Set VOID_CONFIRM_TOKEN or DESTRUCTIVE_ADMIN_CONFIRM_TOKEN to the server destructive token.')
  }
  const url = `${BASE_URL}/api/erp-accounting/transactions/${transactionId}/void`
  const body = JSON.stringify({
    reason: REASON,
    confirmToken: CONFIRM_TOKEN,
  })
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
  })
  const data = await safeJson(response)
  return { ok: response.ok, status: response.status, data }
}

async function run() {
  console.log(JSON.stringify({
    step: 'config',
    baseUrl: BASE_URL,
    tenant: TENANT,
    auth: JWT ? 'bearer-jwt' : 'cookie-login',
    apply: APPLY,
  }, null, 2))

  const headers = await authHeaders()
  const resolved = await resolveTransactionId(headers)
  console.log(JSON.stringify({
    step: 'resolved',
    transactionId: resolved.id,
    source: resolved.source,
  }, null, 2))

  if (!APPLY) {
    console.log(JSON.stringify({
      step: 'dry-run',
      message: 'No void performed. Re-run with --apply to POST void.',
      wouldPost: `${BASE_URL}/api/erp-accounting/transactions/${resolved.id}/void`,
    }, null, 2))
    return
  }

  const result = await voidTransaction(headers, resolved.id)
  console.log(JSON.stringify({ step: 'void-response', ...result }, null, 2))
  if (!result.ok) {
    process.exit(1)
  }
}

run().catch((e) => {
  console.error(JSON.stringify({ step: 'error', message: e.message }, null, 2))
  process.exit(1)
})
