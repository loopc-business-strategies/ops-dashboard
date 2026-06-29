#!/usr/bin/env node
/**
 * One-shot codemod: replace silent ERP route catches with respondRouteError.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../routes/erp-accounting')
const files = fs.readdirSync(dir).filter((f) => f.endsWith('Routes.js') || f.endsWith('MetalPricing.js'))

const replacementBlock = (tag, indent) => `${indent}} catch (err) {\n${indent}  respondRouteError(res, err, { tag: '${tag}' })\n${indent}}`

for (const file of files) {
  const filePath = path.join(dir, file)
  let text = fs.readFileSync(filePath, 'utf8')
  const tag = `erp-accounting/${file.replace(/\.js$/, '')}`

  if (!text.includes('respondRouteError')) {
    text = `const { respondRouteError } = require('../../utils/routeErrorHelpers')\n\n${text}`
  }

  const patterns = [
    [/(\n)( {2})} catch \{\n\2 {2}res\.status\(500\)\.json\(\{ success: false, message: 'Server error' \}\)\n\2}/g,
      (_, nl, indent) => `${nl}${replacementBlock(tag, indent)}`],
    [/(\n)( {4})} catch \{\n\4 {6}res\.status\(500\)\.json\(\{ success: false, message: 'Server error' \}\)\n\4}/g,
      (_, nl, indent) => `${nl}${replacementBlock(tag, indent)}`],
    [/(\n)( {4})} catch \{\n\4 {4}res\.status\(500\)\.json\(\{ success: false, message: 'Server error' \}\)\n\4}/g,
      (_, nl, indent) => `${nl}${replacementBlock(tag, indent)}`],
    [/(\n)( {6})} catch \{\n\6 {6}res\.status\(500\)\.json\(\{ success: false, message: 'Server error' \}\)\n\6}/g,
      (_, nl, indent) => `${nl}${replacementBlock(tag, indent)}`],
  ]

  let changed = false
  for (const [re, repl] of patterns) {
    const next = text.replace(re, repl)
    if (next !== text) {
      text = next
      changed = true
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, text)
    console.log('updated', file)
  }
}
