require('dotenv').config()

const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const cookieParser = require('cookie-parser')

const sanitizeMiddleware = require('./middleware/sanitize')
const { requestLoggerMiddleware } = require('./middleware/logger')
const { bindTenantContext } = require('./middleware/tenantContext')
const { enforceCsrfProtection } = require('./middleware/csrf')

const authRoutes = require('./routes/auth')
const employeeRoutes = require('./routes/employees')
const taskRoutes = require('./routes/tasks')
const erpRoutes = require('./routes/erp')
const erpAccountingRoutes = require('./routes/erp-accounting')
const attendanceRoutes = require('./routes/attendance')
const messageRoutes = require('./routes/messages')
const crmRoutes = require('./routes/crm')
const departmentStateRoutes = require('./routes/department-state')
const realtimeRoutes = require('./routes/realtime')
const financeRoutes    = require('./routes/finance')
const complianceRoutes = require('./routes/compliance')
const trainingRoutes   = require('./routes/training')
const cleanupRoutes    = require('./routes/cleanupRoutes')
const backendPackage = require('./package.json')

const resolveBackendCommit = () => {
  const envCommit = String(
    process.env.BACKEND_BUILD_COMMIT
    || process.env.BACKEND_BUILD_SHA
    || process.env.RAILWAY_GIT_COMMIT_SHA
    || process.env.GIT_COMMIT_SHA
    || process.env.SOURCE_VERSION
    || process.env.COMMIT_SHA
    || process.env.GITHUB_SHA
    || process.env.CI_COMMIT_SHA
    || ''
  ).trim()

  if (envCommit) return envCommit

  try {
    return execSync('git rev-parse --short=7 HEAD', {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim()
  } catch {
    return 'unknown'
  }
}

const backendCommit = resolveBackendCommit()

const backendBuildMeta = {
  version: String(backendPackage.version || '0.0.0'),
  commit: backendCommit,
  sha: backendCommit,
  builtAt: String(process.env.BACKEND_BUILD_TIME || process.env.RAILWAY_DEPLOYMENT_TIMESTAMP || new Date().toISOString()),
}

function createApp() {
  const app = express()
  const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || '100kb'
  const isProduction = process.env.NODE_ENV === 'production'

  app.set('trust proxy', 1)

  const apiLimiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_MAX || 400),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !isProduction,
    message: { success: false, message: 'Too many requests. Please try again shortly.' },
  })

  const authLimiter = rateLimit({
    windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.AUTH_RATE_LIMIT_MAX || 25),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !isProduction,
    skipSuccessfulRequests: true,
    message: { success: false, message: 'Too many authentication attempts. Please try again later.' },
  })

  app.use(helmet())

  // Build CORS allowlist from environment.
  // CLIENT_URL  — single origin (legacy, kept for compatibility)
  // CLIENT_URLS — comma-separated list of all allowed origins (preferred)
  // Both are merged; add new Vercel/Railway origins here via env var instead of code.
  const rawOrigins = Array.from(new Set([
    ...(process.env.CLIENT_URL  || '').split(','),
    ...(process.env.CLIENT_URLS || '').split(','),
  ].flatMap(s => s.split(',')).map(o => o.trim()).filter(Boolean)))

  const devOrigins = isProduction
    ? []
    : [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5174',
      ]

  const allowedOrigins = Array.from(new Set([...rawOrigins, ...devOrigins]))

  app.use(cors({
    origin: (origin, callback) => {
      // Allow server-to-server / health checks (no Origin header)
      if (!origin) return callback(null, true)
      if (!isProduction) {
        try {
          const url = new URL(origin)
          const isLocalHost =
            url.hostname === 'localhost' ||
            url.hostname === '127.0.0.1' ||
            url.hostname === '::1' ||
            url.hostname.endsWith('.localhost')
          const isDevPort = url.port === '5173' || url.port === '5174'
          if (isLocalHost && isDevPort) return callback(null, true)
        } catch {
          // Ignore malformed origins and continue allowlist checks.
        }
      }
      if (allowedOrigins.includes(origin)) return callback(null, true)
      callback(new Error(`CORS: origin not allowed — ${origin}`))
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant', 'x-company', 'x-csrf-token', 'x-xsrf-token', 'x-requested-with'],
  }))
  app.use(cookieParser())
  app.use(express.json({ limit: REQUEST_BODY_LIMIT }))
  app.use(express.urlencoded({ extended: true, limit: REQUEST_BODY_LIMIT }))
  
  // ─── Health Check (No Auth, No Rate Limit, No CSRF) ──────────────────────
  // Must be BEFORE all middleware to avoid blocking on auth/rate-limit issues
  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      message: 'Server is running!',
      time: new Date(),
      commit: backendBuildMeta.commit,
      build: backendBuildMeta,
      backend: backendBuildMeta,
    })
  })
  
  // ─── Security & Logging Middleware ─────────────────────────────────────────
  app.use(sanitizeMiddleware)        // Validate inputs (reject dangerous keys)
  app.use(requestLoggerMiddleware)   // Log all requests & responses

  // NOTE: Uploads directory is NOT served publicly.
  // Use /api/erp-accounting/attachments/download/:type/:filename for protected file access.

  app.use('/api', apiLimiter)
  app.use('/api/auth/login', authLimiter)
  app.use('/api/auth/setup', authLimiter)
  app.use('/api', enforceCsrfProtection)
  app.use('/api', bindTenantContext)

  app.use('/api/auth', authRoutes)
  app.use('/api/hr/employees', employeeRoutes)
  app.use('/api/tasks', taskRoutes)
  app.use('/api/erp', erpRoutes)
  app.use('/api/erp-accounting', erpAccountingRoutes)
  app.use('/api/attendance', attendanceRoutes)
  app.use('/api/messages', messageRoutes)
  app.use('/api/crm', crmRoutes)
  app.use('/api/department-state', departmentStateRoutes)
  app.use('/api/realtime', realtimeRoutes)
  app.use('/api/finance',    financeRoutes)
  app.use('/api/compliance', complianceRoutes)
  app.use('/api/training',   trainingRoutes)
  app.use('/api/admin', cleanupRoutes)

  if (process.env.NODE_ENV === 'production') {
    const frontendDistPath = path.join(__dirname, '../frontend/dist')
    const frontendIndexPath = path.join(frontendDistPath, 'index.html')

    if (fs.existsSync(frontendIndexPath)) {
      app.use(express.static(frontendDistPath))
      app.get(/.*/, (req, res) => {
        res.sendFile(frontendIndexPath)
      })
    }
  }

  app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` })
  })

  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err)
    res.status(500).json({ success: false, message: 'Something went wrong.' })
  })

  return app
}

module.exports = createApp


// Railway deploy: 2026-05-07T16:49:12
