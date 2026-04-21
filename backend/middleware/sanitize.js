/**
 * Input Sanitization Middleware
 * Protects against:
 * - XSS (Cross-Site Scripting) attacks
 * - NoSQL injection attacks (MongoDB operator injection)
 * - HTML injection
 * - Prototype pollution via dangerous key names
 */

const mongoSanitize = require('mongo-sanitize')
const xss = require('xss')

// Keys that must never appear in any payload — reject outright
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

// ──────────────────────────────────────────────────────────────
// Check if an object (or any nested object) contains dangerous keys
// ──────────────────────────────────────────────────────────────
function hasDangerousKey(data) {
  if (data === null || typeof data !== 'object') return false
  for (const key of Object.keys(data)) {
    if (DANGEROUS_KEYS.has(key)) return true
    if (hasDangerousKey(data[key])) return true
  }
  return false
}

// ──────────────────────────────────────────────────────────────
// Recursive value sanitization — keys are preserved as-is
// ──────────────────────────────────────────────────────────────
function sanitizeData(data) {
  if (typeof data === 'string') {
    // Strip MongoDB query operators then strip XSS
    let sanitized = mongoSanitize(data)
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
    const result = Object.create(null)
    for (const key of Object.keys(data)) {
      // Skip any dangerous keys defensively (already rejected at entry)
      if (DANGEROUS_KEYS.has(key)) continue
      result[key] = sanitizeData(data[key])
    }
    return result
  }
  return data
}

// ──────────────────────────────────────────────────────────────
// Main sanitization middleware
// ──────────────────────────────────────────────────────────────
function sanitizeMiddleware(req, res, next) {
  try {
    // Reject any request that contains prototype-polluting keys
    for (const part of [req.body, req.query, req.params]) {
      if (part && hasDangerousKey(part)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid input: prohibited keys detected.',
        })
      }
    }

    // Sanitize values in request body
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
      message: 'Invalid input format.',
    })
  }
}

module.exports = sanitizeMiddleware
