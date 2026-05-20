'use strict'

/**
 * Deterministic-enough synthetic precious-metal mid prices (USD / troy oz) for
 * real-time SSE / UI testing. Not market data — do not use for decisions.
 */

const BASE = {
  gold: 2685,
  silver: 32.15,
  platinum: 1025,
  palladium: 1088,
}

let mid = null

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x))
}

function truthyEnv(name) {
  const v = String(process.env[name] || '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

function isMockRealtimeMetalsSpotEnabled() {
  if (!truthyEnv('METALS_SPOT_MOCK_REALTIME')) return false
  const prod = String(process.env.NODE_ENV || '').toLowerCase() === 'production'
  if (prod && !truthyEnv('METALS_SPOT_MOCK_REALTIME_ALLOW_PRODUCTION')) return false
  return true
}

/** Next snapshot: small independent random walk per metal (sub-second friendly). */
function advanceMockMetals() {
  if (!mid) mid = { ...BASE }
  const nudge = (key, frac) => {
    const d = (Math.random() - 0.5) * 2 * frac * mid[key]
    mid[key] = clamp(mid[key] + d, BASE[key] * 0.82, BASE[key] * 1.18)
  }
  nudge('gold', 0.00045)
  nudge('silver', 0.0009)
  nudge('platinum', 0.00065)
  nudge('palladium', 0.00075)
  return { metals: { ...mid } }
}

module.exports = {
  isMockRealtimeMetalsSpotEnabled,
  advanceMockMetals,
}
