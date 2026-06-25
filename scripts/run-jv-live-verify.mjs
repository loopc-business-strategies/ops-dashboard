/**
 * Production JV audit wrapper (loads backend/.env).
 *
 * Usage:
 *   node scripts/run-jv-live-verify.mjs
 *   node scripts/run-jv-live-verify.mjs --tenant cg
 *   node scripts/run-jv-live-verify.mjs --tenant all
 *   node scripts/run-jv-live-verify.mjs --smoke-only
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  getApiBase,
  hasCredentials,
  parseTenantArg,
  parseTenantList,
  TENANTS,
} from './jv-live-api-common.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const smokeOnly = process.argv.includes('--smoke-only')
const tenantArg = parseTenantArg(process.argv, 'mg')
const API = getApiBase()

async function apiProbe(pathname, tenant, options = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-tenant': tenant,
      'x-company': tenant,
      ...(options.headers || {}),
    },
  })
  return res.status
}

async function runSmokeProbes() {
  console.log(`JV smoke probes → ${API}\n`)
  for (const tenant of TENANTS) {
    const ready = await apiProbe('/api/ready', tenant)
    console.log(`  [${tenant}] /api/ready → ${ready} ${ready === 200 ? 'OK' : 'FAIL'}`)
  }
  const jvBatch = await apiProbe('/api/erp-accounting/ledger/journal-voucher', 'mg', {
    method: 'POST',
    body: '{}',
  })
  console.log(
    `  POST /ledger/journal-voucher (no auth) → ${jvBatch} `
    + `${jvBatch === 401 ? 'OK (route exists)' : 'check deploy'}`,
  )

  const ready = await apiProbe('/api/ready', 'mg')
  if (ready !== 200) {
    console.error('\nAPI not ready — wait for Railway deploy or check API_BASE.')
    process.exit(1)
  }
}

function printCredentialHelp(tenant) {
  const prefix = tenant === 'loopc' ? 'LOOPC' : tenant.toUpperCase()
  console.log(`\nJV audit for ${tenant} requires admin credentials.\n`)
  console.log(`Portal: https://${tenant}.loopcstrategies.com`)
  console.log(`Env: ${prefix}_ADMIN_PASSWORD or SMOKE_AUTH_PASSWORD_${prefix}`)
  console.log(`Name: ${prefix}_ADMIN_NAME or SMOKE_AUTH_NAME_${prefix} (MG default Nan)\n`)
  console.log('PowerShell:')
  console.log('  $env:SMOKE_AUTH_NAME = "Nan"')
  console.log('  $env:SMOKE_AUTH_PASSWORD = "your-password"')
  console.log('  npm run verify:jv-live -- --tenant all')
}

async function main() {
  await runSmokeProbes()

  if (smokeOnly) {
    console.log('\nSmoke probes passed (--smoke-only).')
    return
  }

  const tenants = parseTenantList(tenantArg)
  let exitCode = 0

  for (const tenant of tenants) {
    if (!hasCredentials(tenant)) {
      printCredentialHelp(tenant)
      exitCode = 2
      continue
    }

    console.log(`\nRunning JV audit for ${tenant}...\n`)
    const result = spawnSync('node', [path.join(__dirname, 'verify-journal-jv-live.mjs')], {
      cwd: rootDir,
      env: { ...process.env, TENANT: tenant },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    if (result.status !== 0) exitCode = result.status ?? 1
  }

  process.exit(exitCode)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
