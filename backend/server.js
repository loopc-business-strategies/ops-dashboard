// ==========================================
// FILE: backend/server.js
// WHAT THIS DOES:
//   This is the starting point of the backend.
//   It creates the Express server, connects to MongoDB,
//   and registers all route files.
// ==========================================

require('dotenv').config() // load .env variables FIRST

// ── Startup env validation ────────────────────────────────────────────────────
// Fail fast if critical secrets are missing rather than running in a broken state.
;(function validateEnv() {
  const missing = []
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET')
  // At least one DB path must exist: tenant URIs or generic MONGO_URI or split credentials
  const hasTenantUris = process.env.MONGO_URI_MG || process.env.MONGO_URI_CG || process.env.MONGO_URI_LOOPC
  const hasLegacyUri  = process.env.MONGO_URI
  const hasSplitCreds = process.env.DB_USER && process.env.DB_PASS && process.env.DB_CLUSTER
  if (!hasTenantUris && !hasLegacyUri && !hasSplitCreds) {
    missing.push('MONGO_URI_MG / MONGO_URI_CG / MONGO_URI_LOOPC (or MONGO_URI)')
  }
  if (missing.length) {
    console.error('[startup] FATAL — missing required environment variables:')
    missing.forEach(k => console.error(`  • ${k}`))
    process.exit(1)
  }
})()
// ─────────────────────────────────────────────────────────────────────────────

// ── DNS fix ──────────────────────────────────────────────────────────────────
// Some local DNS stubs (VPN clients, Docker, routers) cannot resolve MongoDB
// Atlas SRV records even though nslookup/OS DNS works fine.  Force Node to use
// a reliable public resolver before any Mongoose connection is attempted.
// Override via DNS_SERVERS env var, e.g. "1.1.1.1,1.0.0.1" for Cloudflare.
const dns = require('dns')
const dnsServers = process.env.DNS_SERVERS
  ? process.env.DNS_SERVERS.split(',').map(s => s.trim()).filter(Boolean)
  : ['8.8.8.8', '8.8.4.4']
dns.setServers(dnsServers)
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose')
const createApp = require('./app')
const { getDefaultTenant, getTenantUri } = require('./config/tenants')

const app = createApp()

function envBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue
  return String(value).trim().toLowerCase() === 'true'
}

// ── Connect to MongoDB then start server ────────
const PORT      = process.env.PORT      || 5000
const MONGO_URI = process.env.MONGO_URI
const ALLOW_SERVER_LEGACY_FALLBACK = envBool(process.env.ALLOW_SERVER_LEGACY_FALLBACK, false)

function buildMongoUri() {
  const defaultTenant = getDefaultTenant()
  const tenantUri = getTenantUri(defaultTenant)
  if (tenantUri) return tenantUri

  if (MONGO_URI) return MONGO_URI

  const DB_USER = process.env.DB_USER
  const DB_PASS = process.env.DB_PASS
  const DB_CLUSTER = process.env.DB_CLUSTER
  const DB_NAME = process.env.DB_NAME || 'ops-dashboard'
  const DB_PARAMS = process.env.DB_PARAMS || 'retryWrites=true&w=majority'

  if (!DB_USER || !DB_PASS || !DB_CLUSTER) {
    return null
  }

  const encodedPass = encodeURIComponent(DB_PASS)
  return `mongodb+srv://${DB_USER}:${encodedPass}@${DB_CLUSTER}/${DB_NAME}?${DB_PARAMS}`
}

function getMongoConfigInfo() {
  const defaultTenant = getDefaultTenant()
  const usingTenantUri = Boolean(getTenantUri(defaultTenant))
  const usingUri = Boolean(MONGO_URI)
  const dbName = process.env.DB_NAME || 'ops-dashboard'

  if (usingTenantUri) {
    return {
      mode: `TENANT_URI (${defaultTenant.toUpperCase()})`,
      target: dbName,
    }
  }

  if (usingUri) {
    return {
      mode: 'MONGO_URI',
      target: dbName,
    }
  }

  return {
    mode: 'DB_USER/DB_PASS/DB_CLUSTER',
    target: `${process.env.DB_CLUSTER || 'unknown-cluster'}/${dbName}`,
  }
}

const mongoUri = buildMongoUri()
const mongoInfo = getMongoConfigInfo()
const hasSplitDbVars = Boolean(process.env.DB_USER || process.env.DB_PASS || process.env.DB_CLUSTER)

if (!mongoUri) {
  console.error('Mongo config missing. Set MONGO_URI_MG/MONGO_URI_CG/MONGO_URI_LOOPC or MONGO_URI in .env.')
  process.exit(1)
}

if (MONGO_URI && hasSplitDbVars) {
  console.warn('Mongo warning: MONGO_URI is set, so DB_USER/DB_PASS/DB_CLUSTER values are ignored.')
}

console.log(`Mongo config mode: ${mongoInfo.mode}`)
console.log(`Mongo target: ${mongoInfo.target}`)

async function startServer() {
  // Try primary URI first. Legacy fallback is disabled by default so tenant
  // isolation stays strict and we never silently collapse to one shared DB.
  const urisToTry = [mongoUri]
  if (ALLOW_SERVER_LEGACY_FALLBACK && MONGO_URI && mongoUri !== MONGO_URI) urisToTry.push(MONGO_URI)

  for (const uri of urisToTry) {
    try {
      await mongoose.connect(uri)
      console.log(`✅ Connected to MongoDB${uri === MONGO_URI && urisToTry.length > 1 ? ' (legacy fallback)' : ''}`)
      app.listen(PORT, () => {
        console.log(`✅ Server running at http://localhost:${PORT}`)
        console.log(`   Health check: http://localhost:${PORT}/api/health`)
      })
      return
    } catch (err) {
      console.warn(`⚠️  MongoDB connect failed (${uri.split('@')[1]?.split('/')[0] || 'unknown'}): ${err.message}`)
      if (uri !== urisToTry[urisToTry.length - 1]) {
        console.warn('   Retrying with legacy MONGO_URI...')
      } else if (!ALLOW_SERVER_LEGACY_FALLBACK && MONGO_URI && mongoUri !== MONGO_URI) {
        console.warn('   Legacy fallback disabled. Enable ALLOW_SERVER_LEGACY_FALLBACK=true only for emergency recovery.')
      }
    }
  }

  console.error('❌ All MongoDB connection attempts failed. Server not started.')
  process.exit(1)
}

startServer()
