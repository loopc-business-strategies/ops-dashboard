// When the repo is built via SUBST (Q:\) + junction (C:\nexa-r), Metro may resolve
// dependencies to the canonical path under Desktop. Those paths must be watched or
// bundling fails with "Failed to get the SHA-1" (see scripts/build-mobile-apk-subst-q.cmd).
const fs = require('fs')
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const envRepoRoot = String(process.env.OPS_DASHBOARD_REPO_ROOT || '').trim()
const repoRoot = envRepoRoot
  ? path.resolve(envRepoRoot)
  : path.resolve(projectRoot, '..')
let canonicalRoot = projectRoot
try {
  canonicalRoot = fs.realpathSync(projectRoot)
} catch {
  /* keep projectRoot */
}

const config = getDefaultConfig(projectRoot)
const existing = config.watchFolders ?? []
config.watchFolders = [...new Set([...existing, projectRoot, canonicalRoot, repoRoot])]

// Keep Vitest files out of release bundles (expo-router scans app/ via require.context).
config.resolver = {
  ...config.resolver,
  blockList: [
    ...(Array.isArray(config.resolver?.blockList)
      ? config.resolver.blockList
      : config.resolver?.blockList
        ? [config.resolver.blockList]
        : []),
    /.*\.(test|smoke\.test)\.[cm]?[jt]sx?$/,
  ],
}

module.exports = config
