/* eslint-disable no-console */
const { spawnSync } = require('child_process')
const path = require('path')

const PROD_HOST_RE = /(^|\.)loopcstrategies\.com$/i
const PROD_API_RE = /^https:\/\/api\.loopcstrategies\.com\/?$/i

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function assertStagingTargets() {
  const apiBase = String(process.env.SMOKE_API_BASE || '').trim().replace(/\/$/, '')
  const baseDomain = String(process.env.SMOKE_BASE_DOMAIN || '').trim()
  const vercelHosts = splitCsv(process.env.SMOKE_VERCEL_HOSTS)
  const allowProductionTargets = String(process.env.STAGING_SMOKE_ALLOW_PRODUCTION_TARGETS || '').toLowerCase() === 'true'
  const skipFrontend = String(process.env.SMOKE_SKIP_FRONTEND || '').toLowerCase() === 'true'

  if (!apiBase) {
    throw new Error('SMOKE_API_BASE is required for staging smoke, e.g. https://api-staging.example.com')
  }

  const productionTargets = []
  if (PROD_API_RE.test(apiBase)) productionTargets.push(`SMOKE_API_BASE=${apiBase}`)
  if (baseDomain && PROD_HOST_RE.test(baseDomain)) productionTargets.push(`SMOKE_BASE_DOMAIN=${baseDomain}`)
  for (const host of vercelHosts) {
    if (PROD_HOST_RE.test(host)) productionTargets.push(`SMOKE_VERCEL_HOSTS contains ${host}`)
  }

  if (productionTargets.length && !allowProductionTargets) {
    throw new Error(
      'Refusing to run staging smoke against production target(s): '
      + `${productionTargets.join(', ')}. Set STAGING_SMOKE_ALLOW_PRODUCTION_TARGETS=true only for an intentional emergency check.`,
    )
  }

  if (!skipFrontend && !baseDomain && !vercelHosts.length) {
    throw new Error('Set SMOKE_BASE_DOMAIN or SMOKE_VERCEL_HOSTS for staging frontend checks.')
  }
}

function run() {
  assertStagingTargets()
  const script = path.join(__dirname, 'production-smoke.js')
  const result = spawnSync(process.execPath, [script], {
    stdio: 'inherit',
    env: {
      ...process.env,
      SMOKE_ENV_LABEL: process.env.SMOKE_ENV_LABEL || 'Staging',
      SMOKE_REQUIRE_AUTH: process.env.SMOKE_REQUIRE_AUTH || 'true',
    },
  })
  process.exit(result.status === null ? 1 : result.status)
}

try {
  run()
} catch (error) {
  console.error(error.message || error)
  process.exit(1)
}
