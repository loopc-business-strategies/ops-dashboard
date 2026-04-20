/**
 * Input Sanitization Middleware
 * Protects against:
 * - XSS (Cross-Site Scripting) attacks
 * - NoSQL injection attacks
 * - HTML injection
 */

const mongoSanitize = require('mongo-sanitize')
const xss = require('xss')

// ──────────────────────────────────────────────────────────────
// Recursive sanitization helper
// ──────────────────────────────────────────────────────────────
function sanitizeData(data) {
  if (typeof data === 'string') {
    // Remove MongoDB query operators
    let sanitized = mongoSanitize(data)
    // Remove XSS patterns
    sanitized = xss(sanitized, {
      whiteList: {},
      stripIgnoredTag: true,
    })
    return sanitized
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item))
  }
  if (data !== null && typeof data === 'object') {
    const sanitized = {}
    for (const [key, value] of Object.entries(data)) {
      // Sanitize object keys to prevent prototype pollution
      const sanitizedKey = key.replace(/[^a-zA-Z0-9_.-]/g, '')
      sanitized[sanitizedKey] = sanitizeData(value)
    }
    return sanitized
  }
  return data
}

// ──────────────────────────────────────────────────────────────
// Main sanitization middleware
// ──────────────────────────────────────────────────────────────
function sanitizeMiddleware(req, res, next) {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeData(req.body)
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeData(req.query)
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeData(req.params)
    }

    next()
  } catch (error) {
    console.error('Sanitization error:', error.message)
    res.status(400).json({
      success: false,
      message: 'Invalid input format',
      error: error.message,
    })
  }
}

module.exports = sanitizeMiddleware
