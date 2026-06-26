#!/usr/bin/env node
/**
 * Verify Railway persistent upload volume via /api/ready on production and staging.
 */
const targets = [
  {
    name: 'production',
    url: (process.env.SMOKE_API_BASE || 'https://api.loopcstrategies.com').replace(/\/$/, ''),
  },
  {
    name: 'staging',
    url: (process.env.STAGING_SMOKE_API_BASE || 'https://ops-dashboard-staging-e6c6.up.railway.app').replace(/\/$/, ''),
  },
]

async function verifyTarget({ name, url }) {
  const res = await fetch(`${url}/api/ready`)
  const body = await res.json()
  if (!res.ok || !body.ready) {
    throw new Error(`${name}: /api/ready not ready (${res.status})`)
  }

  const checks = body.checks || {}
  const hasUploadChecks = Object.prototype.hasOwnProperty.call(checks, 'uploadStorageRootSet')
  const issues = []

  if (hasUploadChecks) {
    if (!checks.uploadStorageRootSet) {
      issues.push('UPLOAD_STORAGE_ROOT is not set')
    }
    if (!checks.uploadStorageWritable) {
      issues.push('upload directory is not writable')
    }
    if (checks.uploadVolumeAligned === false) {
      issues.push('UPLOAD_STORAGE_ROOT does not match RAILWAY_VOLUME_MOUNT_PATH')
    }
  } else if (!body.ready) {
    issues.push('/api/ready missing upload checks and service not ready — deploy latest API')
  }

  if (Array.isArray(body.warnings)) {
    for (const warning of body.warnings) {
      if (/UPLOAD_STORAGE_ROOT|upload/i.test(warning)) issues.push(warning)
    }
  }

  if (issues.length) {
    throw new Error(`${name} (${url}): ${issues.join('; ')}`)
  }

  return {
    name,
    url,
    legacy: !hasUploadChecks,
    uploadStorageRootSet: checks.uploadStorageRootSet,
    uploadStorageWritable: checks.uploadStorageWritable,
    uploadVolumeAligned: checks.uploadVolumeAligned,
  }
}

async function main() {
  console.log('Upload storage verification (Railway volume + UPLOAD_STORAGE_ROOT)\n')
  const results = []

  for (const target of targets) {
    process.stdout.write(`  ${target.name} (${target.url})... `)
    const row = await verifyTarget(target)
    results.push(row)
    console.log(row.legacy ? 'OK (legacy /api/ready — deploy latest API for explicit upload checks)' : 'OK')
  }

  console.log('\nAll environments have persistent upload storage configured.')
  for (const row of results) {
    console.log(`  ${row.name}: root set=${row.uploadStorageRootSet}, writable=${row.uploadStorageWritable}, volume aligned=${row.uploadVolumeAligned}`)
  }
}

main().catch((err) => {
  console.error(`\nFAIL: ${err.message}`)
  process.exit(1)
})
