#!/usr/bin/env node
/**
 * Ensures all frontend locale JSON files share the same translation keys as en.json.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const localesDir = path.join(root, 'frontend/src/locales')
const enPath = path.join(localesDir, 'en.json')
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'))
const enKeys = Object.keys(en).sort()

const locales = ['ar', 'uz', 'ru']
const errors = []

for (const locale of locales) {
  const filePath = path.join(localesDir, `${locale}.json`)
  if (!fs.existsSync(filePath)) {
    errors.push(`${locale}.json is missing`)
    continue
  }
  const dict = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const keys = Object.keys(dict).sort()
  if (JSON.stringify(keys) !== JSON.stringify(enKeys)) {
    const missing = enKeys.filter((key) => !(key in dict))
    const extra = keys.filter((key) => !(key in en))
    if (missing.length) errors.push(`${locale}: missing keys [${missing.join(', ')}]`)
    if (extra.length) errors.push(`${locale}: extra keys [${extra.join(', ')}]`)
  }
}

if (errors.length) {
  console.error('Locale parity check failed:')
  errors.forEach((e) => console.error(`  • ${e}`))
  process.exit(1)
}

console.log(`Locale parity OK (${enKeys.length} keys in en, ar, uz, ru)`)
