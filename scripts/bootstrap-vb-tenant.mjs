/**
 * Runs VB ERP bootstrap on the Railway production network.
 * Prefer: railway ssh -s ops-dashboard -e production -- node backend/scripts/bootstrap-new-tenant-erp.js --tenant=vb --source=mg
 */
import { spawnSync } from 'node:child_process'

const args = [
  'ssh',
  '-s', 'ops-dashboard',
  '-e', 'production',
  '--',
  'node', 'backend/scripts/bootstrap-new-tenant-erp.js',
  '--tenant=vb',
  '--source=mg',
]

console.log('> railway', args.join(' '))
const r = spawnSync('railway', args, { stdio: 'inherit', shell: process.platform === 'win32' })
process.exit(r.status ?? 1)
