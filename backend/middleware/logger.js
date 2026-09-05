/**
 * Request Logging Middleware
 * Production: lightweight metrics (no body stringify / disk I/O on success paths).
 * Development: fuller console + optional disk logs for debugging.
 */

const fs = require('fs')
const path = require('path')
const jwt = require('jsonwebtoken')
const { readSessionTokenFromCookieMap } = require('../utils/tenantSessionCookies')
const { isProductionEnv } = require('../utils/securityEnv')

const logsDir = path.join(__dirname, '../logs')
const isProduction = isProductionEnv()

if (!isProduction && !fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

const requestLogFile = path.join(logsDir, 'requests.log')
const errorLogFile = path.join(logsDir, 'errors.log')

const SKIP_LOG_PREFIXES = [
  '/api/health',
  '/api/ready',
  '/api/realtime',
  '/api/erp-accounting/reports/market-prices',
  '/api/erp-accounting/metal-rates',
]

function shouldSkipLogging(req) {
  const url = String(req.originalUrl || req.url || '').split('?')[0]
  return SKIP_LOG_PREFIXES.some((prefix) => url === prefix || url.startsWith(`${prefix}/`))
}

function resolveUserFromRequest(req) {
  if (req.user) {
    return { userId: String(req.user._id || req.user.id), userRole: req.user.role || 'unknown' }
  }
  if (req.authJwt?.id) {
    return { userId: String(req.authJwt.id), userRole: 'session' }
  }
  try {
    const token = readSessionTokenFromCookieMap(req.cookies, {
      hostname: req.hostname,
      headerTenant: req.headers['x-tenant'] || req.headers['x-company'],
    })
    if (token && process.env.JWT_SECRET) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
      return { userId: String(decoded.id || 'decoded'), userRole: 'session' }
    }
  } catch {
    // Expired / invalid — not an error at log level
  }
  return { userId: 'anonymous', userRole: 'guest' }
}

function estimateSize(value) {
  if (value == null) return 0
  if (Buffer.isBuffer(value)) return value.length
  if (typeof value === 'string') return value.length
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value).length
    } catch {
      return 0
    }
  }
  return String(value).length
}

function formatLogEntry(req, res, duration, reqSize, resSize) {
  const { userId, userRole } = resolveUserFromRequest(req)
  return {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    status: res.statusCode,
    userId,
    userRole,
    ip: req.ip || req.connection?.remoteAddress || 'unknown',
    duration: `${duration.toFixed(2)}ms`,
    reqSize: `${(reqSize / 1024).toFixed(2)}KB`,
    resSize: `${(resSize / 1024).toFixed(2)}KB`,
    userAgent: req.get('user-agent') || 'unknown',
  }
}

function writeLog(logFile, entry) {
  const logLine = JSON.stringify(entry) + '\n'
  fs.appendFile(logFile, logLine, (err) => {
    if (err) console.error('Failed to write log:', err.message)
  })
}

function requestLoggerMiddleware(req, res, next) {
  if (shouldSkipLogging(req)) return next()

  const startTime = Date.now()
  const contentLength = Number(req.headers['content-length']) || 0
  const reqSize = contentLength || (req.url?.length || 0)

  const originalSend = res.send
  res.send = function (data) {
    const duration = Date.now() - startTime
    const status = res.statusCode
    const isError = status >= 400

    if (isProduction) {
      if (isError) {
        const resSize = estimateSize(data)
        const logEntry = formatLogEntry(req, res, duration, reqSize, resSize)
        const errorMessage = typeof data === 'object' && data && data.message
          ? data.message
          : (typeof data === 'string' ? data.slice(0, 200) : undefined)
        console.error(JSON.stringify({
          level: 'error',
          ...logEntry,
          errorMessage,
        }))
      }
      return originalSend.call(this, data)
    }

    const resSize = estimateSize(data)
    const logEntry = formatLogEntry(req, res, duration, reqSize, resSize)
    writeLog(requestLogFile, logEntry)

    if (isError) {
      writeLog(errorLogFile, {
        ...logEntry,
        errorMessage: typeof data === 'object' ? data?.message : data,
        stack: req.app?.locals?.errorStack || 'N/A',
      })
    }

    const statusColor = status >= 400 ? '\x1b[31m' : status >= 300 ? '\x1b[33m' : '\x1b[32m'
    console.log(
      `${statusColor}${logEntry.method} ${logEntry.url} → ${logEntry.status} (${logEntry.duration})\x1b[0m`,
    )

    return originalSend.call(this, data)
  }

  next()
}

function getRecentLogs(limit = 100) {
  try {
    const logs = fs.readFileSync(requestLogFile, 'utf-8')
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line))
      .slice(-limit)
    return logs
  } catch {
    return []
  }
}

function getErrorLogs(limit = 50) {
  try {
    const logs = fs.readFileSync(errorLogFile, 'utf-8')
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line))
      .slice(-limit)
    return logs
  } catch {
    return []
  }
}

function searchLogs(query, limit = 50) {
  try {
    const logs = fs.readFileSync(requestLogFile, 'utf-8')
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line))
      .filter((log) =>
        log.url.includes(query)
        || log.userId.includes(query)
        || log.method.includes(query))
      .slice(-limit)
    return logs
  } catch {
    return []
  }
}

module.exports = {
  requestLoggerMiddleware,
  getRecentLogs,
  getErrorLogs,
  searchLogs,
}
