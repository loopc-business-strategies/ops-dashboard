// ==========================================
// FILE: backend/server.js
// WHAT THIS DOES:
//   This is the starting point of the backend.
//   It creates the Express server, connects to MongoDB,
//   and registers all route files.
// ==========================================

require('dotenv').config() // load .env variables FIRST

const { isWeakJwtSecret, isHardenedDeployEnv, validateHardenedDeploySecrets } = require('./utils/envValidation')

// ── Startup env validation ────────────────────────────────────────────────────
// Railway healthchecks must get an HTTP response quickly. Prefer warning over
// hard-exit so /api/health remains available even during partial misconfig.
// Production rejects weak or placeholder JWT secrets before the server starts.
;(function validateEnv() {
  const hardenedSecretErrors = validateHardenedDeploySecrets()
  if (hardenedSecretErrors.length) {
    console.error('[startup] FATAL — invalid production/staging secrets:')
    hardenedSecretErrors.forEach((message) => console.error(`  • ${message}`))
    process.exit(1)
  }

  const missing = []
  if (!process.env.JWT_SECRET || isWeakJwtSecret(process.env.JWT_SECRET)) missing.push('JWT_SECRET')
  if (isHardenedDeployEnv() && !process.env.SERVER_BASE_URL) {
    missing.push('SERVER_BASE_URL')
  }
  
  // Check if at least one tenant URI is available; warn if none (dev/test only)
  const hasAnyTenantUri = process.env.MONGO_URI_MG || process.env.MONGO_URI_CG || process.env.MONGO_URI_LOOPC
  const hasAllTenantUris = process.env.MONGO_URI_MG && process.env.MONGO_URI_CG && process.env.MONGO_URI_LOOPC
  
  if (!hasAnyTenantUri) {
    missing.push('At least one of: MONGO_URI_MG / MONGO_URI_CG / MONGO_URI_LOOPC')
  } else if (!hasAllTenantUris && !isHardenedDeployEnv()) {
    const available = []
    if (process.env.MONGO_URI_MG) available.push('MG')
    if (process.env.MONGO_URI_CG) available.push('CG')
    if (process.env.MONGO_URI_LOOPC) available.push('Loopc')
    console.warn(`[startup] WARNING — only some tenants configured: ${available.join(', ')} (missing: ${['MG', 'CG', 'Loopc'].filter(t => !available.includes(t)).join(', ')})`)
  }
  
  if (missing.length) {
    console.warn('[startup] WARNING — missing environment variables (service will still start):')
    missing.forEach(k => console.warn(`  • ${k}`))
  }

  if (process.env.NODE_ENV === 'production') {
    const mockSpot = String(process.env.METALS_SPOT_MOCK_REALTIME || '').trim().toLowerCase()
    if (mockSpot === '1' || mockSpot === 'true' || mockSpot === 'yes') {
      const allowMockProd = String(process.env.METALS_SPOT_MOCK_REALTIME_ALLOW_PRODUCTION || '').trim().toLowerCase()
      const allow = allowMockProd === '1' || allowMockProd === 'true' || allowMockProd === 'yes'
      if (!allow) {
        console.warn('[startup] METALS_SPOT_MOCK_REALTIME is on — synthetic metal prices for API/market routes (not real market data).')
      }
    }
  }
})()
// ─────────────────────────────────────────────────────────────────────────────

// ── DNS fix ──────────────────────────────────────────────────────────────────
// Some local DNS stubs (VPN clients, Docker, routers) cannot resolve MongoDB
// Atlas SRV records even though nslookup/OS DNS works fine.  Force Node to use
// a reliable public resolver before any Mongoose connection is attempted.
// Override via DNS_SERVERS env var, e.g. "1.1.1.1,1.0.0.1" for Cloudflare.
const dns = require('dns')
const dnsServers = (process.env.DNS_SERVERS || process.env.ATLAS_DNS_SERVERS)
  ? (process.env.DNS_SERVERS || process.env.ATLAS_DNS_SERVERS).split(',').map(s => s.trim()).filter(Boolean)
  : ['8.8.8.8', '8.8.4.4']
dns.setServers(dnsServers)
// ─────────────────────────────────────────────────────────────────────────────

const http = require('http')
const mongoose = require('mongoose')
const createApp = require('./app')
const RealtimeServer = require('./realtime/RealtimeServer')
const { setPrimaryMongoReady } = require('./services/readiness')
const { TENANT_KEYS, getDefaultTenant, getTenantUri } = require('./config/tenants')

const app = createApp()

function getAvailableTenantUris() {
  return TENANT_KEYS
    .map((tenant) => ({ tenant, uri: getTenantUri(tenant) }))
    .filter((entry) => Boolean(entry.uri))
}

