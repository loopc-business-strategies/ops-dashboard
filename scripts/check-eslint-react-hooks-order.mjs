/**
 * Ratchet: fail CI/lint if any react-hooks/rules-of-hooks violations exist
 * under frontend/src, without requiring zero warnings on all other rules.
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const eslintBin = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js')
const target = path.join(root, 'frontend', 'src')

let stdout
try {
  stdout = execFileSync(process.execPath, [eslintBin, target, '-f', 'json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
} catch (err) {
  stdout = String(err.stdout || '')
}

let data
try {
  data = JSON.parse(stdout || '[]')
} catch {
  console.error('Failed to parse ESLint JSON output.')
  process.exit(1)
}

const violations = []
for (const file of data) {
  const fp = file.filePath || ''
  for (const m of file.messages || []) {
    if (m.ruleId === 'react-hooks/rules-of-hooks') {
      violations.push(`${fp}:${m.line}:${m.column} ${m.message}`)
    }
  }
}

if (violations.length) {
  console.error(violations.join('\n'))
  console.error(`\nFound ${violations.length} react-hooks/rules-of-hooks violation(s) under frontend/src.`)
  process.exit(1)
}

console.log('No react-hooks/rules-of-hooks violations under frontend/src.')
