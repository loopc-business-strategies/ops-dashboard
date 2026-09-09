/**
 * Prefer the clean VB ERP reset/seed (does NOT copy CoA from MG):
 *   npm run reset:vb-erp-masters -- --from-railway
 *   I_UNDERSTAND=RESET-VB-ERP-MASTERS npm run reset:vb-erp-masters -- --from-railway --apply --reason="..."
 *
 * Do not re-run bootstrap-new-tenant-erp.js --source=mg for Venus Bullions.
 */
import { spawnSync } from 'node:child_process'

const args = [
  'run',
  'reset:vb-erp-masters',
  '--',
  '--from-railway',
  ...process.argv.slice(2),
]

console.log('> npm', args.join(' '))
const r = spawnSync('npm', args, { stdio: 'inherit', shell: process.platform === 'win32' })
process.exit(r.status ?? 1)
