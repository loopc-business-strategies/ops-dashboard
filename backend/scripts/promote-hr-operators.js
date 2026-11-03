/**
 * Promote misconfigured HR operators to department_head + department hr.
 *
 * Finds active users with department=hr (or HR module access) who are still
 * department_user — those accounts can open HR but cannot mark attendance.
 *
 * Does NOT change passwords.
 *
 * Dry-run (default):
 *   node backend/scripts/promote-hr-operators.js
 *   node backend/scripts/promote-hr-operators.js --tenant=mg
 *
 * Apply:
 *   I_UNDERSTAND=PROMOTE-HR-OPERATORS \
 *     node backend/scripts/promote-hr-operators.js --apply --reason="Promote HR operators"
 *
 * Staging:
 *   APP_ENV=staging STAGING_MONGO_URI_MG=… \
 *     node backend/scripts/promote-hr-operators.js --apply --staging --tenant=mg --reason="…"
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
require('../utils/configureAtlasDns')

const mongoose = require('mongoose')
const User = require('../models/User')
const { getTenantUri } = require('../config/tenants')
const {
  mapStagingMongoToProcessEnv,
  assertStagingMongoTargets,
} = require('../utils/stagingMongoSafety')
const { looksLikeNonProductionUri, redactMongoUri } = require('../utils/migrationSafety')

const DEFAULT_TENANTS = ['mg', 'loopc']

function readArg(name) {
  const prefix = `${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : ''
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function normalizeDept(value) {
  return String(value || '').trim().toLowerCase()
}

function isHrScoped(user) {
  if (normalizeDept(user.department) === 'hr') return true
  if ((user.allowedModules || []).map((m) => String(m).toLowerCase()).includes('hr')) return true
  if (user.modulePermissions?.hr?.on === true) return true
  return false
}

async function promoteTenant(tenant, { apply }) {
  const uri = getTenantUri(tenant)
  if (!uri) {
    return { tenant, skipped: true, reason: 'no uri' }
  }

  if (!hasFlag('--staging') && looksLikeNonProductionUri(uri)) {
    console.warn(`[warn] URI for ${tenant} looks non-production: ${redactMongoUri(uri)}`)
  } else {
    console.log(`[${hasFlag('--staging') ? 'staging' : 'prod'}] ${tenant}: ${redactMongoUri(uri)}`)
  }

  const Model = await User.getTenantModel(tenant)
  const candidates = await Model.find({
    role: 'department_user',
    isDeleted: { $ne: true },
  })
    .select('name email role department allowedModules modulePermissions')
    .lean()

  const toPromote = candidates.filter(isHrScoped)

  const results = []
  for (const user of toPromote) {
    const update = {
      role: 'department_head',
      department: 'hr',
    }
    const nextAllowed = Array.isArray(user.allowedModules) ? [...user.allowedModules] : []
    if (!nextAllowed.map((m) => String(m).toLowerCase()).includes('hr')) {
      nextAllowed.push('hr')
    }
    update.allowedModules = nextAllowed
    // Clear granular HR write blockers so attendance mark uses HR-head legacy path.
    if (user.modulePermissions && Object.keys(user.modulePermissions).length > 0) {
      update.modulePermissions = {}
    }

    if (apply) {
      await Model.updateOne({ _id: user._id }, { $set: update })
    }

    results.push({
      name: user.name,
      email: user.email,
      previous: {
        role: user.role,
        department: user.department,
        allowedModules: user.allowedModules || [],
        hasModulePermissions: Object.keys(user.modulePermissions || {}).length > 0,
      },
      next: update,
      applied: apply,
    })
  }

  return { tenant, promoted: results.length, users: results }
}

async function main() {
  const apply = hasFlag('--apply')
  const staging = hasFlag('--staging')
  const reason = String(readArg('--reason') || '').trim()
  const tenantArg = String(readArg('--tenant') || '').trim().toLowerCase()
  const tenants = tenantArg ? [tenantArg] : DEFAULT_TENANTS

  if (staging) {
    process.env.APP_ENV = 'staging'
    assertStagingMongoTargets(tenants)
    Object.assign(process.env, mapStagingMongoToProcessEnv(process.env))
  } else if (apply) {
    if (String(process.env.I_UNDERSTAND || '').trim() !== 'PROMOTE-HR-OPERATORS') {
      throw new Error('Refusing production promote without I_UNDERSTAND=PROMOTE-HR-OPERATORS')
    }
  }

  if (apply && reason.length < 10) {
    throw new Error('--reason with at least 10 characters is required when using --apply.')
  }

  const summary = []
  for (const tenant of tenants) {
    summary.push(await promoteTenant(tenant, { apply }))
  }

  console.log(JSON.stringify({ apply, reason: reason || null, summary }, null, 2))

  if (!apply) {
    console.log('Dry-run only. Pass --apply with I_UNDERSTAND=PROMOTE-HR-OPERATORS and --reason to write.')
  }

  await mongoose.disconnect().catch(() => {})
}

main().catch(async (err) => {
  console.error(err.message || err)
  try { await mongoose.disconnect() } catch { /* ignore */ }
  process.exit(1)
})
