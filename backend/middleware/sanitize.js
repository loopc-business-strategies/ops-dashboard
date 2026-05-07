/**
 * Input Validation Middleware
 * 
 * Protects against:
 * - Prototype pollution via dangerous key names (__proto__, constructor, prototype)
 * - NoSQL injection via $ query operators (via Joi validation at route level)
 * 
 * IMPORTANT: This middleware does NOT sanitize string content.
 * Sanitization should happen at render time on the frontend, not on input.
 * Mutating input strings can corrupt passwords, accounting text, and user data.
 */

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

    // Input values are preserved as-is.
    // Joi schema validation happens at each route handler.
    // XSS protection happens at render time on the frontend.
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
