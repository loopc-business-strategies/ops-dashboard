#!/usr/bin/env node
/**
 * Verifies Atlas strict backup prerequisites before enabling ATLAS_BACKUP_PHASE=strict.
 * Requires per-tenant group IDs (ATLAS_GROUP_ID_MG/CG/LOOPC) — same as the backup drill.
 * Legacy single ATLAS_GROUP_ID is accepted only when it resolves for every tenant
 * (see scripts/lib/atlasAdminApi.mjs getAtlasGroupIdForTenant).
 */
import {
  hasAtlasCredentials,
  hasAtlasGroupIdsForTenants,
  getAtlasGroupIdForTenant,
} from './lib/atlasAdminApi.mjs'

const phase = String(process.env.ATLAS_BACKUP_PHASE || 'deferred').trim().toLowerCase()
const TENANTS = ['mg', 'cg', 'loopc']

if (phase !== 'strict') {
  console.log(`Atlas backup phase: ${phase} — strict readiness check skipped.`)
  process.exit(0)
}

const missing = []
if (!hasAtlasCredentials()) {
  missing.push('ATLAS_PUBLIC_KEY', 'ATLAS_PRIVATE_KEY')
}

const missingGroupIds = TENANTS.filter((key) => !getAtlasGroupIdForTenant(key)).map(
  (key) => `ATLAS_GROUP_ID_${key.toUpperCase()}`,
)
if (missingGroupIds.length) {
  missing.push(...missingGroupIds)
}

if (missing.length || !hasAtlasGroupIdsForTenants(TENANTS)) {
  console.error('ATLAS_BACKUP_PHASE=strict requires Atlas M10+ Cloud Backup and API credentials.')
  console.error('Missing:', missing.length ? missing.join(', ') : 'tenant group ID coverage')
  console.error('Set ATLAS_PUBLIC_KEY, ATLAS_PRIVATE_KEY, and ATLAS_GROUP_ID_MG / CG / LOOPC')
  console.error('(or a shared ATLAS_GROUP_ID that applies to all tenants).')
  console.error('See docs/MONGODB-BACKUPS-AND-DATA-SAFETY.md')
  process.exit(1)
}

console.log('Atlas strict backup readiness OK (credentials + per-tenant group IDs).')
