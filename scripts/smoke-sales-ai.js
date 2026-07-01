/* eslint-disable no-console */
/**
 * Production smoke for Sales Manager AI (/api/sales-ai).
 * Usage (from repo root):
 *   node scripts/smoke-sales-ai.js
 * Env: SMOKE_API_BASE, SMOKE_AUTH_NAME_LOOPC, SMOKE_AUTH_PASSWORD_LOOPC
 *      (or shared SMOKE_AUTH_NAME / SMOKE_AUTH_PASSWORD)
 * Optional: TAVILY_API_KEY — if set locally, script can push to Railway when RUN_SET_TAVILY_RAILWAY=1
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') })

const API_BASE = (process.env.SMOKE_API_BASE || process.env.SMOKE_API_BASE_URL || 'https://api.loopcstrategies.com').replace(/\/$/, '')
const LOOPC_NAME = process.env.SMOKE_AUTH_NAME_LOOPC || process.env.SMOKE_AUTH_NAME || process.env.LOOPC_ADMIN_NAME || 'Nan'
const LOOPC_PASSWORD = process.env.SMOKE_AUTH_PASSWORD_LOOPC || process.env.SMOKE_AUTH_PASSWORD || process.env.LOOPC_ADMIN_PASSWORD
const MG_NAME = process.env.SMOKE_AUTH_NAME_MG || LOOPC_NAME
const MG_PASSWORD = process.env.SMOKE_AUTH_PASSWORD_MG || LOOPC_PASSWORD
const CHAT_TIMEOUT_MS = Number(process.env.SALES_AI_SMOKE_TIMEOUT_MS || 120000)

if (!LOOPC_PASSWORD) {
  console.error('Missing LoopC smoke credentials (SMOKE_AUTH_PASSWORD_LOOPC or LOOPC_ADMIN_PASSWORD).')
  process.exit(1)
}

async function safeJson(res) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

function cookieHeaderFromResponse(response) {
  const rawSetCookie = response.headers.getSetCookie
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean)

  return rawSetCookie
    .flatMap((value) => String(value || '').split(/,(?=\s*[^;,=\s]+=[^;,]+)/))
    .map((value) => value.split(';')[0].trim())
    .filter(Boolean)
    .join('; ')
}

async function login(company, name, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant': company,
      'x-company': company,
    },
    body: JSON.stringify({ company, name, password }),
  })
  const data = await safeJson(res)
  const cookie = cookieHeaderFromResponse(res)
  const csrfToken = String(data?.csrfToken || res.headers.get('x-csrf-token') || '').trim()
  if (!res.ok || !cookie) {
    throw new Error(`Login ${company} failed: ${data?.message || res.status}`)
  }
  return { cookie, csrfToken }
}

function headers(session, company) {
  const h = {
    Cookie: session.cookie,
    'Content-Type': 'application/json',
    'x-tenant': company,
    'x-company': company,
  }
  if (session.csrfToken) h['x-csrf-token'] = session.csrfToken
  return h
}

async function getBriefing(session, company) {
  const res = await fetch(`${API_BASE}/api/sales-ai/briefing`, { headers: headers(session, company) })
  const data = await safeJson(res)
  return { status: res.status, data }
}

async function getConfig(session, company) {
  const res = await fetch(`${API_BASE}/api/sales-ai/config`, { headers: headers(session, company) })
  const data = await safeJson(res)
  return { status: res.status, data }
}

async function postChat(session, company, message) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE}/api/sales-ai/chat`, {
      method: 'POST',
      headers: headers(session, company),
      body: JSON.stringify({ message, pageContext: { tab: 'overview' } }),
      signal: controller.signal,
    })
    const data = await safeJson(res)
    return { status: res.status, data }
  } finally {
    clearTimeout(timer)
  }
}

function summarizeReply(data) {
  const reply = String(data?.reply || '')
  const sections = Array.isArray(data?.sections) ? data.sections : []
  const sources = sections.flatMap((s) => s.sources || [])
  return {
    replyLen: reply.length,
    replyPreview: reply.slice(0, 120).replace(/\s+/g, ' '),
    sectionAgents: sections.map((s) => s.agent),
    sourceCount: sources.length,
    synthesisMode: data?.meta?.synthesisMode || '',
    tavilyConfigured: Boolean(data?.providers?.tavily?.configured),
    openaiConfigured: Boolean(data?.providers?.openai?.configured),
  }
}

async function main() {
  console.log(`Sales AI smoke → ${API_BASE}`)
  const results = []

  const loopcSession = await login('loopc', LOOPC_NAME, LOOPC_PASSWORD)
  const configRes = await getConfig(loopcSession, 'loopc')
  results.push({
    check: 'GET /api/sales-ai/config (loopc)',
    ok: configRes.status === 200 && configRes.data?.success,
    detail: {
      status: configRes.status,
      enabled: configRes.data?.enabled,
      providers: configRes.data?.providers,
      quickActions: configRes.data?.quickActions?.length,
    },
  })

  const briefingRes = await getBriefing(loopcSession, 'loopc')
  results.push({
    check: 'GET /api/sales-ai/briefing (loopc)',
    ok: briefingRes.status === 200
      && briefingRes.data?.success
      && briefingRes.data?.metals
      && briefingRes.data?.crm?.summary,
    detail: {
      status: briefingRes.status,
      hasMetals: Boolean(briefingRes.data?.metals?.goldPrice),
      pipelineValue: briefingRes.data?.crm?.summary?.pipelineValueUSD,
      marketBullets: briefingRes.data?.market?.bullets?.length || 0,
      suggestions: briefingRes.data?.suggestions?.length || 0,
    },
  })

  const chatRes = await postChat(loopcSession, 'loopc', 'Analyze our CRM pipeline briefly.')
  const summary = summarizeReply(chatRes.data)
  const chatOk = chatRes.status === 200
    && chatRes.data?.success
    && summary.replyLen > 50
    && (summary.synthesisMode === 'template' || summary.synthesisMode === 'openai' || !summary.synthesisMode)
  results.push({
    check: 'POST /api/sales-ai/chat (loopc)',
    ok: chatOk,
    detail: { status: chatRes.status, message: chatRes.data?.message, ...summary },
  })

  const mgSession = await login('mg', MG_NAME, MG_PASSWORD)
  const mgConfig = await getConfig(mgSession, 'mg')
  results.push({
    check: 'GET /api/sales-ai/config (mg → 403)',
    ok: mgConfig.status === 403,
    detail: { status: mgConfig.status, message: mgConfig.data?.message },
  })

  const mgBriefing = await getBriefing(mgSession, 'mg')
  results.push({
    check: 'GET /api/sales-ai/briefing (mg → 403)',
    ok: mgBriefing.status === 403,
    detail: { status: mgBriefing.status, message: mgBriefing.data?.message },
  })

  const mgChat = await postChat(mgSession, 'mg', 'Market trends')
  results.push({
    check: 'POST /api/sales-ai/chat (mg → 403)',
    ok: mgChat.status === 403 && /not enabled for this tenant/i.test(String(mgChat.data?.message || '')),
    detail: { status: mgChat.status, message: mgChat.data?.message },
  })

  let failed = 0
  for (const r of results) {
    const mark = r.ok ? 'PASS' : 'FAIL'
    if (!r.ok) failed += 1
    console.log(`[${mark}] ${r.check}`)
    console.log('       ', JSON.stringify(r.detail))
  }

  if (failed) {
    console.error(`\n${failed} check(s) failed.`)
    process.exit(1)
  }

  console.log('\nAll Sales Manager AI smoke checks passed.')
  if (!configRes.data?.providers?.tavily?.configured) {
    console.warn('\nNote: TAVILY_API_KEY is not configured on production — web citations will be missing until set.')
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
