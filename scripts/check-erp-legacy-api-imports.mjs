#!/usr/bin/env node
/**
 * Blocks new frontend imports of legacy api/erp (financial work belongs on erp-accounting).
 */
import fs from 'node:fs'
import path from 'node:path'

const root = 'frontend/src'
const allowlist = new Set([
  'frontend/src/api/legacyOpsErp.js',
  'frontend/src/api/erpUnified.js',
  'frontend/src/components/tabs/OperationsTab.jsx',
  'frontend/src/components/tabs/ProductionTab.jsx',
  'frontend/src/__tests__/erp-unified.test.js',
])

const importRe = /from\s+['"]([^'"]*api\/erp)['"]/g

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'generated') continue
      walk(full, files)
      continue
    }
    if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) files.push(full)
  }
  return files
}

const violations = []

for (const file of walk(root)) {
  const normalized = file.replace(/\\/g, '/')
  if (allowlist.has(normalized)) continue
  if (normalized.includes('api/erp-accounting')) continue

  const text = fs.readFileSync(file, 'utf8')
  let match
  while ((match = importRe.exec(text)) !== null) {
    const specifier = match[1]
    if (specifier.includes('erp-accounting') || specifier.includes('erpUnified')) continue
    violations.push(`${normalized}: imports "${specifier}"`)
  }
}

if (violations.length) {
  console.error('Legacy api/erp imports are restricted to OperationsTab and ProductionTab:')
  for (const row of violations) console.error(`- ${row}`)
  console.error('See docs/ERP-DUAL-API-AUDIT.md')
  process.exit(1)
}

console.log('ERP legacy API import guard passed.')
