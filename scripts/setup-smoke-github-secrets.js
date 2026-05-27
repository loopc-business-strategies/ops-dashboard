#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Creates read-only smoke probe users in each tenant DB and stores credentials
 * in GitHub Actions secrets for post-deploy smoke tests.
 *
 * Requires:
 *   - backend/.env with MONGO_URI_MG, MONGO_URI_CG, MONGO_URI_LOOPC
 *   - gh authenticated (GH_TOKEN or gh auth login) with repo admin access
 *
 * Usage:
 *   node scripts/setup-smoke-github-secrets.js
 *   node scripts/setup-smoke-github-secrets.js --verify-only
 */

const { spawnSync } = require('node:child_process')
const crypto = require('node:crypto')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..')
const backendDir = path.join(rootDir, 'backend')

require(path.join(backendDir, 'node_modules', 'dotenv')).config({
  path: path.join(backendDir, '.env'),
})

const TENANTS = ['mg', 'cg', 'loopc']
const REPO = process.env.GITHUB_REPOSITORY || 'loopc-business-strategies/ops-dashboard'
const SMOKE_USER_NAME = String(process.env.SMOKE_AUTH_NAME || 'ops-smoke-probe').trim()
const API_BASE = (process.env.SMOKE_API_BASE || 'https://api.loopcstrategies.com').replace(/\/$/, '')
const verifyOnly = process.argv.includes('--verify-only')

const { connectTenant } = require(path.join(backendDir, 'db', 'tenantConnections'))
const User = require(path.join(backendDir, 'models', 'User'))

function generatePassword() {
  return crypto.randomBytes(24).toString('base64url')
}

function runGh(args, input) {
  const result = spawnSync('gh', args, {
    cwd: rootDir,
    encoding: 'utf8',
    input,
    shell: process.platform === 'win32',
    env: process.env,
  })

  if (result.status !== 0) {
    const message = [result.stderr, result.stdout].filter(Boolean).join('\n').trim()
    throw new Error(message || `gh ${args.join(' ')} failed`)
  }

  return result.stdout.trim()
}

async function upsertSmokeUser(tenant, password) {
  await connectTenant(tenant)
  const TenantUser = await User.getTenantModel(tenant)
  const email = `${SMOKE_USER_NAME}.${tenant}@system.local`

  let user = await TenantUser.findOne({ name: SMOKE_USER_NAME })
  if (!user) {
    user = await TenantUser.create({
      name: SMOKE_USER_NAME,
      email,
      password,
      role: 'management',
      department: 'management',
      isActive: true,
      notes: 'Automated post-deploy smoke probe (read-only ERP access).',
    })
    return { tenant, action: 'created', id: String(user._id) }
  }

  user.password = password
  user.role = 'management'
  user.department = 'management'
  user.isActive = true
  if (!user.email) user.email = email
  await user.save()
  return { tenant, action: 'updated', id: String(user._id) }
}

async function verifyProductionLogin(tenant, password) {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant': tenant,
      'x-company': tenant,
    },
    body: JSON.stringify({
      company: tenant,
      name: SMOKE_USER_NAME,
      password,
    }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.success !== true) {
    throw new Error(`${tenant.toUpperCase()} login failed (${response.status}): ${body.message || 'unexpected response'}`)
  }

  const cookie = response.headers.getSetCookie
    ? response.headers.getSetCookie().map((entry) => entry.split(';')[0]).join('; ')
    : String(response.headers.get('set-cookie') || '').split(';')[0]

  const erpRes = await fetch(`${API_BASE}/api/erp-accounting/transactions?limit=1`, {
    headers: {
      cookie,
      'x-csrf-token': String(body.csrfToken || ''),
      'x-tenant': tenant,
      'x-company': tenant,
    },
  })
  const erpBody = await erpRes.json().catch(() => ({}))
  if (!erpRes.ok || erpBody.success !== true) {
    throw new Error(`${tenant.toUpperCase()} ERP probe failed (${erpRes.status}): ${erpBody.message || 'unexpected response'}`)
  }

  return `${tenant.toUpperCase()} login + ERP read OK`
}

function setGithubSecrets(password) {
  runGh(['secret', 'set', 'SMOKE_AUTH_NAME', '-R', REPO], `${SMOKE_USER_NAME}\n`)
  runGh(['secret', 'set', 'SMOKE_AUTH_PASSWORD', '-R', REPO], `${password}\n`)

  for (const tenant of TENANTS) {
    runGh(['secret', 'set', `SMOKE_AUTH_NAME_${tenant.toUpperCase()}`, '-R', REPO], `${SMOKE_USER_NAME}\n`)
    runGh(['secret', 'set', `SMOKE_AUTH_PASSWORD_${tenant.toUpperCase()}`, '-R', REPO], `${password}\n`)
  }
}

async function main() {
  const usersOnly = process.argv.includes('--users-only')
  const secretsOnly = process.argv.includes('--secrets-only')

  if (!usersOnly && !process.env.GH_TOKEN && spawnSync('gh', ['auth', 'status'], { encoding: 'utf8', shell: true }).status !== 0) {
    throw new Error('GitHub CLI is not authenticated. Run gh auth login or set GH_TOKEN.')
  }

  for (const tenant of TENANTS) {
    const envVar = `MONGO_URI_${tenant.toUpperCase()}`
    if (!String(process.env[envVar] || '').trim()) {
      throw new Error(`Missing ${envVar} in backend/.env or workflow env`)
    }
  }

  if (!usersOnly) {
    const existingSecrets = runGh(['secret', 'list', '-R', REPO])
    const hasSharedPassword = /\bSMOKE_AUTH_PASSWORD\b/m.test(existingSecrets)

    if (verifyOnly) {
      if (!hasSharedPassword) {
        throw new Error('SMOKE_AUTH_PASSWORD secret is not configured yet.')
      }
      console.log('GitHub smoke secrets are present.')
      return
    }

    if (secretsOnly || !hasSharedPassword) {
      const password = process.env.SMOKE_AUTH_PASSWORD?.trim() || generatePassword()
      console.log(`Setting GitHub secrets on ${REPO}...`)
      setGithubSecrets(password)
      console.log('GitHub smoke auth secrets configured.')
      if (secretsOnly) return
      process.env.SMOKE_AUTH_PASSWORD = password
    }
  }

  const password = String(process.env.SMOKE_AUTH_PASSWORD || '').trim()
  if (!password) {
    throw new Error('SMOKE_AUTH_PASSWORD is required to provision tenant users.')
  }

  console.log(`Provisioning smoke user "${SMOKE_USER_NAME}" in mg/cg/loopc...`)
  for (const tenant of TENANTS) {
    const result = await upsertSmokeUser(tenant, password)
    console.log(`  ${result.tenant.toUpperCase()}: ${result.action} (${result.id})`)
  }

  console.log(`Verifying production login + ERP read against ${API_BASE}...`)
  for (const tenant of TENANTS) {
    const detail = await verifyProductionLogin(tenant, password)
    console.log(`  ${detail}`)
  }

  console.log('Smoke credential provisioning complete.')
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
