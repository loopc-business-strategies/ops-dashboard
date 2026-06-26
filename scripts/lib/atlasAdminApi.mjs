import { spawnSync } from 'node:child_process'

const API_VERSION = 'application/vnd.atlas.2024-11-13+json'
const BASE_URL = 'https://cloud.mongodb.com/api/atlas/v2'

export function getAtlasCredentials() {
  const publicKey = String(
    process.env.ATLAS_PUBLIC_KEY || process.env.MONGODB_ATLAS_PUBLIC_KEY || '',
  ).trim()
  const privateKey = String(
    process.env.ATLAS_PRIVATE_KEY || process.env.MONGODB_ATLAS_PRIVATE_KEY || '',
  ).trim()
  const groupId = String(
    process.env.ATLAS_GROUP_ID || process.env.MONGODB_ATLAS_GROUP_ID || '',
  ).trim()

  return { publicKey, privateKey, groupId }
}

/** Per-tenant Atlas project IDs (MG / CG / LoopC are separate Atlas projects). */
export function getAtlasGroupIdForTenant(tenantKey) {
  const upper = String(tenantKey || '').toUpperCase()
  const perTenant = String(
    process.env[`ATLAS_GROUP_ID_${upper}`] || process.env[`MONGODB_ATLAS_GROUP_ID_${upper}`] || '',
  ).trim()
  if (perTenant) return perTenant
  return getAtlasCredentials().groupId
}

export function hasAtlasCredentials() {
  const { publicKey, privateKey } = getAtlasCredentials()
  return Boolean(publicKey && privateKey)
}

export function hasAtlasGroupIdsForTenants(tenantKeys) {
  if (!hasAtlasCredentials()) return false
  return tenantKeys.every((key) => Boolean(getAtlasGroupIdForTenant(key)))
}

function atlasCurl(pathname, { method = 'GET', body } = {}) {
  const { publicKey, privateKey } = getAtlasCredentials()
  const args = [
    '--user', `${publicKey}:${privateKey}`,
    '--digest',
    '-sS',
    '-X', method,
    '-H', `Accept: ${API_VERSION}`,
    `${BASE_URL}${pathname}`,
  ]

  if (body) {
    args.push('-H', 'Content-Type: application/json', '-d', JSON.stringify(body))
  }

  const result = spawnSync('curl.exe', args, { encoding: 'utf8' })
  if (result.error) {
    throw new Error(`curl failed: ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(`Atlas API ${pathname} failed (${result.status}): ${(result.stderr || result.stdout || '').slice(0, 300)}`)
  }

  try {
    return JSON.parse(result.stdout)
  } catch {
    throw new Error(`Atlas API ${pathname} returned non-JSON: ${result.stdout.slice(0, 200)}`)
  }
}

export function listClusters(groupId) {
  const data = atlasCurl(`/groups/${groupId}/clusters`)
  return data?.results || []
}

export function getBackupSchedule(groupId, clusterName) {
  return atlasCurl(`/groups/${groupId}/clusters/${encodeURIComponent(clusterName)}/backup/schedule`)
}

export function listBackupSnapshots(groupId, clusterName, { pageNum = 1, itemsPerPage = 5 } = {}) {
  const query = `?pageNum=${pageNum}&itemsPerPage=${itemsPerPage}`
  return atlasCurl(`/groups/${groupId}/clusters/${encodeURIComponent(clusterName)}/backup/snapshots${query}`)
}

export function backupScheduleLooksHealthy(schedule) {
  if (!schedule || typeof schedule !== 'object') return false
  const hasPolicies = Array.isArray(schedule.policies) && schedule.policies.some(
    (p) => Array.isArray(p.policyItems) && p.policyItems.length > 0,
  )
  const hasNextSnapshot = Boolean(schedule.nextSnapshot)
  const hasRestoreWindow = Number(schedule.restoreWindowDays) > 0
  return hasPolicies || hasNextSnapshot || hasRestoreWindow
}

export function verifyTenantBackup(groupId, clusterName) {
  const schedule = getBackupSchedule(groupId, clusterName)
  const scheduleOk = backupScheduleLooksHealthy(schedule)
  const snapshots = listBackupSnapshots(groupId, clusterName)
  const latest = latestSnapshotSummary(snapshots)

  let snapshotOk = false
  if (latest?.createdAt) {
    const ageMs = Date.now() - new Date(latest.createdAt).getTime()
    snapshotOk = ageMs <= 8 * 24 * 60 * 60 * 1000 && String(latest.status || '').toLowerCase() === 'completed'
  }

  return {
    clusterName,
    scheduleOk,
    restoreWindowDays: schedule.restoreWindowDays ?? null,
    nextSnapshot: schedule.nextSnapshot ?? null,
    latestSnapshot: latest,
    snapshotOk,
  }
}

export function latestSnapshotSummary(snapshotsPayload) {
  const results = snapshotsPayload?.results || []
  if (!results.length) return null
  const latest = results[0]
  return {
    id: latest.id,
    createdAt: latest.createdAt,
    status: latest.status,
    type: latest.type,
  }
}
