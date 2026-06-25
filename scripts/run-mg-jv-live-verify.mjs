/**
 * MG production JV audit wrapper (loads backend/.env, then runs verify-mg-journal-jv-live.js).
 *
 * Usage:
 *   node scripts/run-mg-jv-live-verify.mjs
 *   node scripts/run-mg-jv-live-verify.mjs --smoke-only   # API probes only (no login)
 *
 * Credentials (one of):
 *   MG_ADMIN_PASSWORD, SMOKE_AUTH_PASSWORD_MG (in shell or backend/.env)
 *   MG_ADMIN_NAME (default Nan)
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const backendDir = path.join(rootDir, 'backend')
const require = createRequire(import.meta.url)

try {
  require(path.join(backendDir, 'node_modules', 'dotenv')).config({
    path: path.join(backendDir, '.env'),
  })
} catch {
  // dotenv optional
}

const smokeOnly = process.argv.includes('--smoke-only')
const API = (process.env.API_BASE || 'https://api.loopcstrategies.com').replace(/\/$/, '')

async function apiProbe(pathname, options = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-tenant': 'mg',
      'x-company': 'mg',
      ...(options.headers || {}),
    },
  })
  return res.status
}

async function runSmokeProbes() {
  console.log(`MG JV smoke probes → ${API}\n`)
  const ready = await apiProbe('/api/ready')
  console.log(`  /api/ready → ${ready} ${ready === 200 ? 'OK' : 'FAIL'}`)

  const jvBatch = await apiProbe('/api/erp-accounting/ledger/journal-voucher', {
    method: 'POST',
    body: '{}',
  })
  console.log(
    `  POST /ledger/journal-voucher (no auth) → ${jvBatch} `
    + `${jvBatch === 401 ? 'OK (route exists)' : 'check deploy'}`,
  )

  if (ready !== 200) {
    console.error('\nAPI not ready — wait for Railway deploy or check API_BASE.')
    process.exit(1)
  }
}

function hasMgCredentials() {
  return Boolean(process.env.MG_ADMIN_PASSWORD || process.env.SMOKE_AUTH_PASSWORD_MG)
}

function printCredentialHelp() {
  console.log('\nFull MG JV ledger audit requires MG admin credentials.\n')
  console.log('Use the same login as https://mg.loopcstrategies.com (tenant MG).')
  console.log('Default username: Nan (override with MG_ADMIN_NAME).\n')
  console.log('PowerShell:')
  console.log('  $env:MG_ADMIN_PASSWORD = "your-password"')
  console.log('  npm run verify:mg-jv-live')
  console.log('\nOr set MG_ADMIN_PASSWORD in backend/.env (never commit).')
  console.log('UI save smoke: https://mg.loopcstrategies.com → ERP → Ledger → + New Journal Voucher')
}

async function main() {
  await runSmokeProbes()

  if (smokeOnly) {
    console.log('\nSmoke probes passed (--smoke-only).')
    return
  }

  if (!hasMgCredentials()) {
    printCredentialHelp()
    process.exit(2)
  }

  console.log('\nRunning full MG JV audit...\n')
  const result = spawnSync('node', [path.join(__dirname, 'verify-mg-journal-jv-live.js')], {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  process.exit(result.status ?? 1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
