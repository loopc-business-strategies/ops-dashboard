import fs from 'node:fs'
import path from 'node:path'

const destructiveDir = path.resolve('backend/scripts/destructive')
const destructiveGuardPath = path.join(destructiveDir, '_destructive-guard.js')

const mutatingScriptFiles = [
  'backend/scripts/backfill-ledger-exchange-rates.js',
  'backend/scripts/backfill-mapping-departments.js',
  'backend/scripts/backfill-missing-metal-ledger.js',
  'backend/scripts/backfill-transaction-type-all-tenants.js',
  'backend/scripts/bootstrap-statutory-accounts-all-tenants.js',
  'backend/scripts/copy-chart-of-accounts.js',
  'backend/scripts/copy-ops-to-cg.js',
  'backend/scripts/copy-ops-to-mg.js',
  'backend/scripts/fix-inventory-ledger.js',
  'backend/scripts/fix-voucher-5-accounts.js',
  'backend/scripts/merge-cg-hepi-account.js',
  'backend/scripts/reclass-fx-journal-bank-to-cash-all-tenants.js',
  'backend/scripts/repair-inventory-accounts.js',
  'backend/scripts/revalue-fx-journals-all-tenants.js',
  'backend/scripts/seed-currency-master-all-tenants.js',
  'backend/scripts/set-fx-mapping-to-cash-all-tenants.js',
  'backend/scripts/setup-cg-requested-parties-and-bank.js',
  'backend/scripts/update-uzs-rate.js',
  'backend/scripts/void-transaction-via-api.js',
  'scripts/renumber-mg-jv-docno-live.js',
  'scripts/renumber-mg-bank-jv-docno-live.js',
  'scripts/ops-misc/deep-mongo-cleanup-mg.js',
  'scripts/ops-misc/deep-cleanup-mg.js',
  'scripts/ops-misc/deep-cleanup-mg-fixed.js',
  'scripts/ops-misc/authenticated-cleanup-mg.js',
]

const stagingAssertMutators = [
  'backend/scripts/fix-usd-exchange-when-inr-base.js',
  'backend/scripts/sync-currency-rates-from-source-tenant.js',
  'backend/scripts/reconcile-mg-inventory-qty.js',
  'backend/scripts/migrate-persistent-session-all-tenants.js',
  'backend/scripts/backfill-fx-journals-all-tenants.js',
  'backend/scripts/backfill-fx-journals-missing.js',
  'scripts/migrate-fx-adjustment-journal-to-expense.mjs',
]

const guardPatterns = [
  "require('./_destructive-guard')",
  "require('./destructive/_destructive-guard')",
  "require('../backend/scripts/destructive/_destructive-guard')",
  "require('../../backend/scripts/destructive/_destructive-guard')",
  "require('./_requireGuard')",
]

const stagingAssertPatterns = [
  'assertStagingOnlyScript',
  "require('../utils/assertStagingOnlyScript')",
  "require('../../utils/assertStagingOnlyScript')",
  "require('../backend/utils/assertStagingOnlyScript",
]

function hasGuardInFirstLines(filePath, lineCount = 8) {
  const head = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).slice(0, lineCount).join('\n')
  return guardPatterns.some((pattern) => head.includes(pattern))
}

function hasStagingAssert(filePath) {
  const contents = fs.readFileSync(filePath, 'utf8')
  return stagingAssertPatterns.some((pattern) => contents.includes(pattern))
}

if (!fs.existsSync(destructiveDir)) {
  console.log('No destructive script directory found.')
  process.exit(0)
}

if (!fs.existsSync(destructiveGuardPath)) {
  console.error('Missing backend/scripts/destructive/_destructive-guard.js')
  process.exit(1)
}

const guardSource = fs.readFileSync(destructiveGuardPath, 'utf8')
if (!guardSource.includes('assertStagingOnlyScript')) {
  console.error('_destructive-guard.js must call assertStagingOnlyScript (staging-only fail-closed gate).')
  process.exit(1)
}

const scripts = fs.readdirSync(destructiveDir)
  .filter((file) => file.endsWith('.js'))
  .filter((file) => file !== '_destructive-guard.js')
  .sort()

const violations = []

for (const file of scripts) {
  const fullPath = path.join(destructiveDir, file)
  if (!hasGuardInFirstLines(fullPath)) {
    violations.push(path.relative(process.cwd(), fullPath))
  }
}

for (const file of mutatingScriptFiles) {
  const fullPath = path.resolve(file)
  if (!fs.existsSync(fullPath)) {
    violations.push(`${file} (listed mutating script missing)`)
    continue
  }
  if (!hasGuardInFirstLines(fullPath)) {
    violations.push(file)
  }
}

for (const file of stagingAssertMutators) {
  const fullPath = path.resolve(file)
  if (!fs.existsSync(fullPath)) {
    violations.push(`${file} (listed staging-assert mutator missing)`)
    continue
  }
  if (!hasStagingAssert(fullPath)) {
    violations.push(`${file} (missing assertStagingOnlyScript)`)
  }
}

if (violations.length) {
  console.error('Mutating scripts must import destructive guard (first eight lines) or assertStagingOnlyScript:')
  for (const file of violations) console.error(`- ${file}`)
  process.exit(1)
}

console.log(
  `Destructive script guard check passed `
  + `(${scripts.length + mutatingScriptFiles.length} guarded, `
  + `${stagingAssertMutators.length} staging-assert mutators).`,
)
