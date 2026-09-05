#!/usr/bin/env node
/**
 * Fail-closed CI check: mutating scripts under backend/scripts and scripts
 * must use destructive guard / assertStagingOnlyScript.
 *
 * Recursively detects Mongo mutation API usage; does not rely on a hard-coded
 * filename list. Excludes scripts/__guard_fixtures__ (unit-test only samples).
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const require = createRequire(import.meta.url)
const {
  scanRepo,
  formatScanReport,
} = require('./lib/destructiveScriptGuardScan.cjs')

const result = scanRepo(repoRoot, { includeGuardFixtures: false })

if (!result.ok) {
  console.error('Destructive / mutator script guard check FAILED:')
  for (const line of formatScanReport(result)) {
    console.error(`- ${line}`)
  }
  process.exit(1)
}

console.log(
  `Destructive script guard check passed `
  + `(scanned ${result.scannedFileCount} files, `
  + `${result.mutators.length} mutators guarded, `
  + `${result.allowlisted.length} allowlisted).`,
)
