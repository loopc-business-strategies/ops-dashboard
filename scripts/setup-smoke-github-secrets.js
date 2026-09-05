#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Creates read-only smoke probe users in each tenant DB and stores credentials
 * in GitHub Actions secrets for post-deploy smoke tests.
 *
 * Staging-only. Requires:
 *   - --staging
 *   - APP_ENV=staging (set by this script)
 *   - STAGING_MONGO_URI_MG, STAGING_MONGO_URI_CG, STAGING_MONGO_URI_LOOPC
 *   - gh authenticated (GH_TOKEN or gh auth login) with repo admin access
 *
 * Usage:
 *   node scripts/setup-smoke-github-secrets.js --staging
 *   node scripts/setup-smoke-github-secrets.js --staging --verify-only
 *   node scripts/setup-smoke-github-secrets.js --staging --reactivate-only
 */

const { spawnSync } = require('node:child_process')
const crypto = require('node:crypto')
const dns = require('node:dns')
const path = require('node:path')

if (process.platform === 'win32') {
  // Windows local DNS sometimes refuses SRV lookups Node needs for mongodb+srv URIs.
  dns.setServers(['8.8.8.8', '1.1.1.1'])
}

const rootDir = path.resolve(__dirname, '..')
const backendDir = path.join(rootDir, 'backend')
const isStaging = process.argv.includes('--staging')
const skipBackendDotenv = isStaging && ['STAGING_MONGO_URI_MG', 'STAGING_MONGO_URI_CG', 'STAGING_MONGO_URI_LOOPC'].every(
  (key) => String(process.env[key] || '').trim(),
)

if (!skipBackendDotenv) {
  require(path.join(backendDir, 'node_modules', 'dotenv')).config({
    path: path.join(backendDir, '.env.staging.local'),
  })
  require(path.join(backendDir, 'node_modules', 'dotenv')).config({
    path: path.join(backendDir, '.env'),
  })
}

const TENANTS = ['mg', 'cg', 'loopc']
const REPO = process.env.GITHUB_REPOSITORY || 'loopc-business-strategies/ops-dashboard'
const SECRET_PREFIX = isStaging ? 'STAGING_SMOKE_' : 'SMOKE_'
const DEFAULT_USER_NAME = isStaging ? 'ops-staging-smoke-probe' : 'ops-smoke-probe'
const DEFAULT_API_BASE = isStaging
  ? 'https://ops-dashboard-staging-e6c6.up.railway.app'
  : 'https://api.loopcstrategies.com'
const SMOKE_USER_NAME = String(
  process.env.SMOKE_AUTH_NAME
  || process.env[`${SECRET_PREFIX}AUTH_NAME`]
  || DEFAULT_USER_NAME,
).trim()
const API_BASE = (
  process.env.SMOKE_API_BASE
  || process.env.STAGING_SMOKE_API_BASE
  || DEFAULT_API_BASE
).replace(/\/$/, '')
const verifyOnly = process.argv.includes('--verify-only')

function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function smokeAuthNameForTenant(tenant) {
  const key = String(tenant || '').trim().toUpperCase()
  return String(
    process.env[`SMOKE_AUTH_NAME_${key}`]
    || process.env[`${SECRET_PREFIX}AUTH_NAME_${key}`]
    || SMOKE_USER_NAME,
  ).trim()
}

function smokePasswordForTenant(tenant, fallbackPassword = '') {
  const key = String(tenant || '').trim().toUpperCase()
  return String(
    process.env[`SMOKE_AUTH_PASSWORD_${key}`]
    || process.env[`${SECRET_PREFIX}AUTH_PASSWORD_${key}`]
    || fallbackPassword,
  ).trim()
}

async function findSmokeUser(TenantUser, userName, { includePassword = false } = {}) {
  const safe = escapeRegex(userName)
  const query = TenantUser.findOne({
    name: { $regex: new RegExp(`^${safe}$`, 'i') },
  })
  if (includePassword) query.select('+password')
  return query
}

const { connectTenant, closeAllTenantConnections } = require(path.join(backendDir, 'db', 'tenantConnections'))
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

function applySmokeUserAccess(user) {
  user.role = 'management'
  user.department = 'management'
  // Frontend ERP tabs require module access; matrix alone is not enough for the UI.
  const modules = Array.isArray(user.allowedModules) ? user.allowedModules.map(String) : []
  if (!modules.includes('erp')) modules.push('erp')
  user.allowedModules = modules
  user.modulePermissions = {
    ...(user.modulePermissions && typeof user.modulePermissions === 'object' ? user.modulePermissions : {}),
    erp: { on: true, subs: {} },
  }
}

