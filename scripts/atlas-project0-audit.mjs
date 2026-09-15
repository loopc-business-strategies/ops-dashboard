#!/usr/bin/env node
/**
 * Audit Atlas "Project 0" vs known tenant projects (MG / CG / LoopC / Venus).
 * - Always fingerprints MONGO_URI_* / STAGING_MONGO_URI_* hosts (no secrets printed).
 * - With ATLAS_PUBLIC_KEY + ATLAS_PRIVATE_KEY: lists Atlas projects, finds Project 0, lists clusters.
 * - Optional: --apply-delete deletes Project 0 only when it has zero clusters (or after --terminate-clusters).
 *
 * Never touches MG / CG / LoopC / Venus Bullion projects.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import {
  hasAtlasCredentials,
  listProjects,
  listClusters,
  deleteCluster,
  deleteProject,
  getAtlasGroupIdForTenant,
  hostMatchesKnownTenant,
  KNOWN_TENANT_CLUSTER_HOST_MARKERS,
} from './lib/atlasAdminApi.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
require(path.join(root, 'backend', 'node_modules', 'dotenv')).config({
  path: path.join(root, 'backend', '.env'),
  quiet: true,
})

const applyDelete = process.argv.includes('--apply-delete')
const terminateClusters = process.argv.includes('--terminate-clusters')
const TENANT_KEYS = ['mg', 'cg', 'loopc', 'vb']
const URI_KEYS = [
  'MONGO_URI_MG', 'MONGO_URI_CG', 'MONGO_URI_LOOPC', 'MONGO_URI_VB',
  'STAGING_MONGO_URI_MG', 'STAGING_MONGO_URI_CG', 'STAGING_MONGO_URI_LOOPC', 'STAGING_MONGO_URI_VB',
]

function extractHostFragment(uri) {
  const m = String(uri || '').match(/@([^/?]+)/)
  return (m?.[1] || '').toLowerCase()
}

function fingerprintUris() {
  console.log('URI host fingerprint (known tenant markers):')
  console.log(`  markers: ${KNOWN_TENANT_CLUSTER_HOST_MARKERS.join(', ')}`)
  let unknown = 0
  let setCount = 0
  for (const key of URI_KEYS) {
    const uri = String(process.env[key] || '').trim()
    if (!uri) {
      console.log(`  ${key}: MISSING`)
      continue
    }
    setCount += 1
    const host = extractHostFragment(uri)
    const ok = hostMatchesKnownTenant(host)
    if (!ok) unknown += 1
    console.log(`  ${key}: knownTenant=${ok}`)
  }
  return { setCount, unknown }
}

function isProjectZero(name) {
  return /^project\s*0$/i.test(String(name || '').trim())
}

function isProtectedTenantProject(name) {
  const n = String(name || '').trim().toLowerCase()
  return (
    n === 'mg'
    || n === 'cg'
    || n === 'loopc'
    || n === 'venus bullion'
    || n === 'venus bullions'
  )
}

async function main() {
  console.log('Atlas Project 0 audit\n')

  const { setCount, unknown } = fingerprintUris()
  if (unknown > 0) {
    throw new Error(
      `${unknown} configured URI(s) do not match known MG/CG/LoopC/VB cluster hosts. `
      + 'Refuse Project 0 delete until hosts are explained.',
    )
  }
  if (setCount === 0) {
    console.log('\nNo local MONGO_URI_* set — relying on repo known-host map + Atlas API (if keys present).')
  } else {
    console.log('\nAll set URIs match known tenant cluster hosts (app is not wired to a mystery Project 0 host).')
  }

  const configuredGroupIds = TENANT_KEYS
    .map((key) => ({ key, id: getAtlasGroupIdForTenant(key) }))
    .filter((row) => row.id)
  if (configuredGroupIds.length) {
    console.log('\nConfigured ATLAS_GROUP_ID_* (tenant projects):')
    for (const row of configuredGroupIds) {
      console.log(`  ${row.key}: ${row.id}`)
    }
  } else {
    console.log('\nNo ATLAS_GROUP_ID_* in env (backup drills stay deferred until keys are set).')
  }

  if (!hasAtlasCredentials()) {
    console.log(`
Atlas API keys not set (ATLAS_PUBLIC_KEY / ATLAS_PRIVATE_KEY).
Cannot list or delete Project 0 from this machine.

Operator UI (safe remove when empty):
  1. Atlas → switch to Project 0
  2. Database → Clusters — if any clusters, Browse Collections; confirm no ops-dashboard prod data
  3. Terminate all clusters in Project 0 only
  4. Organization → Projects → Project 0 → Delete Project
  5. Leave MG / CG / LoopC / Venus Bullion untouched

See docs/ATLAS-PROJECTS.md
`)
    if (applyDelete) {
      throw new Error('Refusing --apply-delete without Atlas API keys.')
    }
    return
  }

  const projects = listProjects()
  console.log(`\nAtlas projects visible to API key: ${projects.length}`)
  for (const p of projects) {
    const id = p.id || p.groupId
    const name = p.name || '(unnamed)'
    const clusters = listClusters(id)
    console.log(`  - ${name} (${id}) clusters=${clusters.length}`)
  }

  const project0 = projects.filter((p) => isProjectZero(p.name))
  if (!project0.length) {
    console.log('\nNo project named "Project 0" found — nothing to delete (already removed or renamed).')
    return
  }

  for (const p of project0) {
    const id = p.id || p.groupId
    if (configuredGroupIds.some((row) => row.id === id)) {
      throw new Error(
        `Refusing action: Project 0 id ${id} matches a configured ATLAS_GROUP_ID_* tenant. Investigate manually.`,
      )
    }
    if (isProtectedTenantProject(p.name)) {
      throw new Error(`Refusing action on protected tenant project name: ${p.name}`)
    }

    let clusters = listClusters(id)
    console.log(`\nProject 0 candidate: ${p.name} (${id}) clusters=${clusters.length}`)
    for (const c of clusters) {
      console.log(`  cluster: ${c.name} state=${c.stateName || c.state || '?'} host=${c.connectionStrings?.standardSrv || c.srvAddress || '(n/a)'}`)
    }

    if (!applyDelete) {
      console.log('Dry-run only. Re-run with --apply-delete to remove Project 0 when safe.')
      if (clusters.length) {
        console.log('Project still has clusters — pass --terminate-clusters with --apply-delete only after UI confirm empty/unused.')
      }
      continue
    }

    if (clusters.length && !terminateClusters) {
      throw new Error(
        `Project 0 still has ${clusters.length} cluster(s). `
        + 'Confirm unused in Atlas UI, then re-run with --apply-delete --terminate-clusters.',
      )
    }

    if (clusters.length && terminateClusters) {
      for (const c of clusters) {
        console.log(`Terminating cluster ${c.name} in Project 0…`)
        deleteCluster(id, c.name)
      }
      console.log('Cluster terminate requested (async). Wait until Atlas shows zero clusters, then re-run --apply-delete.')
      return
    }

    console.log(`Deleting empty Atlas project ${p.name} (${id})…`)
    deleteProject(id)
    console.log('Project 0 delete requested.')
  }
}

main().catch((err) => {
  console.error(`FAIL: ${err.message || err}`)
  process.exit(1)
})
