#!/usr/bin/env node
/**
 * Push Gmail / company-inbox env vars to Railway (production + staging).
 *
 * Required (from env or backend/.google-oauth-client.json):
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *
 * Auto-generated when missing locally:
 *   EMAIL_TOKEN_ENCRYPTION_KEY, EMAIL_OAUTH_STATE_SECRET
 *
 * Usage:
 *   node scripts/set-gmail-railway.mjs
 *   node scripts/set-gmail-railway.mjs --production-only
 *
 * OAuth JSON (gitignored): backend/.google-oauth-client.json
 *   { "web": { "client_id": "...", "client_secret": "..." } }
 */
import { execSync } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
dotenv.config({ path: path.join(root, 'backend/.env') })

const productionOnly = process.argv.includes('--production-only')
const envs = productionOnly ? ['production'] : ['production', 'staging']

const TENANT_REDIRECT =
  'https://api.loopcstrategies.com/api/email/oauth/gmail/tenant/callback'
const API_PUBLIC = 'https://api.loopcstrategies.com'

function readOAuthFromJson() {
  const jsonPath = path.join(root, 'backend/.google-oauth-client.json')
  if (!fs.existsSync(jsonPath)) return {}
  try {
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    const web = raw.web || raw.installed || raw
    return {
      clientId: String(web.client_id || '').trim(),
      clientSecret: String(web.client_secret || '').trim(),
    }
  } catch (err) {
    console.error(`Could not parse ${jsonPath}:`, err.message)
    return {}
  }
}

function ensureHexKey(name, len = 64) {
  let val = String(process.env[name] || '').trim()
  if (!val) {
    val = crypto.randomBytes(32).toString('hex')
    console.log(`Generated ${name} (save in backend/.env for reuse):`)
    console.log(`${name}=${val}`)
    console.log('')
  }
  if (!/^[a-f0-9]{64}$/i.test(val)) {
    console.warn(`Warning: ${name} should be 64-char hex; using SHA-256 fallback on server.`)
  }
  return val
}

const fromJson = readOAuthFromJson()
const clientId = String(process.env.GOOGLE_CLIENT_ID || fromJson.clientId || '').trim()
const clientSecret = String(
  process.env.GOOGLE_CLIENT_SECRET || fromJson.clientSecret || '',
).trim()

const vars = {
  API_PUBLIC_URL: API_PUBLIC,
  GOOGLE_OAUTH_TENANT_REDIRECT_URI: TENANT_REDIRECT,
  EMAIL_TOKEN_ENCRYPTION_KEY: ensureHexKey('EMAIL_TOKEN_ENCRYPTION_KEY'),
  EMAIL_OAUTH_STATE_SECRET: ensureHexKey('EMAIL_OAUTH_STATE_SECRET'),
}

if (clientId) vars.GOOGLE_CLIENT_ID = clientId
if (clientSecret) vars.GOOGLE_CLIENT_SECRET = clientSecret

if (!clientId || !clientSecret) {
  console.error('Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.')
  console.error('')
  console.error('Recommended — create OAuth client in Google Cloud:')
  console.error('  1. https://console.cloud.google.com/apis/library/gmail.googleapis.com')
  console.error('  2. https://console.cloud.google.com/apis/credentials/consent')
  console.error('     → Internal (Workspace) or External + test user business@loopcstrategies.com')
  console.error('  3. https://console.cloud.google.com/apis/credentials')
  console.error('     → Create OAuth client ID → Web application')
  console.error(`     → Authorized redirect URI: ${TENANT_REDIRECT}`)
  console.error('  4. Download JSON → save as backend/.google-oauth-client.json')
  console.error('     Or set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env')
  console.error('  5. Re-run: npm run setup:gmail-railway')
  console.error('')
  console.error('Pushing non-secret vars only (encryption key, redirect URI)...')
}

for (const env of envs) {
  console.log(`Setting Gmail env on Railway (${env})...`)
  for (const [key, value] of Object.entries(vars)) {
    execSync(`railway variables set ${key}=${value} -e ${env} -s ops-dashboard`, {
      stdio: 'inherit',
      shell: true,
    })
  }
}

if (clientId && clientSecret) {
  console.log('Done. Railway will redeploy. Then run: npm run connect:company-gmail')
} else {
  console.log('Partial deploy done. Add Google OAuth credentials and re-run this script.')
}
