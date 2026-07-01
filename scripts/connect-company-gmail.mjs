#!/usr/bin/env node
/**
 * Open company Gmail OAuth in the browser (super_admin, LoopC production).
 * Requires Gmail env vars on Railway (npm run setup:gmail-railway).
 *
 * Usage:
 *   npm run connect:company-gmail
 * Env: SMOKE_API_BASE, SMOKE_AUTH_NAME_LOOPC, SMOKE_AUTH_PASSWORD_LOOPC (or LOOPC_ADMIN_*)
 */
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../backend/.env') })

const API_BASE = (
  process.env.SMOKE_API_BASE
  || process.env.SMOKE_API_BASE_URL
  || 'https://api.loopcstrategies.com'
).replace(/\/$/, '')
const NAME =
  process.env.SMOKE_AUTH_NAME_LOOPC
  || process.env.LOOPC_ADMIN_NAME
  || process.env.SMOKE_AUTH_NAME
  || 'Nan'
const PASSWORD =
  process.env.SMOKE_AUTH_PASSWORD_LOOPC
  || process.env.LOOPC_ADMIN_PASSWORD
  || process.env.SMOKE_AUTH_PASSWORD

if (!PASSWORD) {
  console.error('Missing LOOPC_ADMIN_PASSWORD or SMOKE_AUTH_PASSWORD_LOOPC in backend/.env')
  process.exit(1)
}

async function login() {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant': 'loopc',
      'x-company': 'loopc',
    },
    body: JSON.stringify({ company: 'loopc', name: NAME, password: PASSWORD }),
  })
  const data = await res.json().catch(() => ({}))
  const setCookie = res.headers.getSetCookie
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie')].filter(Boolean)
  const cookie = setCookie
    .flatMap((v) => String(v).split(/,(?=\s*[^;,=\s]+=[^;,]+)/))
    .map((v) => v.split(';')[0].trim())
    .filter(Boolean)
    .join('; ')
  if (!res.ok || !cookie) {
    throw new Error(data?.message || `Login failed (${res.status})`)
  }
  if (data?.user?.role !== 'super_admin') {
    console.warn(
      `Warning: logged-in user role is "${data?.user?.role || 'unknown'}". Company inbox OAuth requires super_admin.`,
    )
  }
  return cookie
}

async function checkStatus(cookie) {
  const res = await fetch(`${API_BASE}/api/email/tenant-connection`, {
    headers: { Cookie: cookie, 'x-tenant': 'loopc', 'x-company': 'loopc' },
  })
  return res.json().catch(() => ({}))
}

const FRONTEND = (
  process.env.LOOPC_CLIENT_URL
  || process.env.CLIENT_URL_LOOPC
  || 'https://loopc.loopcstrategies.com'
).replace(/\/$/, '')

async function main() {
  console.log(`API: ${API_BASE}`)
  const cookie = await login()

  const connRes = await fetch(`${API_BASE}/api/email/connection`, {
    headers: { Cookie: cookie, 'x-tenant': 'loopc', 'x-company': 'loopc' },
  })
  const conn = await connRes.json().catch(() => ({}))
  if (conn.gmailConfigured === false) {
    console.error('Gmail is not configured on the server yet (gmailConfigured: false).')
    console.error('Run: npm run setup:gmail-railway  (with Google OAuth credentials)')
    process.exit(1)
  }

  const status = await checkStatus(cookie)
  if (status.connected) {
    console.log(`Company inbox already connected: ${status.email || status.expectedEmail}`)
    process.exit(0)
  }

  const dashboardUrl = `${FRONTEND}/dashboard?salesAi=1`
  console.log('Open LoopC dashboard → Sales Manager AI → Connect company Gmail')
  console.log(`Sign in to Google as business@loopcstrategies.com`)
  console.log(dashboardUrl)
  try {
    execSync(`start "" "${dashboardUrl}"`, { stdio: 'inherit', shell: true })
  } catch {
    console.log('Open the URL above in your browser (super_admin session).')
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