// ── Connect to MongoDB then start server ────────
const PORT      = process.env.PORT      || 5000

function buildMongoUri() {
  const defaultTenant = getDefaultTenant()
  const defaultTenantUri = getTenantUri(defaultTenant)
  if (defaultTenantUri) {
    return { tenant: defaultTenant, uri: defaultTenantUri, source: 'default-tenant' }
  }

  const available = getAvailableTenantUris()
  if (!available.length) return null

  return {
    tenant: available[0].tenant,
    uri: available[0].uri,
    source: 'fallback-available-tenant',
  }
}

function getMongoConfigInfo() {
  const selected = buildMongoUri()
  const dbName = process.env.DB_NAME || 'ops-dashboard'
  const availableTenants = getAvailableTenantUris().map((entry) => entry.tenant.toUpperCase())

  if (selected) {
    return {
      mode: `TENANT_URI (${selected.tenant.toUpperCase()})`,
      target: dbName,
      source: selected.source,
      availableTenants,
    }
  }

  return {
    mode: 'TENANT_URI_MISSING',
    target: dbName,
    source: 'none',
    availableTenants,
  }
}

const mongoSelection = buildMongoUri()
const mongoUri = mongoSelection?.uri || null
const mongoInfo = getMongoConfigInfo()
if (!mongoUri) {
  console.warn('[startup] WARNING — Mongo config missing. Set at least one of MONGO_URI_MG/MONGO_URI_CG/MONGO_URI_LOOPC.')
}

console.log(`Mongo config mode: ${mongoInfo.mode}`)
console.log(`Mongo config source: ${mongoInfo.source}`)
console.log(`Mongo configured tenants: ${mongoInfo.availableTenants.join(', ') || 'none'}`)
console.log(`Mongo target: ${mongoInfo.target}`)

async function startServer() {
  // Start HTTP server FIRST so the Railway healthcheck at /api/health can
  // respond immediately. MongoDB connects in the background; Mongoose queues
  // any route-level queries until the connection is established.
  const httpServer = http.createServer(app)
  const realtimeServer = new RealtimeServer(httpServer)
  app.set('realtimeServer', realtimeServer)
  try {
    const { setNotificationRealtimeServer } = require('./services/notificationDispatch')
    setNotificationRealtimeServer(realtimeServer)
  } catch (e) {
    console.warn('[startup] notification dispatch not wired:', e.message)
  }

  httpServer.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`)
    console.log(`   Liveness:  http://localhost:${PORT}/api/health`)
    console.log(`   Readiness: http://localhost:${PORT}/api/ready`)
    console.log('✅ Realtime Socket.IO enabled')
    if (process.env.NODE_ENV === 'production' && !String(process.env.REDIS_URL || '').trim()) {
      console.warn('[startup] WARNING — REDIS_URL is not set. Set Redis before scaling Railway to multiple instances.')
    }
  })

  // Connect to MongoDB after the HTTP server is already accepting traffic.
  if (!mongoUri) return

  try {
    await mongoose.connect(mongoUri)
    setPrimaryMongoReady(true)
    console.log('✅ Connected to MongoDB')
    try {
      const { startTaskReminderJob } = require('./jobs/taskReminderJob')
      startTaskReminderJob()
    } catch (e) {
      console.warn('[startup] task reminder job not started:', e.message)
    }
    try {
      const { startTaskStaleCommentJob } = require('./jobs/taskStaleCommentJob')
      startTaskStaleCommentJob()
    } catch (e) {
      console.warn('[startup] task stale comment job not started:', e.message)
    }
    try {
      const { startTaskRulesJob } = require('./jobs/taskRulesJob')
      startTaskRulesJob()
    } catch (e) {
      console.warn('[startup] task rules job not started:', e.message)
    }
    try {
      const { startNotificationDigestJob } = require('./jobs/notificationDigestJob')
      startNotificationDigestJob()
    } catch (e) {
      console.warn('[startup] notification digest job not started:', e.message)
    }
    try {
      const { startSalesAiDigestJob } = require('./jobs/salesAiDigestJob')
      startSalesAiDigestJob()
    } catch (e) {
      console.warn('[startup] sales AI digest job not started:', e.message)
    }
  } catch (err) {
    setPrimaryMongoReady(false)
    console.error(`❌ MongoDB connect failed (${mongoUri.split('@')[1]?.split('/')[0] || 'unknown'}): ${err.message}`)
    // Don't exit — Railway keeps the process alive. /api/ready stays 503 until DB connects.
  }
}

startServer().catch((err) => {
  console.error('[startup] FATAL — server failed to start:', err)
  process.exit(1)
})
