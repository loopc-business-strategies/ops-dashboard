/**
 * Compatibility wrapper. Prefer:
 *   node scripts/destructive/clear-pd-wip-leftovers.js --tenant=all
 *
 * This file forces --tenant=mg then loads the shared cleaner.
 */
const path = require('path')

const args = process.argv.slice(2).filter((arg) => {
  const lower = String(arg).toLowerCase()
  return !(lower === '--tenant' || lower.startsWith('--tenant=') || lower === '-t')
})

process.argv = [
  process.argv[0],
  path.join(__dirname, 'clear-pd-wip-leftovers.js'),
  '--tenant=mg',
  ...args,
]

require('./clear-pd-wip-leftovers.js')
