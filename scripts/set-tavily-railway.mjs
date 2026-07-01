#!/usr/bin/env node
/**
 * Push TAVILY_API_KEY from local env to Railway (production + staging).
 * Usage:
 *   set TAVILY_API_KEY=tvly-...   (PowerShell: $env:TAVILY_API_KEY="tvly-...")
 *   node scripts/set-tavily-railway.mjs
 */
const { execSync } = require('child_process')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') })

const key = String(process.env.TAVILY_API_KEY || '').trim()
if (!key) {
  console.error('TAVILY_API_KEY is not set. Sign up at https://app.tavily.com and paste your key.')
  console.error('  PowerShell: $env:TAVILY_API_KEY="tvly-..."')
  console.error('  Then re-run: node scripts/set-tavily-railway.mjs')
  process.exit(1)
}

if (!/^tvly-/i.test(key)) {
  console.warn('Warning: Tavily keys usually start with tvly-')
}

for (const env of ['production', 'staging']) {
  console.log(`Setting TAVILY_API_KEY on Railway (${env})...`)
  execSync(`railway variables set TAVILY_API_KEY=${key} -e ${env} -s ops-dashboard`, {
    stdio: 'inherit',
    shell: true,
  })
}

console.log('Done. Railway will redeploy. Re-run: npm run smoke:sales-ai')
