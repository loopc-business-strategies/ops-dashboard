/**
 * Upsert / harden the existing MG HR portal user for HR-only access.
 *
 * Sets:
 *   role: department_head
 *   department: hr
 *   allowedModules: ['hr']
 *   modulePermissions: {}
 *   password from MG_HR_PASSWORD or TARGET_PASSWORD
 *
 * Dry-run (no writes):
 *   node backend/scripts/upsert-mg-hr-user.js
 *
 * Apply:
 *   MG_HR_PASSWORD='…' I_UNDERSTAND=UPSERT-MG-HR-USER \
 *     node backend/scripts/upsert-mg-hr-user.js --apply --reason="Lock MG HR user to HR portal"
 *
 * Staging:
 *   APP_ENV=staging STAGING_MONGO_URI_MG=… MG_HR_PASSWORD=… \
 *     node backend/scripts/upsert-mg-hr-user.js --apply --staging --reason="Lock MG HR user staging"
 *
 * Does not print passwords.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
require('../utils/configureAtlasDns')

const bcrypt = require('bcryptjs')
const mongoose = require('mongoose')
const User = require('../models/User')
const { getTenantUri } = require('../config/tenants')
const {
  mapStagingMongoToProcessEnv,
  assertStagingMongoTargets,
} = require('../utils/stagingMongoSafety')
const { looksLikeNonProductionUri, redactMongoUri } = require('../utils/migrationSafety')

const TENANT = 'mg'
const TARGET_NAME = 'HR'
const TARGET_EMAIL = 'hr@system.local'
const TARGET_PASSWORD = String(process.env.MG_HR_PASSWORD || process.env.TARGET_PASSWORD || '').trim()

function readArg(name) {
  const prefix = `${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : ''
}

function hasFlag(name) {
  return process.argv.includes(name)
}

async function main() {
  const apply = hasFlag('--apply')
  const staging = hasFlag('--staging')
  const reason = String(readArg('--reason') || '').trim()

  if (staging) {
    process.env.APP_ENV = 'staging'
    assertStagingMongoTargets([TENANT])
    Object.assign(process.env, mapStagingMongoToProcessEnv(process.env))
  } else if (apply) {
    if (String(process.env.I_UNDERSTAND || '').trim() !== 'UPSERT-MG-HR-USER') {
      throw new Error('Refusing production upsert without I_UNDERSTAND=UPSERT-MG-HR-USER')
    }
  }

  const uri = getTenantUri(TENANT)
  if (!uri) throw new Error('MONGO_URI_MG is not set.')

  if (!staging && looksLikeNonProductionUri(uri)) {
    console.warn(`[warn] URI for ${TENANT} looks non-production: ${redactMongoUri(uri)}`)
  } else {
    console.log(`[${staging ? 'staging' : 'prod'}] target ${TENANT}: ${redactMongoUri(uri)}`)
  }

  const Model = await User.getTenantModel(TENANT)
  const existing = await Model.findOne({ name: { $regex: '^hr$', $options: 'i' } })
    .select('name email role department allowedModules modulePermissions isDeleted')
    .lean()

  console.log(JSON.stringify({
    tenant: TENANT,
    found: Boolean(existing),
    previous: existing
      ? {
          name: existing.name,
          email: existing.email,
          role: existing.role,
          department: existing.department,
          allowedModules: existing.allowedModules || [],
          hasModulePermissions: Object.keys(existing.modulePermissions || {}).length > 0,
        }
      : null,
    target: {
      name: TARGET_NAME,
      email: TARGET_EMAIL,
      role: 'department_head',
      department: 'hr',
      allowedModules: ['hr'],
      modulePermissions: {},
    },
    apply,
  }, null, 2))

  if (!apply) {
    console.log('Dry-run only. Pass --apply with MG_HR_PASSWORD (or TARGET_PASSWORD) and --reason to write.')
    await mongoose.disconnect().catch(() => {})
    return
  }

  if (!TARGET_PASSWORD || TARGET_PASSWORD.length < 6) {
    throw new Error('MG_HR_PASSWORD or TARGET_PASSWORD is required (min 6 chars) when using --apply.')
  }
  if (reason.length < 10) {
    throw new Error('--reason with at least 10 characters is required.')
  }

  const hash = await bcrypt.hash(TARGET_PASSWORD, 12)
  await Model.updateOne(
    { name: { $regex: '^hr$', $options: 'i' } },
    {
      $set: {
        name: TARGET_NAME,
        email: TARGET_EMAIL,
        password: hash,
        role: 'department_head',
        department: 'hr',
        allowedModules: ['hr'],
        modulePermissions: {},
        company: TENANT,
        isDeleted: false,
        title: existing?.title || 'Human Resources',
        fullName: existing?.fullName || 'HR',
      },
      $unset: { deletedAt: 1 },
    },
    { upsert: true },
  )

  const after = await Model.findOne({ name: { $regex: '^hr$', $options: 'i' } })
    .select('+password name email role department allowedModules modulePermissions')
    .exec()

  const passwordOk = after ? await after.comparePassword(TARGET_PASSWORD) : false

  console.log(JSON.stringify({
    tenant: TENANT,
    reason,
    action: existing ? 'updated' : 'created',
    name: after?.name,
    email: after?.email,
    role: after?.role,
    department: after?.department,
    allowedModules: after?.allowedModules || [],
    modulePermissionsCleared: Object.keys(after?.modulePermissions || {}).length === 0,
    passwordMatchesTarget: passwordOk,
  }, null, 2))

  await mongoose.disconnect().catch(() => {})
}

main().catch(async (err) => {
  console.error(err.message || err)
  try { await mongoose.disconnect() } catch { /* ignore */ }
  process.exit(1)
})
