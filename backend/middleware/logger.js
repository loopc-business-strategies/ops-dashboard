/**
 * Request Logging Middleware
 * Logs all API requests with:
 * - HTTP method, URL, status
 * - Response time
 * - User info (if authenticated)
 * - Request/Response size
 * - Errors (if any)
 */

const fs = require('fs')
const path = require('path')

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs')
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

// Log file paths
const requestLogFile = path.join(logsDir, 'requests.log')
const errorLogFile = path.join(logsDir, 'errors.log')

// ──────────────────────────────────────────────────────────────
// Format log entry
// ──────────────────────────────────────────────────────────────
function formatLogEntry(req, res, duration, reqSize, resSize) {
  const timestamp = new Date().toISOString()
  const method = req.method
  const url = req.originalUrl
  const status = res.statusCode
  const userId = req.user?.id || req.user?._id || 'anonymous'
  const userRole = req.user?.role || 'guest'
  const ip = req.ip || req.connection.remoteAddress

  return {
    timestamp,
    method,
    url,
    status,
    userId,
    userRole,
    ip,
    duration: `${duration.toFixed(2)}ms`,
    reqSize: `${(reqSize / 1024).toFixed(2)}KB`,
    resSize: `${(resSize / 1024).toFixed(2)}KB`,
    userAgent: req.get('user-agent') || 'unknown',
  }
}

// ──────────────────────────────────────────────────────────────
// Append log to file
// ──────────────────────────────────────────────────────────────
function writeLog(logFile, entry) {
  const logLine = JSON.stringify(entry) + '\n'
  fs.appendFile(logFile, logLine, (err) => {
    if (err) console.error('Failed to write log:', err.message)
  })
}

// ──────────────────────────────────────────────────────────────
// Main logging middleware
// ──────────────────────────────────────────────────────────────
function requestLoggerMiddleware(req, res, next) {
  const startTime = Date.now()
  
  // Capture request size
  const reqSize = JSON.stringify(req.body || {}).length + (req.url?.length || 0)

  // Intercept response.send to log response size
  const originalSend = res.send
  res.send = function (data) {
    const resSize = JSON.stringify(data || {}).length
    const duration = Date.now() - startTime

    // Format and log
    const logEntry = formatLogEntry(req, res, duration, reqSize, resSize)

    // Write to request log
    writeLog(requestLogFile, logEntry)

    // Write to error log if status >= 400
    if (res.statusCode >= 400) {
      const errorEntry = {
        ...logEntry,
        errorMessage: typeof data === 'object' ? data.message : data,
        stack: req.app?.locals?.errorStack || 'N/A',
      }
      writeLog(errorLogFile, errorEntry)
    }

    // Log to console in development
    const isDev = process.env.NODE_ENV !== 'production'
    if (isDev) {
      const statusColor = res.statusCode >= 400 ? '\x1b[31m' : res.statusCode >= 300 ? '\x1b[33m' : '\x1b[32m'
      console.log(
        `${statusColor}${logEntry.method} ${logEntry.url} → ${logEntry.status} (${logEntry.duration})\x1b[0m`
      )
    }

    // Call original send
    return originalSend.call(this, data)
  }

  next()
}

// ──────────────────────────────────────────────────────────────
// Log retrieval functions (for admin dashboard)
// ──────────────────────────────────────────────────────────────
function getRecentLogs(limit = 100) {
  try {
    const logs = fs.readFileSync(requestLogFile, 'utf-8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
      .slice(-limit)
    return logs
  } catch (error) {
    return []
  }
}

function getErrorLogs(limit = 50) {
  try {
    const logs = fs.readFileSync(errorLogFile, 'utf-8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
      .slice(-limit)
    return logs
  } catch (error) {
    return []
  }
}

function searchLogs(query, limit = 50) {
  try {
    const logs = fs.readFileSync(requestLogFile, 'utf-8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
      .filter(log => 
        log.url.includes(query) || 
        log.userId.includes(query) || 
        log.method.includes(query)
      )
      .slice(-limit)
    return logs
  } catch (error) {
    return []
  }
}

module.exports = {
  requestLoggerMiddleware,
  getRecentLogs,
  getErrorLogs,
  searchLogs,
}