async function reactivateSmokeUser(tenant) {
  const userName = smokeAuthNameForTenant(tenant)
  await connectTenant(tenant)
  const TenantUser = await User.getTenantModel(tenant)
  const user = await findSmokeUser(TenantUser, userName)
  if (!user) {
    return { tenant, userName, action: 'missing', id: null }
  }
  user.isActive = true
  user.isDeleted = false
  user.deletedAt = null
  user.deletedBy = null
  user.deletedByName = ''
  user.deletionReason = ''
  applySmokeUserAccess(user)
  await user.save()
  return { tenant, userName, action: 'reactivated', id: String(user._id) }
}

async function upsertSmokeUser(tenant, password) {
  const userName = smokeAuthNameForTenant(tenant)
  await connectTenant(tenant)
  const TenantUser = await User.getTenantModel(tenant)
  const email = `${userName}.${tenant}@system.local`

  let user = await findSmokeUser(TenantUser, userName, { includePassword: true })
  if (!user) {
    user = await TenantUser.create({
      name: userName,
      email,
      password,
      role: 'management',
      department: 'management',
      allowedModules: ['erp'],
      modulePermissions: { erp: { on: true, subs: {} } },
      isActive: true,
      notes: isStaging
        ? 'Automated staging smoke probe (read-only ERP access).'
        : 'Automated post-deploy smoke probe (read-only ERP access).',
    })
    return { tenant, userName, action: 'created', id: String(user._id) }
  }

  // Avoid rewriting an identical password — User pre-save would set sessionInvalidatedAt and revoke live JWTs.
  const passwordMatches = Boolean(user.password) && (await user.comparePassword(password))
  if (!passwordMatches) {
    user.password = password
  }
  applySmokeUserAccess(user)
  user.isActive = true
  user.isDeleted = false
  user.deletedAt = null
  user.deletedBy = null
  user.deletedByName = ''
  user.deletionReason = ''
  if (!user.email) user.email = email
  await user.save()
  return {
    tenant,
    userName,
    action: passwordMatches ? 'updated' : 'updated-password',
    id: String(user._id),
  }
}

