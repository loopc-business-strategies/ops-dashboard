#!/usr/bin/env node
/**
 * Prints MongoDB backup checklist and records drill completion in docs/ops-log/mongodb-backup-drill.log
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docPath = path.join(root, 'docs', 'MONGODB-BACKUPS-AND-DATA-SAFETY.md')
const logDir = path.join(root, 'docs', 'ops-log')
const logPath = path.join(logDir, 'mongodb-backup-drill.log')

console.log('MongoDB backup verification checklist\n')
console.log('Source: docs/MONGODB-BACKUPS-AND-DATA-SAFETY.md\n')

const section = fs.readFileSync(docPath, 'utf8')
const match = section.match(/## Restore verification checklist[\s\S]*?(?=\n## |$)/)
if (match) {
  console.log(match[0].replace(/^## Restore verification checklist \(operators\)\n\n/, ''))
} else {
  console.log('See docs/MONGODB-BACKUPS-AND-DATA-SAFETY.md for the full checklist.')
}

console.log('\nTenant Mongo env vars to verify in Atlas:')
for (const key of ['MONGO_URI_MG', 'MONGO_URI_CG', 'MONGO_URI_LOOPC']) {
  const set = Boolean(String(process.env[key] || '').trim())
  console.log(`  ${key}: ${set ? 'set locally' : 'not set in this shell'}`)
}

if (fs.existsSync(logPath)) {
  const lines = fs.readFileSync(logPath, 'utf8').trim().split(/\r?\n/).filter(Boolean)
  console.log(`\nLast recorded drills (${lines.length} entries):`)
  for (const line of lines.slice(-3)) console.log(`  ${line}`)
} else {
  console.log('\nNo drill recorded yet. After completing Atlas restore test, run:')
  console.log('  npm run verify:backup-checklist -- --record "2026-06-25: restored MG snapshot to staging cluster"')
}

const recordIdx = process.argv.indexOf('--record')
if (recordIdx >= 0 && process.argv[recordIdx + 1]) {
  const entry = `${new Date().toISOString().slice(0, 10)} — ${process.argv[recordIdx + 1]}`
  fs.mkdirSync(logDir, { recursive: true })
  fs.appendFileSync(logPath, `${entry}\n`)
  console.log(`\nRecorded: ${entry}`)
}

console.log('\nComplete each checkbox in Atlas, then record the drill date in your ops log.')
