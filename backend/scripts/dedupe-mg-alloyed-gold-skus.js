#!/usr/bin/env node
/**
 * MG staging: collapse Title-Case / alternate "Nk Alloyed Gold" inventory rows onto the
 * canonical lowercase "{n}k alloyed gold" SKU (soft-delete + rename duplicates).
 * Non-destructive to stock history — soft-deletes only when a live canonical exists
 * (or renames the preferred row to canonical when none exists).
 *
 * Dry-run:
 *   APP_ENV=staging STAGING_MONGO_URI_MG=… \
 *     node backend/scripts/dedupe-mg-alloyed-gold-skus.js --tenant=mg
 *
 * Apply:
 *   APP_ENV=staging STAGING_MONGO_URI_MG=… \
 *     node backend/scripts/dedupe-mg-alloyed-gold-skus.js --tenant=mg --apply \
 *     --reason="Prefer canonical lowercase alloyed gold SKUs"
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
require('../utils/configureAtlasDns')

const mongoose = require('mongoose')
const { assertStagingOnlyScript } = require('../utils/assertStagingOnlyScript')
const {
  mapStagingMongoToProcessEnv,
  resolveStagingMongoUri,
} = require('../utils/stagingMongoSafety')
const { redactMongoUri } = require('../utils/migrationSafety')

const KARATS = [9, 10, 14, 18, 21, 22, 24]

function hasFlag(name) {
  return process.argv.includes(name)
}

function readArg(name) {
  const prefix = `${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : ''
}

function normalizeKey(name = '') {
  return String(name || '')
    .toLowerCase()
    .replace(/\(duplicate[^)]*\)/gi, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function scoreRow(doc, karat) {
  const key = normalizeKey(doc.name)
  const canonical = normalizeKey(`${karat}k alloyed gold`)
  let score = 0
  if (key === canonical) score += 100
  if (key === normalizeKey(`${karat}k alloy`)) score += 40
  if (!doc.isDeleted) score += 20
  if (Number(doc.quantity || 0) > 0) score += 10
  const purity = Number(String(doc.category || '').match(/productPurity=([0-9.]+)/i)?.[1] || 0)
  if (purity > 0) score += 5
  return score
}

async function main() {
  const tenant = String(readArg('--tenant') || 'mg').trim().toLowerCase() || 'mg'
  const apply = hasFlag('--apply')
  const reason = String(readArg('--reason') || 'Prefer canonical lowercase alloyed gold SKUs').trim()

  if (!process.env.APP_ENV) process.env.APP_ENV = 'staging'
  Object.assign(process.env, mapStagingMongoToProcessEnv(process.env))
  assertStagingOnlyScript({
    scriptName: 'dedupe-mg-alloyed-gold-skus.js',
    tenants: [tenant],
  })

  const uri = resolveStagingMongoUri(tenant)
  console.log(`Target: ${redactMongoUri(uri)}`)
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`)

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 })
  const col = mongoose.connection.db.collection('inventoryitems')
  const now = new Date()
  const plan = []

  for (const karat of KARATS) {
    const canonicalName = `${karat}k alloyed gold`
    const canonicalKey = normalizeKey(canonicalName)
    const candidates = await col.find({
      isDeleted: { $ne: true },
      name: { $regex: new RegExp(`${karat}\\s*k\\s*alloy`, 'i') },
    }).toArray()

    const matched = candidates.filter((doc) => {
      const key = normalizeKey(doc.name)
      return key === canonicalKey
        || key === normalizeKey(`${karat}k alloy`)
        || key.startsWith(canonicalKey)
    })
    if (matched.length <= 1) {
      const only = matched[0]
      if (only && normalizeKey(only.name) !== canonicalKey) {
        plan.push({
          action: 'rename_to_canonical',
          karat,
          id: String(only._id),
          from: only.name,
          to: canonicalName,
        })
      }
      continue
    }

    const ranked = [...matched].sort((a, b) => scoreRow(b, karat) - scoreRow(a, karat))
    const keep = ranked[0]
    if (normalizeKey(keep.name) !== canonicalKey) {
      plan.push({
        action: 'rename_to_canonical',
        karat,
        id: String(keep._id),
        from: keep.name,
        to: canonicalName,
      })
    }
    for (const dup of ranked.slice(1)) {
      plan.push({
        action: 'soft_delete_duplicate',
        karat,
        id: String(dup._id),
        from: dup.name,
        to: `${dup.name} (duplicate — use ${canonicalName})`,
        qty: Number(dup.quantity || 0),
      })
    }
  }

  if (!plan.length) {
    console.log('No alloyed-gold SKU duplicates to fix.')
    await mongoose.disconnect()
    return
  }

  for (const row of plan) {
    console.log(`- ${row.action} [${row.karat}K] ${row.id}: "${row.from}" → "${row.to}"${row.qty != null ? ` qty=${row.qty}` : ''}`)
  }

  if (!apply) {
    console.log(`Dry-run complete (${plan.length} change(s)). Re-run with --apply to write.`)
    await mongoose.disconnect()
    return
  }

  let updated = 0
  for (const row of plan) {
    if (row.action === 'rename_to_canonical') {
      const result = await col.updateOne(
        { _id: new mongoose.Types.ObjectId(row.id), isDeleted: { $ne: true } },
        { $set: { name: row.to, updatedAt: now } },
      )
      updated += result.modifiedCount || 0
    } else if (row.action === 'soft_delete_duplicate') {
      const result = await col.updateOne(
        { _id: new mongoose.Types.ObjectId(row.id), isDeleted: { $ne: true } },
        {
          $set: {
            name: row.to,
            isDeleted: true,
            deletedAt: now,
            deletionReason: reason,
            updatedAt: now,
          },
        },
      )
      updated += result.modifiedCount || 0
    }
  }

  console.log(`Applied ${updated}/${plan.length} change(s).`)
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
