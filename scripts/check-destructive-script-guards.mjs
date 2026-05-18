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
]

function hasGuardInFirstLines(filePath, importText) {
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .slice(0, 5)
    .join('\n')
    .includes(importText)
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
  if (!hasGuardInFirstLines(fullPath, "require('./_destructive-guard')")) {
    violations.push(path.relative(process.cwd(), fullPath))
  }
}

for (const file of mutatingScriptFiles) {
  const fullPath = path.resolve(file)
  if (!fs.existsSync(fullPath)) {
    violations.push(`${file} (listed mutating script missing)`)
    continue
  }
  if (!hasGuardInFirstLines(fullPath, "require('./destructive/_destructive-guard')")) {
    violations.push(file)
  }
}

if (violations.length) {
  console.error('Mutating scripts must import backend/scripts/destructive/_destructive-guard.js in the first five lines:')
  for (const file of violations) console.error(`- ${file}`)
  process.exit(1)
}

console.log(`Destructive script guard check passed (${scripts.length + mutatingScriptFiles.length} scripts).`)
