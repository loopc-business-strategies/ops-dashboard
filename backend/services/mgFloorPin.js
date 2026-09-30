const bcrypt = require('bcryptjs')

const FLOOR_PIN_PATTERN = /^\d{4,6}$/
const FLOOR_PIN_MAX_FAILS = 5
const FLOOR_PIN_LOCK_MS = 15 * 60 * 1000

function isSequential(pin) {
  let up = true
  let down = true
  for (let i = 1; i < pin.length; i += 1) {
    const diff = Number(pin[i]) - Number(pin[i - 1])
    if (diff !== 1) up = false
    if (diff !== -1) down = false
  }
  return up || down
}

/** Returns an error message, or null when the PIN is acceptable. */
function floorPinError(pin) {
  const value = String(pin ?? '')
  if (!FLOOR_PIN_PATTERN.test(value)) return 'PIN must be 4 to 6 digits.'
  if (/^(\d)\1+$/.test(value)) return 'PIN cannot be the same digit repeated.'
  if (isSequential(value)) return 'PIN cannot be a simple sequence like 1234.'
  return null
}

async function applyFloorPin(user, pin) {
  user.floorPinHash = await bcrypt.hash(String(pin), 10)
  user.floorPinSetAt = new Date()
  user.floorPinFailedCount = 0
  user.floorPinLockedUntil = null
}

function clearFloorPin(user) {
  user.floorPinHash = null
  user.floorPinSetAt = null
  user.floorPinFailedCount = 0
  user.floorPinLockedUntil = null
}

function floorPinLockedMinutes(user, now = Date.now()) {
  const until = user?.floorPinLockedUntil ? new Date(user.floorPinLockedUntil).getTime() : 0
  if (!until || until <= now) return 0
  return Math.max(1, Math.ceil((until - now) / 60000))
}

/**
 * Checks the PIN and updates the failure counter / lock on the user document (caller saves).
 * Returns { ok, lockedMinutes }.
 */
async function verifyFloorPin(user, pin, now = Date.now()) {
  const locked = floorPinLockedMinutes(user, now)
  if (locked) return { ok: false, lockedMinutes: locked }
  if (!user.floorPinHash) return { ok: false, lockedMinutes: 0 }

  const ok = await bcrypt.compare(String(pin), user.floorPinHash)
  if (ok) {
    user.floorPinFailedCount = 0
    user.floorPinLockedUntil = null
    return { ok: true, lockedMinutes: 0 }
  }

  const fails = Number(user.floorPinFailedCount || 0) + 1
  if (fails >= FLOOR_PIN_MAX_FAILS) {
    user.floorPinFailedCount = 0
    user.floorPinLockedUntil = new Date(now + FLOOR_PIN_LOCK_MS)
    return { ok: false, lockedMinutes: Math.ceil(FLOOR_PIN_LOCK_MS / 60000) }
  }
  user.floorPinFailedCount = fails
  return { ok: false, lockedMinutes: 0 }
}

module.exports = {
  FLOOR_PIN_PATTERN,
  FLOOR_PIN_MAX_FAILS,
  FLOOR_PIN_LOCK_MS,
  floorPinError,
  applyFloorPin,
  clearFloorPin,
  floorPinLockedMinutes,
  verifyFloorPin,
}
