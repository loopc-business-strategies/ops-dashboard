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
  if (process.env.NODE_ENV === 'production' && !process.env.SERVER_BASE_URL) {
    missing.push('SERVER_BASE_URL (required in production for attachment links)')
  }
  
  // Check if at least one tenant URI is available; warn if none
  const hasAnyTenantUri = process.env.MONGO_URI_MG || process.env.MONGO_URI_CG || process.env.MONGO_URI_LOOPC
  const hasAllTenantUris = process.env.MONGO_URI_MG && process.env.MONGO_URI_CG && process.env.MONGO_URI_LOOPC
  
  if (!hasAnyTenantUri) {
    missing.push('At least one of: MONGO_URI_MG / MONGO_URI_CG / MONGO_URI_LOOPC')
  } else if (!hasAllTenantUris) {
    const available = []
    if (process.env.MONGO_URI_MG) available.push('MG')
    if (process.env.MONGO_URI_CG) available.push('CG')
    if (process.env.MONGO_URI_LOOPC) available.push('Loopc')
    console.warn(`[startup] WARNING — only some tenants configured: ${available.join(', ')} (missing: ${['MG', 'CG', 'Loopc'].filter(t => !available.includes(t)).join(', ')})`)
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

const http = require('http')
const mongoose = require('mongoose')
const createApp = require('./app')
const RealtimeServer = require('./realtime/RealtimeServer')
const { getDefaultTenant, getTenantUri } = require('./config/tenants')

const app = createApp()

function envBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue
  return String(value).trim().toLowerCase() === 'true'
}

// ── Connect to MongoDB then start server ────────
const PORT      = process.env.PORT      || 5000

function buildMongoUri() {
  const defaultTenant = getDefaultTenant()
  const tenantUri = getTenantUri(defaultTenant)
  return tenantUri || null
}

function getMongoConfigInfo() {
  const defaultTenant = getDefaultTenant()
  const usingTenantUri = Boolean(getTenantUri(defaultTenant))
  const dbName = process.env.DB_NAME || 'ops-dashboard'

  if (usingTenantUri) {
    return {
      mode: `TENANT_URI (${defaultTenant.toUpperCase()})`,
      target: dbName,
    }
  }

  return {
    mode: 'TENANT_URI_MISSING',
    target: dbName,
  }
}

const mongoUri = buildMongoUri()
const mongoInfo = getMongoConfigInfo()
if (!mongoUri) {
  console.error('Mongo config missing. Set MONGO_URI_MG, MONGO_URI_CG, and MONGO_URI_LOOPC in .env.')
  process.exit(1)
}

console.log(`Mongo config mode: ${mongoInfo.mode}`)
console.log(`Mongo target: ${mongoInfo.target}`)

async function startServer() {
  try {
    await mongoose.connect(mongoUri)
    console.log('✅ Connected to MongoDB')

    const httpServer = http.createServer(app)
    const realtimeServer = new RealtimeServer(httpServer)
    app.set('realtimeServer', realtimeServer)

    httpServer.listen(PORT, () => {
      console.log(`✅ Server running at http://localhost:${PORT}`)
      console.log(`   Health check: http://localhost:${PORT}/api/health`)
      console.log('✅ Realtime Socket.IO enabled')
    })
  } catch (err) {
    console.warn(`⚠️  MongoDB connect failed (${mongoUri.split('@')[1]?.split('/')[0] || 'unknown'}): ${err.message}`)
    console.error('❌ MongoDB connection failed. Server not started.')
    process.exit(1)
  }
}

startServer()
