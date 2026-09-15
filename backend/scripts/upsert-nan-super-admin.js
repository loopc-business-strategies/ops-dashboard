/**
 * Upsert Super Admin Nan on a single tenant (default vb).
 * Used to match MG/CG/LoopC Nan login for Venus Bullions.
 *
 * Production (via Railway env with MONGO_URI_VB):
 *   I_UNDERSTAND=UPSERT-NAN-SUPER-ADMIN TARGET_PASSWORD=... node backend/scripts/upsert-nan-super-admin.js --tenant=vb --apply --reason="Add VB Nan super admin"
 *
 * Staging:
 *   APP_ENV=staging STAGING_MONGO_URI_VB=... TARGET_PASSWORD=... \
 *   node backend/scripts/upsert-nan-super-admin.js --tenant=vb --apply --reason="Add VB Nan super admin staging" --staging
 *
 * Does not print passwords. Does not delete other users.
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

const TARGET_NAME = 'Nan'
const TARGET_EMAIL = 'nan@system.local'
const TARGET_PASSWORD = String(process.env.TARGET_PASSWORD || process.env.NAN_PASSWORD || '').trim()

function readArg(name) {
  const prefix = `${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : ''
}

function hasFlag(name) {
  return process.argv.includes(name)
}

async function main() {
  const tenant = String(readArg('--tenant') || 'vb').trim().toLowerCase()
  const apply = hasFlag('--apply')
  const staging = hasFlag('--staging')
  const reason = String(readArg('--reason') || '').trim()

  if (!['mg', 'cg', 'loopc', 'vb'].includes(tenant)) {
    throw new Error(`Unsupported tenant: ${tenant}`)
  }
  if (!TARGET_PASSWORD) {
    throw new Error('TARGET_PASSWORD or NAN_PASSWORD is required.')
  }
  if (!apply) {
    throw new Error('Pass --apply to upsert. Dry preview is not supported for password writes.')
  }
  if (reason.length < 10) {
    throw new Error('--reason with at least 10 characters is required.')
  }

  if (staging) {
    process.env.APP_ENV = 'staging'
    assertStagingMongoTargets([tenant])
    Object.assign(process.env, mapStagingMongoToProcessEnv(process.env))
  } else {
    // Production / live URI path — require explicit intent phrase.
    if (String(process.env.I_UNDERSTAND || '').trim() !== 'UPSERT-NAN-SUPER-ADMIN') {
      throw new Error(
        'Refusing production upsert without I_UNDERSTAND=UPSERT-NAN-SUPER-ADMIN',
      )
    }
    const uri = getTenantUri(tenant)
    if (!uri) throw new Error(`MONGO_URI_${tenant.toUpperCase()} is not set.`)
    if (looksLikeNonProductionUri(uri)) {
      console.warn(`[warn] URI for ${tenant} looks non-production: ${redactMongoUri(uri)}`)
    } else {
      console.log(`[prod] target ${tenant}: ${redactMongoUri(uri)}`)
    }
  }

  const uri = getTenantUri(tenant)
  if (!uri) throw new Error(`No Mongo URI configured for tenant ${tenant}`)

  console.log(`[upsert-nan] tenant=${tenant} staging=${staging} reason=${JSON.stringify(reason)}`)
  console.log(`[upsert-nan] uri=${redactMongoUri(uri)}`)

  const Model = await User.getTenantModel(tenant)
  const hash = await bcrypt.hash(TARGET_PASSWORD, 12)

  const existing = await Model.findOne({ name: { $regex: '^nan$', $options: 'i' } })
    .select('name email role company isDeleted')
    .lean()

  await Model.updateOne(
    { name: { $regex: '^nan$', $options: 'i' } },
    {
      $set: {
        name: TARGET_NAME,
        email: TARGET_EMAIL,
        password: hash,
        role: 'super_admin',
        company: tenant,
        isDeleted: false,
        department: '',
      },
      $unset: { deletedAt: 1 },
    },
    { upsert: true },
  )

  const after = await Model.findOne({ name: { $regex: '^nan$', $options: 'i' } })
    .select('+password name email role company')
    .exec()

  const passwordOk = after ? await after.comparePassword(TARGET_PASSWORD) : false

  console.log(JSON.stringify({
    tenant,
    staging,
    previous: existing ? { name: existing.name, role: existing.role, email: existing.email } : null,
    action: existing ? 'updated' : 'created',
    name: after?.name,
    role: after?.role,
    email: after?.email,
    passwordMatchesTarget: passwordOk,
  }, null, 2))

  await mongoose.disconnect().catch(() => {})
}

main().catch(async (err) => {
  console.error(err.message || err)
  try { await mongoose.disconnect() } catch { /* ignore */ }
  process.exit(1)
})