const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 20000)

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function verifySmokeLogin(tenant, password, userName = smokeAuthNameForTenant(tenant)) {
  const response = await fetchWithTimeout(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant': tenant,
      'x-company': tenant,
    },
    body: JSON.stringify({
      company: tenant,
      name: userName,
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

  const erpRes = await fetchWithTimeout(`${API_BASE}/api/erp-accounting/transactions?limit=1`, {
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
  runGh(['secret', 'set', `${SECRET_PREFIX}AUTH_NAME`, '-R', REPO], `${SMOKE_USER_NAME}\n`)
  runGh(['secret', 'set', `${SECRET_PREFIX}AUTH_PASSWORD`, '-R', REPO], `${password}\n`)

  for (const tenant of TENANTS) {
    runGh(['secret', 'set', `${SECRET_PREFIX}AUTH_NAME_${tenant.toUpperCase()}`, '-R', REPO], `${SMOKE_USER_NAME}\n`)
    runGh(['secret', 'set', `${SECRET_PREFIX}AUTH_PASSWORD_${tenant.toUpperCase()}`, '-R', REPO], `${password}\n`)
  }

  if (isStaging) {
    runGh(['variable', 'set', 'STAGING_SMOKE_REQUIRE_AUTH', '-R', REPO], 'true\n')
    runGh(['variable', 'set', 'STAGING_SMOKE_REQUIRE_MOBILE_AUTH', '-R', REPO], 'true\n')
  }
}

async function main() {
  const usersOnly = process.argv.includes('--users-only')
  const reactivateOnly = process.argv.includes('--reactivate-only')
  const secretsOnly = process.argv.includes('--secrets-only')
  const skipVerify = process.argv.includes('--skip-verify')
    || process.argv.includes('--skip-production-verify')

  if (!isStaging) {
    throw new Error(
      'Refusing: smoke user provisioning/reactivation is staging-only. '
      + 'Pass --staging with APP_ENV=staging and dedicated STAGING_MONGO_URI_MG/CG/LOOPC. '
      + 'Production database mutation is impossible.',
    )
  }

  process.env.APP_ENV = 'staging'
  const { assertStagingOnlyScript } = require(path.join(backendDir, 'utils', 'assertStagingOnlyScript.js'))
  assertStagingOnlyScript({
    scriptName: 'setup-smoke-github-secrets.js',
    tenants: TENANTS,
  })

  if (!usersOnly && !reactivateOnly && !process.env.GH_TOKEN && spawnSync('gh', ['auth', 'status'], { encoding: 'utf8', shell: true }).status !== 0) {
    throw new Error('GitHub CLI is not authenticated. Run gh auth login or set GH_TOKEN.')
  }

  if (reactivateOnly) {
    for (const tenant of TENANTS) {
      const envVar = `STAGING_MONGO_URI_${tenant.toUpperCase()}`
      const uri = String(process.env[envVar] || '').trim()
      if (!uri) {
        throw new Error(`Missing ${envVar}. Do not use MONGO_URI_* as a staging substitute.`)
      }
      // assertStagingOnlyScript already mapped STAGING → MONGO_URI_*; keep explicit.
      process.env[`MONGO_URI_${tenant.toUpperCase()}`] = uri
    }

    console.log('Reactivating staging smoke users in mg/cg/loopc (no password change)...')
    for (const tenant of TENANTS) {
      const result = await reactivateSmokeUser(tenant)
      console.log(`  ${result.tenant.toUpperCase()} (${result.userName}): ${result.action}${result.id ? ` (${result.id})` : ''}`)
      if (result.action === 'missing') {
        throw new Error(`Smoke user "${result.userName}" not found in ${tenant.toUpperCase()}. Run full provisioning first.`)
      }
    }
    if (skipVerify) {
      console.log('Skipping login/ERP verification (--skip-verify).')
      console.log('Smoke user reactivation complete.')
      return
    }
    const password = String(
      process.env.SMOKE_AUTH_PASSWORD
      || process.env[`${SECRET_PREFIX}AUTH_PASSWORD`]
      || '',
    ).trim()
    if (!password) {
      throw new Error(
        `${SECRET_PREFIX}AUTH_PASSWORD is required to verify login after reactivation. `
        + 'Set env or run with --skip-verify.',
      )
    }
    console.log(`Verifying login + ERP read against ${API_BASE}...`)
    for (const tenant of TENANTS) {
      const tenantPassword = smokePasswordForTenant(tenant, password)
      const detail = await verifySmokeLogin(tenant, tenantPassword)
      console.log(`  ${detail}`)
    }
    console.log('Smoke user reactivation complete.')
    return
  }

  for (const tenant of TENANTS) {
    const envVar = `STAGING_MONGO_URI_${tenant.toUpperCase()}`
    const uri = String(process.env[envVar] || '').trim()
    if (!uri) {
      throw new Error(`Missing ${envVar}. Do not use MONGO_URI_* as a staging substitute.`)
    }
    process.env[`MONGO_URI_${tenant.toUpperCase()}`] = uri
  }

  // Staging URI already validated via assertStagingOnlyScript at main() entry.

  const passwordSecretName = `${SECRET_PREFIX}AUTH_PASSWORD`

  if (!usersOnly) {
    const existingSecrets = runGh(['secret', 'list', '-R', REPO])
    const hasSharedPassword = new RegExp(`\\b${passwordSecretName}\\b`, 'm').test(existingSecrets)

    if (verifyOnly) {
      if (!hasSharedPassword) {
        throw new Error(`${passwordSecretName} secret is not configured yet.`)
      }
      console.log(`${isStaging ? 'Staging' : 'Production'} smoke secrets are present.`)
      return
    }

    if (secretsOnly || !hasSharedPassword) {
      const password = process.env.SMOKE_AUTH_PASSWORD?.trim()
        || process.env[`${SECRET_PREFIX}AUTH_PASSWORD`]?.trim()
        || generatePassword()
      console.log(`Setting GitHub secrets on ${REPO} (${isStaging ? 'staging' : 'production'})...`)
      setGithubSecrets(password)
      console.log('GitHub smoke auth secrets configured.')
      if (secretsOnly) return
      process.env.SMOKE_AUTH_PASSWORD = password
    }
  }

  const password = String(
    process.env.SMOKE_AUTH_PASSWORD
    || process.env[`${SECRET_PREFIX}AUTH_PASSWORD`]
    || '',
  ).trim()
  if (!password) {
    throw new Error(`${passwordSecretName} is required to provision tenant users.`)
  }

  console.log(`Provisioning ${isStaging ? 'staging' : 'production'} smoke users in mg/cg/loopc...`)
  for (const tenant of TENANTS) {
    const tenantPassword = smokePasswordForTenant(tenant, password)
    const result = await upsertSmokeUser(tenant, tenantPassword)
    console.log(`  ${result.tenant.toUpperCase()} (${result.userName}): ${result.action} (${result.id})`)
  }

  if (skipVerify) {
    console.log('Skipping login/ERP verification (--skip-verify).')
    console.log('Smoke credential provisioning complete.')
    return
  }

  console.log(`Verifying login + ERP read against ${API_BASE}...`)
  for (const tenant of TENANTS) {
    const tenantPassword = smokePasswordForTenant(tenant, password)
    const detail = await verifySmokeLogin(tenant, tenantPassword)
    console.log(`  ${detail}`)
  }

  console.log('Smoke credential provisioning complete.')
}

async function shutdown() {
  await closeAllTenantConnections()
}

main()
  .then(shutdown)
  .then(() => process.exit(0))
  .catch(async (error) => {
    await closeAllTenantConnections().catch(() => {})
    console.error(error.message || error)
    process.exit(1)
  })
