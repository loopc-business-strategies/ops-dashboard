import { spawnSync } from 'node:child_process'

const API_VERSION = 'application/vnd.atlas.2024-11-13+json'
const BASE_URL = 'https://cloud.mongodb.com/api/atlas/v2'

function curlBinary() {
  return process.platform === 'win32' ? 'curl.exe' : 'curl'
}

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

/** Per-tenant Atlas project IDs (MG / CG / LoopC / VB are separate Atlas projects). */
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

function atlasCurl(pathname, { method = 'GET', body, allowEmpty = false } = {}) {
  const { publicKey, privateKey } = getAtlasCredentials()
  const args = [
    '--user', `${publicKey}:${privateKey}`,
    '--digest',
    '-sS',
    '-w', '\n%{http_code}',
    '-X', method,
    '-H', `Accept: ${API_VERSION}`,
    `${BASE_URL}${pathname}`,
  ]

  if (body) {
    args.push('-H', 'Content-Type: application/json', '-d', JSON.stringify(body))
  }

  const result = spawnSync(curlBinary(), args, { encoding: 'utf8' })
  if (result.error) {
    throw new Error(`curl failed: ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(`Atlas API ${pathname} failed (${result.status}): ${(result.stderr || result.stdout || '').slice(0, 300)}`)
  }

  const raw = String(result.stdout || '')
  const nl = raw.lastIndexOf('\n')
  const statusCode = nl === -1 ? '' : raw.slice(nl + 1).trim()
  const payload = nl === -1 ? raw : raw.slice(0, nl)
  const code = Number(statusCode)

  if (code >= 400) {
    throw new Error(`Atlas API ${pathname} HTTP ${code}: ${payload.slice(0, 300)}`)
  }
  if (!payload.trim()) {
    if (allowEmpty || method === 'DELETE' || code === 202 || code === 204) return null
    throw new Error(`Atlas API ${pathname} returned empty body (HTTP ${code || 'unknown'})`)
  }

  try {
    return JSON.parse(payload)
  } catch {
    throw new Error(`Atlas API ${pathname} returned non-JSON: ${payload.slice(0, 200)}`)
  }
}

/** List Atlas projects (groups) visible to the API key. */
export function listProjects() {
  const data = atlasCurl('/groups?itemsPerPage=100')
  return data?.results || []
}

export function getProject(groupId) {
  return atlasCurl(`/groups/${groupId}`)
}

export function listClusters(groupId) {
  const data = atlasCurl(`/groups/${groupId}/clusters`)
  return data?.results || []
}

/** Terminate a cluster (async). Caller must confirm empty/unused. */
export function deleteCluster(groupId, clusterName) {
  return atlasCurl(`/groups/${groupId}/clusters/${encodeURIComponent(clusterName)}`, {
    method: 'DELETE',
    allowEmpty: true,
  })
}

/** Delete an Atlas project. Cluster list must already be empty. */
export function deleteProject(groupId) {
  return atlasCurl(`/groups/${groupId}`, { method: 'DELETE', allowEmpty: true })
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

/** Known production Atlas cluster host suffixes used by ops-dashboard tenants. */
export const KNOWN_TENANT_CLUSTER_HOST_MARKERS = Object.freeze([
  'm5yqfs7.mongodb.net', // MG
  'karzgcd.mongodb.net', // CG
  'fiijdd5.mongodb.net', // LoopC
  'fiotefu.mongodb.net', // Venus Bullions (vb)
])

export function hostMatchesKnownTenant(hostOrUriFragment) {
  const lower = String(hostOrUriFragment || '').toLowerCase()
  return KNOWN_TENANT_CLUSTER_HOST_MARKERS.some((marker) => lower.includes(marker))
}
