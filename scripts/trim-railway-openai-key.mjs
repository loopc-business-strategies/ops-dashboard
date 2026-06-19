#!/usr/bin/env node
/** Trim trailing whitespace/newlines from Railway OPENAI_API_KEY if present. */
import { spawnSync } from 'node:child_process'

function railwayJson() {
  const r = spawnSync('railway', ['variables', '--json', '-s', 'ops-dashboard'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  if (r.status !== 0) {
    console.error('railway variables --json failed:', r.stderr || r.stdout)
    process.exit(r.status ?? 1)
  }
  return JSON.parse(r.stdout)
}

const vars = railwayJson()
const raw = String(vars.OPENAI_API_KEY || '')
const trimmed = raw.trim()

if (!trimmed) {
  console.log('OPENAI_API_KEY not set — skip')
  process.exit(0)
}

if (raw === trimmed) {
  console.log('OPENAI_API_KEY already trimmed — no change')
  process.exit(0)
}

console.log(`Trimming OPENAI_API_KEY (${raw.length} → ${trimmed.length} chars)`)
const set = spawnSync(
  'railway',
  ['variables', '--set', `OPENAI_API_KEY=${trimmed}`, '-s', 'ops-dashboard'],
  { stdio: 'inherit', shell: process.platform === 'win32' },
)
process.exit(set.status ?? 0)
