/**
 * Shared scanner for mutating Mongo script guard enforcement.
 * Used by scripts/check-destructive-script-guards.mjs and backend tests.
 */
const fs = require('node:fs')
const path = require('node:path')

const MUTATION_RE = /\b(?:deleteOne|deleteMany|findOneAndDelete|findByIdAndDelete|dropDatabase|updateOne|updateMany|replaceOne|bulkWrite|insertMany|createIndex|dropIndex|syncIndexes)\b|\.remove\(|\.drop\(/

const DESTRUCTIVE_GUARD_RE = /require\(\s*['"][^'"]*_destructive-guard['"]\s*\)|require\(\s*['"][^'"]*_requireGuard['"]\s*\)/

const STAGING_ASSERT_RE = /\bassertStagingOnlyScript\b|require\(\s*['"][^'"]*assertStagingOnlyScript['"]\s*\)/

const SCRIPT_EXT = new Set(['.js', '.mjs', '.cjs'])

/**
 * Allowlist: path relative to repo root (posix) → documented reason.
 * Keep minimal — only proven false positives / intentional non-mutating exceptions.
 */
const ALLOWLIST = Object.freeze({
  // Prints suggested mongo shell snippets containing updateMany; does not call mutators.
  'backend/scripts/audit-exchange-entries.js':
    'Read-only audit; updateMany appears only in printed manual cleanup instructions.',
})

function toPosix(relPath) {
  return String(relPath || '').split(path.sep).join('/')
}

function isUnderDir(relPosix, dirPrefix) {
  const prefix = dirPrefix.endsWith('/') ? dirPrefix : `${dirPrefix}/`
  return relPosix === dirPrefix.replace(/\/$/, '') || relPosix.startsWith(prefix)
}

function shouldSkipPath(relPosix, { includeGuardFixtures = false } = {}) {
  const parts = relPosix.split('/')
  if (parts.includes('node_modules')) return true
  if (parts.includes('__guard_fixtures__') && !includeGuardFixtures) return true
  // Scanner / self-reference files contain mutation pattern string literals.
  if (relPosix === 'scripts/check-destructive-script-guards.mjs') return true
  if (relPosix === 'scripts/lib/destructiveScriptGuardScan.cjs') return true
  if (relPosix === 'backend/tests/checkDestructiveScriptGuards.test.js') return true
  return false
}

function walkScriptFiles(absRoot, relBase, options = {}) {
  const out = []
  if (!fs.existsSync(absRoot)) return out

  const entries = fs.readdirSync(absRoot, { withFileTypes: true })
  for (const entry of entries) {
    const abs = path.join(absRoot, entry.name)
    const rel = toPosix(path.join(relBase, entry.name))
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      if (entry.name === '__guard_fixtures__' && !options.includeGuardFixtures) continue
      out.push(...walkScriptFiles(abs, rel, options))
      continue
    }
    if (!entry.isFile()) continue
    if (!SCRIPT_EXT.has(path.extname(entry.name))) continue
    if (shouldSkipPath(rel, options)) continue
    out.push({ absPath: abs, relPath: rel })
  }
  return out
}

function collectScanTargets(repoRoot, options = {}) {
  const root = path.resolve(repoRoot)
  const files = [
    ...walkScriptFiles(path.join(root, 'backend', 'scripts'), 'backend/scripts', options),
    ...walkScriptFiles(path.join(root, 'scripts'), 'scripts', options),
  ]
  return files.sort((a, b) => a.relPath.localeCompare(b.relPath))
}

function fileContainsMutation(contents) {
  return MUTATION_RE.test(contents)
}

function hasDestructiveGuardInFirstLines(contents, lineCount = 20) {
  const head = String(contents || '').split(/\r?\n/).slice(0, lineCount).join('\n')
  return DESTRUCTIVE_GUARD_RE.test(head)
}

function hasStagingOrDestructiveGuard(contents) {
  const text = String(contents || '')
  return STAGING_ASSERT_RE.test(text) || DESTRUCTIVE_GUARD_RE.test(text)
}

function isDestructiveDirScript(relPosix) {
  return isUnderDir(relPosix, 'backend/scripts/destructive')
    && path.posix.basename(relPosix) !== '_destructive-guard.js'
}

function classifyMutator(relPosix, contents) {
  if (ALLOWLIST[relPosix]) {
    return { ok: true, allowlisted: true, reason: ALLOWLIST[relPosix] }
  }

  if (isDestructiveDirScript(relPosix)) {
    if (!hasDestructiveGuardInFirstLines(contents, 20)) {
      return {
        ok: false,
        rule: 'destructive-guard-first-20',
        message: 'must require _destructive-guard (or _requireGuard) within the first 20 lines',
      }
    }
    return { ok: true }
  }

  if (!hasStagingOrDestructiveGuard(contents)) {
    return {
      ok: false,
      rule: 'staging-or-destructive-guard',
      message: 'must contain assertStagingOnlyScript or a destructive guard require',
    }
  }
  return { ok: true }
}

function scanRepo(repoRoot, options = {}) {
  const root = path.resolve(repoRoot)
  const destructiveGuardPath = path.join(root, 'backend', 'scripts', 'destructive', '_destructive-guard.js')
  const structural = []
  const violations = []
  const mutators = []
  const allowlisted = []

  if (!fs.existsSync(path.join(root, 'backend', 'scripts', 'destructive'))) {
    structural.push('Missing backend/scripts/destructive directory')
  } else if (!fs.existsSync(destructiveGuardPath)) {
    structural.push('Missing backend/scripts/destructive/_destructive-guard.js')
  } else {
    const guardSource = fs.readFileSync(destructiveGuardPath, 'utf8')
    if (!guardSource.includes('assertStagingOnlyScript')) {
      structural.push('_destructive-guard.js must call assertStagingOnlyScript (staging-only fail-closed gate)')
    }
  }

  const targets = collectScanTargets(root, options)
  for (const { absPath, relPath } of targets) {
    const contents = fs.readFileSync(absPath, 'utf8')
    if (!fileContainsMutation(contents)) continue

    const result = classifyMutator(relPath, contents)
    if (result.allowlisted) {
      allowlisted.push({ relPath, reason: result.reason })
      continue
    }
    mutators.push(relPath)
    if (!result.ok) {
      violations.push({
        relPath,
        rule: result.rule,
        message: result.message,
      })
    }
  }

  return {
    ok: structural.length === 0 && violations.length === 0,
    structural,
    violations,
    mutators,
    allowlisted,
    scannedFileCount: targets.length,
  }
}

function formatScanReport(result) {
  const lines = []
  for (const item of result.structural || []) {
    lines.push(`STRUCTURAL: ${item}`)
  }
  for (const v of result.violations || []) {
    lines.push(`${v.relPath}: ${v.message}`)
  }
  return lines
}

module.exports = {
  MUTATION_RE,
  ALLOWLIST,
  collectScanTargets,
  fileContainsMutation,
  hasDestructiveGuardInFirstLines,
  hasStagingOrDestructiveGuard,
  classifyMutator,
  scanRepo,
  formatScanReport,
  isDestructiveDirScript,
}
