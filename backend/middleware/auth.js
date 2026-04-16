// ==========================================
// FILE: backend/middleware/auth.js
// WHAT THIS DOES:
//   These are "guards" that sit in front of routes.
//   Before a request reaches a route handler,
//   it must pass through these checks.
// ==========================================

const jwt  = require('jsonwebtoken')
const User = require('../models/User')

// -----------------------------------------------
// protect — verifies the JWT token on every request
// Add this to any route that requires login
//
// How it works:
//   1. Request comes in with header: Authorization: Bearer <token>
//   2. We extract the token
//   3. We verify it is valid and not expired
//   4. We attach the user to req.user
//   5. We call next() to proceed to the route
// -----------------------------------------------
const protect = async (req, res, next) => {
  try {
    let token

    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1]
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Please log in to access this.' })
    }

    // Verify token — throws error if invalid or expired
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Find the user this token belongs to
    const user = await User.findById(decoded.id)

    if (!user)          return res.status(401).json({ success: false, message: 'User no longer exists.' })
    if (!user.isActive) return res.status(401).json({ success: false, message: 'Account has been deactivated.' })

    req.user = user // attach user to request
    next()
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired session. Please log in again.' })
  }
}

// -----------------------------------------------
// restrictTo — only allow specific roles
// Usage: router.get('/admin', protect, restrictTo('super_admin'), handler)
// -----------------------------------------------
const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Required role: ${roles.join(' or ')}.`,
    })
  }
  next()
}

module.exports = { protect, restrictTo }
