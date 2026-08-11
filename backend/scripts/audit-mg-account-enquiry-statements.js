/**
 * Read-only MG Account Enquiry audit.
 *
 * Auth (never logged):
 *   MG_SMOKE_NAME / MG_SMOKE_PASSWORD
 *   or SMOKE_AUTH_NAME_MG / SMOKE_AUTH_PASSWORD_MG
 *   or MG_ADMIN_NAME / MG_ADMIN_PASSWORD
 *
 * Usage:
 *   node backend/scripts/audit-mg-account-enquiry-statements.js
 *
 * Writes report to backend/scripts/.audit-mg-enquiry-report.json (gitignored pattern via scripts temp).
 */
const fs = require('fs')
const path = require('path')
const https = require('https')

const API_BASE = String(process.env.SMOKE_API_BASE || 'https://api.loopcstrategies.com').replace(/\/$/, '')
const TENANT = 'mg'
const STATEMENT_LIMIT = 500
const YTD_START = '2026-01-01'
const CONCURRENCY = Math.max(1, Math.min(6, Number(process.env.MG_ENQUIRY_AUDIT_CONCURRENCY || 3)))

const USERNAME = process.env.MG_SMOKE_NAME
  || process.env.SMOKE_AUTH_NAME_MG
  || process.env.MG_ADMIN_NAME
  || 'Nan'
const PASSWORD = process.env.MG_SMOKE_PASSWORD
  || process.env.SMOKE_AUTH_PASSWORD_MG
  || process.env.MG_ADMIN_PASSWORD
  || ''

if (!PASSWORD) {
  throw new Error('Set MG_SMOKE_PASSWORD / SMOKE_AUTH_PASSWORD_MG / MG_ADMIN_PASSWORD to run this audit.')
}

function httpRequest(method, requestPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + requestPath)
    const data = body ? JSON.stringify(body) : null
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-tenant': TENANT,
        'x-company': TENANT,
        ...headers,
      },
    }
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data)
    const req = https.request(options, (res) => {
      let responseData = ''
      res.on('data', (chunk) => { responseData += chunk })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseData), headers: res.headers })
        } catch {
          resolve({ status: res.statusCode, data: responseData, headers: res.headers })
        }
      })
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

function extractCookie(setCookies) {
  if (!Array.isArray(setCookies)) {
    const single = String(setCookies || '').trim()
    return single ? single.split(';')[0] : ''
  }
  return setCookies.map((cookie) => String(cookie).split(';')[0]).join('; ')
}

function authHeaders(session) {
  const headers = {
    Cookie: session.cookie,
  }
  if (session.csrfToken) headers['x-csrf-token'] = session.csrfToken
  if (session.token) headers.Authorization = `Bearer ${session.token}`
  return headers
}

function summarizeEnquiry(payload) {
  const meta = payload?.statement?.meta || {}
  return {
    accountCode: payload?.account?.accountCode || '',
    accountName: payload?.account?.accountName || '',
    entryCount: Number(payload?.statement?.entryCount || 0),
    returned: Number(meta.returned ?? (payload?.statement?.entries?.length || 0)),
    limit: Number(meta.limit || STATEMENT_LIMIT),
    truncated: Boolean(meta.truncated),
    matchingCount: Number(meta.matchingCount || 0),
    oldestDate: meta.oldestDate || null,
    startDate: meta.startDate || '',
    endDate: meta.endDate || '',
    netBalance: Number(payload?.balances?.netBalance || 0),
  }
}

async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length)
  let next = 0
  async function run() {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await worker(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()))
  return results
}

async function fetchAllSummaryAccounts(session) {
  const accounts = []
  let page = 1
  for (;;) {
    const res = await httpRequest(
      'GET',
      `/api/erp-accounting/accounts?scope=summary&isActive=true&limit=500&page=${page}`,
      null,
      authHeaders(session),
    )
    if (res.status !== 200) {
      throw new Error(`Failed to list summary accounts (page ${page}, status ${res.status})`)
    }
    const batch = Array.isArray(res.data?.accounts) ? res.data.accounts : []
    accounts.push(...batch)
    if (batch.length < 500) break
    page += 1
    if (page > 20) break
  }
  const byCode = new Map()
  for (const row of accounts) {
    const code = String(row?.accountCode || '').trim()
    if (!code) continue
    if (!byCode.has(code)) byCode.set(code, row)
  }
  return [...byCode.values()]
}

