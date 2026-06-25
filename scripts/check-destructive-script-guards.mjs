import fs from 'node:fs'
import path from 'node:path'

const destructiveDir = path.resolve('backend/scripts/destructive')
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

const guardPatterns = [
  "require('./_destructive-guard')",
  "require('./destructive/_destructive-guard')",
  "require('../backend/scripts/destructive/_destructive-guard')",
  "require('../../backend/scripts/destructive/_destructive-guard')",
  "require('./_requireGuard')",
]

function hasGuardInFirstLines(filePath) {
  const head = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).slice(0, 8).join('\n')
  return guardPatterns.some((pattern) => head.includes(pattern))
}

if (!fs.existsSync(destructiveDir)) {
  console.log('No destructive script directory found.')
  process.exit(0)
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

if (violations.length) {
  console.error('Mutating scripts must import destructive guard in the first eight lines:')
  for (const file of violations) console.error(`- ${file}`)
  process.exit(1)
}

console.log(`Destructive script guard check passed (${scripts.length + mutatingScriptFiles.length} scripts).`)
