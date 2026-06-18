/**
 * Input Validation Middleware
 *
 * Protects against:
 * - Prototype pollution via dangerous key names (__proto__, constructor, prototype)
 * - NoSQL injection via MongoDB query operators in keys ($gt, $ne, etc.)
 *
 * String values are preserved as-is so passwords and accounting text are not mutated.
 * XSS protection happens at render time on the frontend.
 */

const mongoSanitize = require('mongo-sanitize')

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
// Main validation middleware — reject dangerous keys but preserve all values
// ──────────────────────────────────────────────────────────────
function sanitizePart(part) {
  if (!part || typeof part !== 'object') return part
  if (hasDangerousKey(part)) return null
  return mongoSanitize(part)
}

function sanitizeMiddleware(req, res, next) {
  try {
    const sanitizedBody = sanitizePart(req.body)
    const sanitizedQuery = sanitizePart(req.query)
    const sanitizedParams = sanitizePart(req.params)

    if (sanitizedBody === null || sanitizedQuery === null || sanitizedParams === null) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input: prohibited keys detected.',
      })
    }

    if (sanitizedBody !== undefined) req.body = sanitizedBody
    if (sanitizedQuery !== undefined) req.query = sanitizedQuery
    if (sanitizedParams !== undefined) req.params = sanitizedParams

    next()
  } catch (error) {
    console.error('Validation error:', error.message)
    res.status(400).json({
      success: false,
      message: 'Invalid input format.',
    })
  }
}

module.exports = sanitizeMiddleware
