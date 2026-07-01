#!/usr/bin/env node
/**
 * Push OPENAI_API_KEY from local env to Railway (production + staging).
 * Usage:
 *   $env:OPENAI_API_KEY="sk-..."
 *   node scripts/set-openai-railway.mjs
 */
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../backend/.env') })

const key = String(process.env.OPENAI_API_KEY || '').trim()
if (!key) {
  console.error('OPENAI_API_KEY is not set.')
  console.error('  1. Add credits at https://platform.openai.com/settings/organization/billing')
  console.error('  2. Create/copy key: https://platform.openai.com/api-keys')
  console.error('  3. PowerShell: $env:OPENAI_API_KEY="sk-..."')
  console.error('  4. Re-run: node scripts/set-openai-railway.mjs')
  process.exit(1)
}

if (!/^sk-/i.test(key)) {
  console.warn('Warning: OpenAI keys usually start with sk-')
}

for (const env of ['production', 'staging']) {
  console.log(`Setting OPENAI_API_KEY on Railway (${env})...`)
  execSync(`railway variables set OPENAI_API_KEY=${key} -e ${env} -s ops-dashboard`, {
    stdio: 'inherit',
    shell: true,
  })
}

console.log('Done. Wait ~60s for redeploy, then: npm run smoke:sales-ai')
