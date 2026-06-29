#!/usr/bin/env node
/**
 * Verifies Atlas strict backup prerequisites before enabling ATLAS_BACKUP_PHASE=strict.
 */
const phase = String(process.env.ATLAS_BACKUP_PHASE || 'deferred').trim().toLowerCase()

const required = [
  'ATLAS_PUBLIC_KEY',
  'ATLAS_PRIVATE_KEY',
  'ATLAS_GROUP_ID',
  'ATLAS_CLUSTER_NAME',
]

if (phase !== 'strict') {
  console.log(`Atlas backup phase: ${phase} — strict readiness check skipped.`)
  process.exit(0)
}

const missing = required.filter((key) => !String(process.env[key] || '').trim())
if (missing.length) {
  console.error('ATLAS_BACKUP_PHASE=strict requires Atlas M10+ Cloud Backup and API credentials.')
  console.error('Missing:', missing.join(', '))
  console.error('See docs/MONGODB-BACKUPS-AND-DATA-SAFETY.md')
  process.exit(1)
}

console.log('Atlas strict backup readiness OK.')
