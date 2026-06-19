require('dotenv').config()

const path = require('path')
const fs = require('fs')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { rateLimit, ipKeyGenerator } = require('express-rate-limit')
const cookieParser = require('cookie-parser')

const sanitizeMiddleware = require('./middleware/sanitize')
const { requestLoggerMiddleware } = require('./middleware/logger')
const { bindTenantContext } = require('./middleware/tenantContext')
const { enforceCsrfProtection } = require('./middleware/csrf')

/** Client closed connection or aborted body read (express.json / raw-body); not an app bug. */
function isClientAbortError(err) {
  if (!err) return false
  const code = err.code
  if (code === 'ECONNRESET' || code === 'EPIPE' || code === 'ECONNABORTED') return true
  if (err.type === 'request.aborted') return true
  const msg = String(err.message || '').toLowerCase()
  if (msg.includes('request aborted')) return true
  return false
}

const Sentry = require('@sentry/node')
const sentryEnabled = Boolean(String(process.env.SENTRY_DSN || '').trim())
if (sentryEnabled) {
  const sentryRelease = String(
    process.env.SENTRY_RELEASE
      || process.env.RAILWAY_GIT_COMMIT_SHA
      || process.env.GITHUB_SHA
      || process.env.COMMIT_SHA
      || '',
  ).trim()
  const tracesRaw = process.env.SENTRY_TRACES_SAMPLE_RATE
  const tracesSampleRate = tracesRaw === undefined || tracesRaw === ''
    ? 0
    : Math.min(1, Math.max(0, Number(tracesRaw)))
  Sentry.init({
    dsn: String(process.env.SENTRY_DSN).trim(),
    environment: String(process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development').trim(),
    ...(sentryRelease ? { release: sentryRelease } : {}),
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
    beforeSend(event, hint) {
      if (isClientAbortError(hint && hint.originalException)) return null
      return event
    },
  })
}

const authRoutes = require('./routes/auth')
const employeeRoutes = require('./routes/employees')
const taskRoutes = require('./routes/tasks')
const taskTemplateRoutes = require('./routes/taskTemplates')
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
const operationsLegalDocumentsRoutes = require('./routes/operationsLegalDocuments')
const cleanupRoutes    = require('./routes/cleanupRoutes')
const aiRoutes         = require('./routes/ai')
const backendPackage = require('./package.json')

const readBackendBuildMetaFile = () => {
  try {
    const metaPath = path.join(__dirname, 'build-meta.json')
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    return {
      commit: String(meta.commit || meta.sha || '').trim(),
      sha: String(meta.sha || meta.commit || '').trim(),
      builtAt: String(meta.builtAt || '').trim(),
    }
  } catch {
    return null
  }
}

const backendBuildMetaFile = readBackendBuildMetaFile()

const readGitHead = () => {
  try {
    const gitDir = path.join(__dirname, '..', '.git')
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim()
    if (!head.startsWith('ref:')) return head

    const refPath = head.replace(/^ref:\s*/, '')
    const looseRefPath = path.join(gitDir, refPath)
    if (fs.existsSync(looseRefPath)) return fs.readFileSync(looseRefPath, 'utf8').trim()

    const packedRefsPath = path.join(gitDir, 'packed-refs')
    if (fs.existsSync(packedRefsPath)) {
      const packedRef = fs.readFileSync(packedRefsPath, 'utf8')
        .split(/\r?\n/)
        .find((line) => line && !line.startsWith('#') && line.endsWith(` ${refPath}`))
      if (packedRef) return packedRef.split(' ')[0].trim()
    }
  } catch {
    return ''
  }
  return ''
}

const resolveBackendCommit = () => {
  if (backendBuildMetaFile?.commit && backendBuildMetaFile.commit !== 'unknown') return backendBuildMetaFile.commit

  const envCommit = String(
    process.env.BACKEND_BUILD_OVERRIDE_COMMIT
    || process.env.BACKEND_BUILD_OVERRIDE_SHA
    || process.env.RAILWAY_GIT_COMMIT_SHA
    || process.env.GIT_COMMIT_SHA
    || process.env.SOURCE_VERSION
    || process.env.COMMIT_SHA
    || process.env.GITHUB_SHA
    || process.env.CI_COMMIT_SHA
    || ''
  ).trim()

  if (envCommit) return envCommit

  return readGitHead() || 'unknown'
}

const backendCommit = resolveBackendCommit()

const backendBuildMeta = {
  version: String(backendPackage.version || '0.0.0'),
  commit: backendCommit,
  sha: backendCommit,
  builtAt: String(
    (backendBuildMetaFile?.commit && backendBuildMetaFile.commit !== 'unknown' ? backendBuildMetaFile.builtAt : '')
    || process.env.BACKEND_BUILD_TIME
    || process.env.RAILWAY_DEPLOYMENT_TIMESTAMP
    || new Date().toISOString()
  ),
}

function createApp() {
  const app = express()
  const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || '5mb'
  const isProduction = process.env.NODE_ENV === 'production'

  app.set('trust proxy', 1)

  const authRateLimitPaths = ['/api/auth/login', '/api/auth/setup']
  const rateLimitExcludedPrefixes = [
    '/api/erp-accounting/metal-rates',
    '/api/erp-accounting/reports/market-prices',
    '/api/realtime',
  ]

  const shouldSkipApiRateLimit = (req) => {
    if (!isProduction) return true
    const path = String(req.originalUrl || req.url || '').split('?')[0]
    if (authRateLimitPaths.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    )) {
      return true
    }
    return rateLimitExcludedPrefixes.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    )
  }

  const apiLimiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_MAX || 1200),
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipApiRateLimit,
    keyGenerator: (req) => {
      const ip = ipKeyGenerator(req)
      const tenant = String(req.headers['x-tenant'] || req.headers['x-company'] || 'default').trim().toLowerCase()
      return `${tenant}:${ip}`
    },
    message: { success: false, message: 'Too many requests. Please try again shortly.' },
  })

  const authLimiter = rateLimit({
    windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.AUTH_RATE_LIMIT_MAX || 50),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !isProduction,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
      const ip = ipKeyGenerator(req)
      const identity = String(req.body?.name || req.body?.email || '').trim().toLowerCase()
      return identity ? `${ip}:${identity}` : ip
    },
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
        'http://localhost:5175',
        'http://127.0.0.1:5175',
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
          const isDevPort = url.port === '5173' || url.port === '5174' || url.port === '5175'
          if (isLocalHost && isDevPort) return callback(null, true)
        } catch {
          // Ignore malformed origins and continue allowlist checks.
        }
      }
      if (allowedOrigins.includes(origin)) return callback(null, true)
      callback(new Error(`CORS: origin not allowed — ${origin}`))
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant', 'x-company', 'x-metal-rates-bridge-token', 'x-csrf-token', 'x-xsrf-token', 'x-requested-with', 'Last-Event-ID'],
  }))
  app.use(cookieParser())
  app.use(express.json({ limit: REQUEST_BODY_LIMIT }))
  app.use(express.urlencoded({ extended: true, limit: REQUEST_BODY_LIMIT }))
  
  // ─── Health Check (No Auth, No Rate Limit, No CSRF) ──────────────────────
  // Liveness only — process is up. Deploy readiness uses /api/ready.
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

  const { getReadinessStatus } = require('./services/readiness')
  app.get('/api/ready', async (req, res) => {
    try {
      const status = await getReadinessStatus()
      res.status(status.ready ? 200 : 503).json(status)
    } catch (err) {
      console.error('Readiness check error:', err)
      res.status(503).json({
        success: false,
        ready: false,
        message: 'Readiness check failed',
        time: new Date(),
      })
    }
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
  app.use('/api/projects', taskRoutes)
  app.use('/api/tasks', taskRoutes) // legacy URL (e.g. stored attachment paths)
  app.use('/api/task-templates', taskTemplateRoutes)
  app.use('/api/erp', erpRoutes)
  app.use('/api/erp-accounting', erpAccountingRoutes)
  app.use('/api/attendance', attendanceRoutes)
  app.use('/api/messages', messageRoutes)
  app.use('/api/notifications', require('./routes/notifications'))
  app.use('/api/push', require('./routes/push'))
  app.use('/api/crm', crmRoutes)
  app.use('/api/department-state', departmentStateRoutes)
  app.use('/api/realtime', realtimeRoutes)
  app.use('/api/finance',    financeRoutes)
  app.use('/api/compliance', complianceRoutes)
  app.use('/api/training',   trainingRoutes)
  app.use('/api/operations/legal-documents', operationsLegalDocumentsRoutes)
  app.use('/api/admin', cleanupRoutes)
  app.use('/api/ai', aiRoutes)

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

  app.use((err, req, res, _next) => {
    if (isClientAbortError(err)) {
      if (!res.headersSent) res.status(400).end()
      return
    }
    console.error('Unhandled error:', err)
    if (sentryEnabled) Sentry.captureException(err)
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Something went wrong.' })
    }
  })

  return app
}

module.exports = createApp
