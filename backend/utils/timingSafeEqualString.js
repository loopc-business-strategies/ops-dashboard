const crypto = require('crypto')

/**
 * Constant-time string compare for secrets/tokens.
 * Unequal lengths return false after a timingSafeEqual burn on `a`.
 */
function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a ?? ''), 'utf8')
  const right = Buffer.from(String(b ?? ''), 'utf8')
  if (left.length !== right.length) {
    crypto.timingSafeEqual(left, left)
    return false
  }
  return crypto.timingSafeEqual(left, right)
}

module.exports = {
  timingSafeEqualString,
}
