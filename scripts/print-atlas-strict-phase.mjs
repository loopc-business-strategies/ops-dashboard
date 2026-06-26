#!/usr/bin/env node
/**
 * Phase 3 checklist — run after Atlas M10+ Cloud Backup is enabled on MG, CG, LoopC.
 * Does not upgrade clusters or change production data.
 */
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const backendDir = path.join(rootDir, 'backend')
const require = createRequire(import.meta.url)

require(path.join(backendDir, 'node_modules', 'dotenv')).config({
  path: path.join(backendDir, '.env'),
})

const phase = String(process.env.ATLAS_BACKUP_PHASE || 'deferred').trim().toLowerCase()

console.log('Atlas strict backup phase (Phase 3) — operator checklist\n')
console.log(`Current ATLAS_BACKUP_PHASE=${phase}\n`)

console.log('Before flipping to strict (per Atlas project: MG, CG, LoopC):')
console.log('  1. Upgrade cluster to M10+ (paid)')
console.log('  2. DATABASE → Backup → enable Cloud Backup on Cluster0')
console.log('  3. Retention ≥ 7 days; enable PITR if tier allows')
console.log('  4. GitHub secrets: ATLAS_PUBLIC_KEY, ATLAS_PRIVATE_KEY, ATLAS_GROUP_ID_*')
console.log('  5. GitHub variable: ATLAS_BACKUP_PHASE=strict')
console.log('  6. Run Mongo Backup Drill workflow with phase=strict')
console.log('  7. Quarterly: restore MG snapshot to mg-restore-drill-YYYY-MM (never production)\n')

const atlasKeys = ['ATLAS_PUBLIC_KEY', 'ATLAS_PRIVATE_KEY', 'ATLAS_GROUP_ID_MG', 'ATLAS_GROUP_ID_CG', 'ATLAS_GROUP_ID_LOOPC']
for (const key of atlasKeys) {
  const set = Boolean(String(process.env[key] || '').trim())
  console.log(`  ${set ? '✓' : '✗'} ${key}`)
}

if (phase === 'strict') {
  console.log('\nRunning strict drill locally...')
  const result = spawnSync('npm', ['run', 'drill:atlas-backup-plan', '--', '--strict-backup'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ATLAS_BACKUP_PHASE: 'strict' },
  })
  process.exit(result.status ?? 1)
}

console.log('\nDeferred phase is active — no Atlas subscription required yet.')
console.log('Interim protection: weekly mongodump → R2 (MONGO_BACKUP_ENABLED=true).')
