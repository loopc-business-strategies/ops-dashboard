#!/usr/bin/env node
/**
 * Local critical health checks (no production credentials required).
 * Live metal movement requires: npm run verify:live-metal-movement:all
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function run(label, cmd, args, opts = {}) {
  console.log(`\n--- ${label} ---`)
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opts,
  })
  if (result.status !== 0) {
    console.error(`FAIL: ${label}`)
    process.exit(result.status || 1)
  }
}

run('Risk guardrails', 'npm', ['run', 'check:risk-guardrails'])
run('ERP access sync', 'npm', ['run', 'sync:erp-access'])
run('Metal bridge fan-out tests', 'npm', ['--prefix', 'backend', 'test', '--', '--testPathPattern=metalRateBridge'])
run('Metal bridge HTTP route test', 'npm', ['--prefix', 'backend', 'test', '--', '--testPathPattern=metal-rates-bridge-route'])
run('Destructive script guards', 'npm', ['run', 'check:destructive-guards'])
run('Margin policy tests (backend)', 'npm', ['--prefix', 'backend', 'test', '--', '--testPathPattern=metalMarginPolicy'])
run('Margin row mapping (frontend)', 'npm', ['--prefix', 'frontend', 'test', '--', '--run', 'src/components/tabs/erp/mapErpLiveMarginRow.test.js'])
run('Margin row mapping (mobile)', 'npm', ['--prefix', 'mobile', 'test', '--', '--run', 'src/utils/marginWidgetHelpers.test.ts'])

console.log('\n=== Critical health: local checks passed ===')
console.log('Next (requires smoke credentials):')
console.log('  npm run verify:live-metal-movement:all')
console.log('See docs/CRITICAL-FIXES-CHECKLIST.md for full P0–P3 tracker.')
