const fs = require('fs')
const path = require('path')

const backendPackage = require('../package.json')

function readBuildMetaFile() {
  try {
    const metaPath = path.join(__dirname, '..', 'build-meta.json')
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    const commit = String(meta.commit || meta.sha || '').trim()
    if (!commit || commit === 'unknown') return null
    return {
      commit,
      sha: String(meta.sha || commit).trim(),
      builtAt: String(meta.builtAt || '').trim(),
      shortCommit: String(meta.shortCommit || commit.slice(0, 7)).trim(),
    }
  } catch {
    return null
  }
}

function resolveBackendCommit() {
  const fromFile = readBuildMetaFile()
  if (fromFile?.commit) return fromFile.commit

  const envCommit = String(
    process.env.BACKEND_BUILD_OVERRIDE_COMMIT
    || process.env.BACKEND_BUILD_OVERRIDE_SHA
    || process.env.RAILWAY_GIT_COMMIT_SHA
    || process.env.GIT_COMMIT_SHA
    || process.env.SOURCE_VERSION
    || process.env.COMMIT_SHA
    || process.env.GITHUB_SHA
    || process.env.CI_COMMIT_SHA
    || '',
  ).trim()

  return envCommit || 'unknown'
}

function getBackendBuildMeta() {
  const fromFile = readBuildMetaFile()
  const commit = resolveBackendCommit()
  const shortCommit = commit !== 'unknown' ? commit.slice(0, 7) : 'unknown'

  return {
    version: String(backendPackage.version || '0.0.0'),
    commit,
    sha: commit,
    shortCommit: fromFile?.shortCommit && fromFile.shortCommit !== 'unknown'
      ? fromFile.shortCommit
      : shortCommit,
    builtAt: String(
      fromFile?.builtAt
      || process.env.BACKEND_BUILD_TIME
      || process.env.RAILWAY_DEPLOYMENT_TIMESTAMP
      || '',
    ).trim(),
  }
}

module.exports = {
  getBackendBuildMeta,
  resolveBackendCommit,
}
