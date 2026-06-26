#!/usr/bin/env node
/**
 * Atlas backup drill: direct tenant data probe + Atlas Admin API backup/snapshot checks.
 * Set ATLAS_PUBLIC_KEY, ATLAS_PRIVATE_KEY, ATLAS_GROUP_ID in backend/.env (see .env.example).
 */
import { createRequire } from 'node:module'
import dns from 'node:dns'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  backupScheduleLooksHealthy,
  getAtlasCredentials,
  getBackupSchedule,
  hasAtlasCredentials,
  latestSnapshotSummary,
  listBackupSnapshots,
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
  { key: 'mg', uriKey: 'MONGO_URI_MG', clusterHost: 'cluster0.m5yqfs7.mongodb.net' },
  { key: 'cg', uriKey: 'MONGO_URI_CG', clusterHost: 'cluster0.karzgcd.mongodb.net' },
  { key: 'loopc', uriKey: 'MONGO_URI_LOOPC', clusterHost: 'cluster0.fiijdd5.mongodb.net' },
]

const SAMPLE_COLLECTIONS = ['users', 'transactions', 'ledgers']

function parseClusterName(uri) {
  const match = String(uri || '').match(/@([^.]+)\./)
  return match?.[1] || 'Cluster0'
}

async function probeTenant({ key, uriKey }) {
  const uri = String(process.env[uriKey] || '').trim()
  if (!uri) throw new Error(`${uriKey} is not set`)

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
  if (!hasData) {
    throw new Error(`${key}: no documents in users/transactions/ledgers`)
  }

  return {
    tenant: key,
    cluster: parseClusterName(uri),
    collections: names.length,
    counts,
    samples,
  }
}

function verifyAtlasBackups(probeResults) {
  if (!hasAtlasCredentials()) {
    return {
      skipped: true,
      reason: 'Add ATLAS_PUBLIC_KEY, ATLAS_PRIVATE_KEY, ATLAS_GROUP_ID to backend/.env (Atlas → Organization → Access Manager → API Keys)',
    }
  }

  const { groupId } = getAtlasCredentials()
  const rows = []

  for (const probe of probeResults) {
    const clusterName = probe.cluster
    const schedule = getBackupSchedule(groupId, clusterName)
    const scheduleOk = backupScheduleLooksHealthy(schedule)
    const snapshots = listBackupSnapshots(groupId, clusterName)
    const latest = latestSnapshotSummary(snapshots)

    let snapshotOk = false
    if (latest?.createdAt) {
      const ageMs = Date.now() - new Date(latest.createdAt).getTime()
      snapshotOk = ageMs <= 8 * 24 * 60 * 60 * 1000 && String(latest.status || '').toLowerCase() === 'completed'
    }

    rows.push({
      tenant: probe.tenant,
      clusterName,
      scheduleOk,
      restoreWindowDays: schedule.restoreWindowDays ?? null,
      nextSnapshot: schedule.nextSnapshot ?? null,
      latestSnapshot: latest,
      snapshotOk,
    })
  }

  return { skipped: false, rows }
}

async function main() {
  console.log('Atlas backup drill — tenant data + backup/snapshot verification\n')

  const probeResults = []
  for (const tenant of TENANTS) {
    process.stdout.write(`  ${tenant.key} direct Mongo (${tenant.clusterHost})... `)
    const row = await probeTenant(tenant)
    probeResults.push(row)
    const summary = SAMPLE_COLLECTIONS
      .filter((n) => row.counts[n] != null)
      .map((n) => `${n}=${row.counts[n]}`)
      .join(', ')
    console.log(`OK (${row.collections} collections; ${summary})`)
  }

  console.log('\nSample document IDs (restore validation baseline):')
  for (const row of probeResults) {
    const parts = Object.entries(row.samples).map(([k, v]) => `${k}._id=${v}`)
    console.log(`  ${row.tenant}: ${parts.join(', ')}`)
  }

  console.log('\nAtlas cloud backup schedule + recent snapshots:')
  const atlas = verifyAtlasBackups(probeResults)
  if (atlas.skipped) {
    console.log(`  skipped — ${atlas.reason}`)
    console.log('\n  Manual: Atlas → each cluster → Backup → confirm continuous backup enabled.')
    console.log('  Optional full restore drill: restore MG snapshot to mg-restore-drill-YYYY-MM (non-prod).')
  } else {
    let allOk = true
    for (const row of atlas.rows) {
      const ok = row.scheduleOk && row.snapshotOk
      if (!ok) allOk = false
      const snap = row.latestSnapshot
        ? `${row.latestSnapshot.createdAt} (${row.latestSnapshot.status})`
        : 'none'
      console.log(
        `  ${row.tenant} (${row.clusterName}): schedule=${row.scheduleOk ? 'OK' : 'MISSING'}, `
        + `latest snapshot=${snap}, restoreWindowDays=${row.restoreWindowDays ?? '—'}`,
      )
    }
    if (!allOk) {
      throw new Error('Atlas backup schedule or recent snapshot check failed — enable Cloud Backup in Atlas')
    }
  }

  const record = probeResults
    .map((r) => `${r.tenant}:users=${r.counts.users ?? 0},tx=${r.counts.transactions ?? 0}`)
    .join('; ')

  const atlasNote = atlas.skipped ? 'atlas API skipped' : 'atlas backup+snapshots OK'

  spawnSync(process.execPath, [
    path.join(root, 'scripts', 'verify-backup-checklist.mjs'),
    '--record',
    `Atlas drill ${new Date().toISOString().slice(0, 10)} — direct probe OK; ${atlasNote}; ${record}`,
  ], { stdio: 'inherit', cwd: root })

  console.log('\nDrill complete.')
  if (!atlas.skipped) {
    console.log('Backup schedules and recent snapshots verified for all tenant clusters.')
  }
}

main().catch((err) => {
  console.error(`\nFAIL: ${err.message}`)
  process.exit(1)
})
