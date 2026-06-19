#!/usr/bin/env node
/**
 * Automated checks that support ERP acceptance (see docs/ERP-ACCEPTANCE-CHECKLIST.md).
 * Manual sign-off still required for voucher print, JV FX, and live enquiry UI.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const API_BASE = (process.env.SMOKE_API_BASE || 'https://api.loopcstrategies.com').replace(/\/$/, '')
const TENANTS = ['mg', 'cg', 'loopc']

function run(cmd, args, cwd = root) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, init)
  const body = await res.json().catch(() => ({}))
  return { res, body }
}

async function checkApiReady() {
  console.log('\n— API readiness —')
  const { res, body } = await fetchJson(`${API_BASE}/api/ready`)
  if (!res.ok || body.ready !== true) {
    console.error('FAIL /api/ready', res.status, body)
    process.exit(1)
  }
  for (const tenant of TENANTS) {
    const t = body?.checks?.tenants?.[tenant]
    if (!t?.ready) {
      console.error(`FAIL tenant ${tenant} not ready`, t)
      process.exit(1)
    }
    console.log(`✔ ${tenant} mongo ready`)
  }
  const integ = body?.checks?.integrations || {}
  console.log(`✔ expoPushAccessTokenSet: ${integ.expoPushAccessTokenSet}`)
  console.log(`✔ webPushVapidKeysSet: ${integ.webPushVapidKeysSet}`)
}

async function checkTenantShells() {
  console.log('\n— Tenant SPA shells —')
  for (const tenant of TENANTS) {
    const host = `${tenant}.loopcstrategies.com`
    const login = await fetch(`https://${host}/login`)
    const loginBody = await login.text()
    if (!login.ok || !/id="root"/i.test(loginBody)) {
      console.error(`FAIL ${host}/login`, login.status)
      process.exit(1)
    }
    const deep = await fetch(`https://${host}/dashboard?tab=erp-enquiry&account=1000`)
    const deepBody = await deep.text()
    if (!deep.ok || !/id="root"/i.test(deepBody)) {
      console.error(`FAIL ${host} enquiry deep-link shell`, deep.status)
      process.exit(1)
    }
    console.log(`✔ ${tenant} login + enquiry deep-link shell`)
  }
}

async function checkCorsOrigins() {
  console.log('\n— CORS preflight —')
  const origins = [
    'https://mg.loopcstrategies.com',
    'https://cg.loopcstrategies.com',
    'https://loopc.loopcstrategies.com',
    'https://app.loopcstrategies.com',
  ]
  for (const origin of origins) {
    const res = await fetch(`${API_BASE}/api/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'GET',
      },
    })
    if (res.status !== 204 && res.status !== 200) {
      console.error(`FAIL CORS preflight for ${origin}: ${res.status}`)
      process.exit(1)
    }
    console.log(`✔ CORS ${origin}`)
  }
}

console.log('ERP acceptance — automated checks')
console.log(`API: ${API_BASE}`)

await checkApiReady()
await checkTenantShells()
await checkCorsOrigins()

console.log('\n— Unit / E2E (local) —')
run('npm', ['run', 'smoke:tenants'])
run('npm', ['--prefix', 'frontend', 'run', 'test:unit'])
run('npm', ['--prefix', 'frontend', 'run', 'test:e2e'])
run('npm', ['--prefix', 'mobile', 'run', 'test'])

console.log('\n✔ Automated ERP acceptance checks passed.')
console.log('Manual: docs/ERP-ACCEPTANCE-CHECKLIST.md (vouchers, JV FX, enquiry modal on live tenants).')
