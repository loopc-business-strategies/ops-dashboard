// When the repo is built via SUBST (Q:\) + junction (C:\nexa-m), Metro may resolve
// dependencies to the canonical path under Desktop. Those paths must be watched or
// bundling fails with "Failed to get the SHA-1" (see scripts/build-mobile-apk-subst-q.cmd).
const fs = require('fs')
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const repoRoot = path.resolve(projectRoot, '..')
const sharedRoot = path.join(repoRoot, 'shared')
let canonicalRoot = projectRoot
try {
  canonicalRoot = fs.realpathSync(projectRoot)
} catch {
  /* keep projectRoot */
}

const config = getDefaultConfig(projectRoot)
const existing = config.watchFolders ?? []
config.watchFolders = [...new Set([...existing, projectRoot, canonicalRoot, repoRoot, sharedRoot])]

module.exports = config
