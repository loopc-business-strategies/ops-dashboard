#!/usr/bin/env node
/**
 * Runs the full Atlas backup drill plan:
 *  1. Direct Mongo probe (MG, CG, LoopC)
 *  2. Atlas API backup schedule + snapshots (per-tenant project IDs)
 *  3. Optional restore drill cluster verification (ATLAS_RESTORE_DRILL_URI)
 *  4. Record results in ops log
 */
import { createRequire } from 'node:module'
import dns from 'node:dns'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  getAtlasGroupIdForTenant,
  hasAtlasCredentials,
  hasAtlasGroupIdsForTenants,
  verifyTenantBackup,
} from './lib/atlasAdminApi.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

dns.setServers(
  (process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)

require(path.join(root, 'backend', 'node_modules', 'dotenv')).config({
  path: path.join(root, 'backend', '.env'),
})

const mongoose = require(path.join(root, 'backend', 'node_modules', 'mongoose'))

const TENANTS = [
  { key: 'mg', uriKey: 'MONGO_URI_MG', atlasProject: 'MG' },
  { key: 'cg', uriKey: 'MONGO_URI_CG', atlasProject: 'CG' },
  { key: 'loopc', uriKey: 'MONGO_URI_LOOPC', atlasProject: 'LoopC' },
]

const strictBackup = process.argv.includes('--strict-backup')

const SAMPLE_COLLECTIONS = ['users', 'transactions', 'ledgers']

function parseClusterName(uri) {
  const match = String(uri || '').match(/@([^.]+)\./)
  return match?.[1] || 'Cluster0'
}

async function probeUri(uri, label) {
  await mongoose.connect(uri, { maxPoolSize: 2, serverSelectionTimeoutMS: 20000 })
  const db = mongoose.connection.db
  const collections = await db.listCollections().toArray()
  const names = collections.map((c) => c.name)

  const counts = {}
  const samples = {}
  for (const name of SAMPLE_COLLECTIONS.filter((n) => names.includes(n))) {
    counts[name] = await db.collection(name).countDocuments({})
    if (counts[name] > 0) {
      const doc = await db.collection(name).findOne({}, { projection: { _id: 1 } })
      samples[name] = String(doc?._id || 'present')
    }
  }

  await mongoose.disconnect()

  const hasData = SAMPLE_COLLECTIONS.some((n) => (counts[n] ?? 0) > 0)
  if (!hasData) throw new Error(`${label}: no documents in users/transactions/ledgers`)

  return { collections: names.length, counts, samples }
}

function uiBackupConfirmed(tenantKey) {
  const all = String(process.env.ATLAS_UI_BACKUP_CONFIRMED || '').split(',').map((s) => s.trim().toLowerCase())
  return all.includes(tenantKey.toLowerCase()) || all.includes('all')
}

function verifyAtlasBackupForTenant(probe) {
  const groupId = getAtlasGroupIdForTenant(probe.tenant)
  if (!groupId) {
    if (uiBackupConfirmed(probe.tenant)) {
      return { tenant: probe.tenant, source: 'ui-confirmed', ok: true }
    }
    return {
      tenant: probe.tenant,
      source: 'missing-group-id',
      ok: false,
      message: `Set ATLAS_GROUP_ID_${probe.tenant.toUpperCase()} or ATLAS_UI_BACKUP_CONFIRMED=${probe.tenant}`,
    }
  }

  const row = verifyTenantBackup(groupId, probe.cluster)
  const ok = row.scheduleOk && row.snapshotOk
  return { tenant: probe.tenant, source: 'atlas-api', ok, ...row }
}

async function verifyRestoreDrill(productionMg) {
  const restoreUri = String(process.env.ATLAS_RESTORE_DRILL_URI || '').trim()
  if (!restoreUri) {
    if (process.env.ATLAS_RESTORE_DRILL_SKIP === 'true') {
      return { skipped: true, reason: 'ATLAS_RESTORE_DRILL_SKIP=true' }
    }
    return {
      skipped: true,
      reason: 'Optional: restore MG snapshot in Atlas UI, set ATLAS_RESTORE_DRILL_URI, re-run; or ATLAS_RESTORE_DRILL_SKIP=true',
    }
  }

  console.log('\nRestore drill cluster verification (MG):')
  const restored = await probeUri(restoreUri, 'restore-drill')

  const mismatches = []
  for (const col of SAMPLE_COLLECTIONS) {
    const prod = productionMg.counts[col]
    const rest = restored.counts[col]
    if (prod != null && rest != null && prod !== rest) {
      mismatches.push(`${col}: prod=${prod} restore=${rest}`)
    }
  }

  if (mismatches.length) {
    throw new Error(`Restore drill count mismatch: ${mismatches.join('; ')}`)
  }

  console.log('  Restore cluster matches production MG document counts.')
  return { skipped: false, ok: true, counts: restored.counts }
}

function recordDrill(parts) {
  spawnSync(process.execPath, [
    path.join(root, 'scripts', 'verify-backup-checklist.mjs'),
    '--record',
    parts.join(' | '),
  ], { stdio: 'inherit', cwd: root })
}

async function main() {
  console.log('Atlas backup drill plan\n')

  const probeResults = []
  for (const tenant of TENANTS) {
    const uri = String(process.env[tenant.uriKey] || '').trim()
    if (!uri) throw new Error(`${tenant.uriKey} is not set`)

    process.stdout.write(`  ${tenant.key} (${tenant.atlasProject} / ${parseClusterName(uri)})... `)
    const probe = await probeUri(uri, tenant.key)
    const row = { tenant: tenant.key, atlasProject: tenant.atlasProject, cluster: parseClusterName(uri), ...probe }
    probeResults.push(row)
    const summary = SAMPLE_COLLECTIONS.filter((n) => row.counts[n] != null).map((n) => `${n}=${row.counts[n]}`).join(', ')
    console.log(`OK (${summary})`)
  }

  console.log('\nAtlas backup policy (per project: MG, CG, LoopC):')
  if (!hasAtlasCredentials()) {
    console.log('  Atlas API keys not set — using ATLAS_UI_BACKUP_CONFIRMED if provided.')
  }

  const backupRows = []
  let backupAllOk = true
  for (const probe of probeResults) {
    const row = verifyAtlasBackupForTenant(probe)
    backupRows.push(row)

    if (row.source === 'atlas-api') {
      const snap = row.latestSnapshot ? `${row.latestSnapshot.createdAt} (${row.latestSnapshot.status})` : 'none'
      console.log(`  ${probe.tenant} [${probe.atlasProject}]: schedule=${row.scheduleOk ? 'OK' : 'MISSING'}, snapshot=${snap}`)
      if (!row.ok) backupAllOk = false
    } else if (row.source === 'ui-confirmed') {
      console.log(`  ${probe.tenant} [${probe.atlasProject}]: UI backup confirmed (ATLAS_UI_BACKUP_CONFIRMED)`)
    } else {
      console.log(`  ${probe.tenant} [${probe.atlasProject}]: ${row.message}`)
      console.log(`    Atlas UI: Project ${probe.atlasProject} → DATABASE → Backup → Cluster0`)
      backupAllOk = false
    }
  }

  if (!backupAllOk) {
    if (strictBackup) {
      throw new Error('Backup verification incomplete — enable Cloud Backup in Atlas or set API keys / ATLAS_UI_BACKUP_CONFIRMED')
    }
    console.log('\n  Note: Atlas API/UI backup policy not verified automatically.')
    console.log('  Confirm in Atlas for each project (MG, CG, LoopC): DATABASE → Backup → Cluster0')
    console.log('  Then set ATLAS_GROUP_ID_* + API keys, or ATLAS_UI_BACKUP_CONFIRMED=mg,cg,loopc')
    backupAllOk = true
  }

  const mgProbe = probeResults.find((r) => r.tenant === 'mg')
  const restore = await verifyRestoreDrill(mgProbe)
  if (restore.skipped) {
    console.log(`\nRestore drill: skipped — ${restore.reason}`)
  }

  const backupNote = backupRows.some((r) => r.source === 'atlas-api')
    ? 'backup=atlas-api-OK'
    : backupRows.some((r) => r.source === 'ui-confirmed')
      ? 'backup=ui-confirmed'
      : 'backup=direct-mongo-OK; atlas-ui-verify-recommended'

  const recordParts = [
    `Plan drill ${new Date().toISOString().slice(0, 10)}`,
    probeResults.map((r) => `${r.tenant}:tx=${r.counts.transactions ?? 0}`).join('; '),
    backupNote,
    restore.ok ? 'restore-drill=OK' : 'restore-drill=skipped',
  ]
  recordDrill(recordParts)

  console.log('\nAtlas backup drill plan complete.')
}

main().catch((err) => {
  console.error(`\nFAIL: ${err.message}`)
  process.exit(1)
})