async function enquire(session, accountCode, extraQuery = '') {
  const qs = new URLSearchParams({
    accountCode,
    statementLimit: String(STATEMENT_LIMIT),
    refresh: '1',
  })
  if (extraQuery) {
    const extra = new URLSearchParams(extraQuery)
    extra.forEach((value, key) => qs.set(key, value))
  }
  const res = await httpRequest(
    'GET',
    `/api/erp-accounting/accounts/enquiry?${qs.toString()}`,
    null,
    authHeaders(session),
  )
  return res
}

async function main() {
  const loginRes = await httpRequest('POST', '/api/auth/login', {
    name: USERNAME,
    password: PASSWORD,
    company: TENANT,
  })
  const cookie = extractCookie(loginRes.headers['set-cookie'])
  const token = String(loginRes.data?.token || loginRes.data?.accessToken || '').trim()
  const csrfToken = String(loginRes.data?.csrfToken || loginRes.headers['x-csrf-token'] || '').trim()
  if (loginRes.status !== 200 || loginRes.data?.success !== true || !cookie) {
    throw new Error(`Login failed (${loginRes.status})`)
  }
  const session = { cookie, token, csrfToken }

  const accounts = await fetchAllSummaryAccounts(session)
  console.log(`Auditing ${accounts.length} MG summary accounts (limit=${STATEMENT_LIMIT})…`)

  const rows = await mapPool(accounts, CONCURRENCY, async (account) => {
    const code = String(account.accountCode || '').trim()
    const res = await enquire(session, code)
    if (res.status !== 200 || !res.data?.success) {
      return {
        accountCode: code,
        accountName: account.accountName || '',
        ok: false,
        status: res.status,
        reason: 'enquiry_failed',
      }
    }
    return { ok: true, ...summarizeEnquiry(res.data) }
  })

  const flagged = rows.filter((row) => row.ok && (row.truncated || row.matchingCount > STATEMENT_LIMIT))
  const failed = rows.filter((row) => !row.ok)

  const ytdPass = await mapPool(flagged, CONCURRENCY, async (row) => {
    const res = await enquire(session, row.accountCode, `startDate=${YTD_START}`)
    if (res.status !== 200 || !res.data?.success) {
      return {
        accountCode: row.accountCode,
        ok: false,
        status: res.status,
        reason: 'ytd_enquiry_failed',
      }
    }
    const summary = summarizeEnquiry(res.data)
    return {
      ok: true,
      accountCode: row.accountCode,
      baseTruncated: row.truncated,
      baseMatchingCount: row.matchingCount,
      baseOldestDate: row.oldestDate,
      ytd: summary,
      recoveredOlderMonths: Boolean(summary.oldestDate)
        && (!row.oldestDate || new Date(summary.oldestDate) < new Date(row.oldestDate)),
    }
  })

  const report = {
    generatedAt: new Date().toISOString(),
    apiBase: API_BASE,
    tenant: TENANT,
    statementLimit: STATEMENT_LIMIT,
    accountCount: accounts.length,
    failedCount: failed.length,
    flaggedCount: flagged.length,
    failed,
    flagged,
    ytdPass,
  }

  const outPath = process.env.MG_ENQUIRY_AUDIT_OUT
    || path.join(require('os').tmpdir(), 'audit-mg-enquiry-report.json')
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2))

  console.log(JSON.stringify({
    accountCount: report.accountCount,
    failedCount: report.failedCount,
    flaggedCount: report.flaggedCount,
    flaggedCodes: flagged.map((row) => row.accountCode),
    ytdRecovered: ytdPass.filter((row) => row.recoveredOlderMonths).map((row) => row.accountCode),
    reportPath: outPath,
  }, null, 2))
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
