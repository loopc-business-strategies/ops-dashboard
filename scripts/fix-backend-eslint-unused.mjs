import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const eslintCmd = [
  'node',
  './node_modules/eslint/bin/eslint.js',
  'backend/app.js',
  'backend/server.js',
  'backend/middleware',
  'backend/routes',
  'backend/utils',
  'backend/services',
  'backend/models',
  'backend/config',
  'backend/db',
  'backend/realtime',
  'backend/jobs',
  '-f',
  'json',
].join(' ')

const raw = execSync(eslintCmd, { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
const results = JSON.parse(raw)

const byFile = new Map()
for (const file of results) {
  for (const msg of file.messages) {
    if (msg.ruleId !== 'no-unused-vars' || !msg.message) continue
    const match = msg.message.match(/^'([^']+)' is (defined|assigned)/)
    if (!match) continue
    const name = match[1]
    if (name.startsWith('_')) continue
    if (!byFile.has(file.filePath)) byFile.set(file.filePath, [])
    byFile.get(file.filePath).push({ line: msg.line, column: msg.column, name })
  }
}

let total = 0
for (const [filePath, items] of byFile) {
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  const sorted = [...items].sort((a, b) => b.line - a.line || b.column - a.column)
  for (const { line, column, name } of sorted) {
    const idx = line - 1
    const lineText = lines[idx]
    if (!lineText) continue
    const pos = column - 1
    if (lineText.slice(pos, pos + name.length) !== name) {
      const found = lineText.indexOf(name)
      if (found < 0) {
        console.warn('skip (name not on line):', filePath, line, name)
        continue
      }
    }
    const before = lineText.slice(0, pos)
    const after = lineText.slice(pos + name.length)
    const replacement = `_${name}`
    if (before.endsWith('_') || name.startsWith('_')) continue
    lines[idx] = `${before}${replacement}${after}`
    total += 1
  }
  fs.writeFileSync(filePath, lines.join('\n'))
}

console.log(`Prefixed ${total} unused bindings in ${byFile.size} files`)
