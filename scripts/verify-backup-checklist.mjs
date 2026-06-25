#!/usr/bin/env node
/**
 * Prints the quarterly MongoDB backup verification checklist for operators.
 * Does not access Atlas or Railway — use as a runbook reminder.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docPath = path.join(root, 'docs', 'MONGODB-BACKUPS-AND-DATA-SAFETY.md')

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

console.log('\nComplete each checkbox in Atlas/provider dashboard, then record date in your ops log.')
