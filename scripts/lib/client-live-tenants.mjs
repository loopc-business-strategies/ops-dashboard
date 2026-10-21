/**
 * Tenants handed to clients — refuse bulk wipe / empty-books / master reset
 * unless explicitly unlocked for a targeted ops action.
 *
 * Emergency unlock (in addition to the script's own I_UNDERSTAND token):
 *   CLIENT_LIVE_UNLOCK=UNLOCK-CLIENT-LIVE-VB
 *   CLIENT_LIVE_UNLOCK=UNLOCK-CLIENT-LIVE-MG
 */

export const CLIENT_LIVE_TENANTS = Object.freeze({
  mg: {
    label: 'Modern Gold',
    unlockToken: 'UNLOCK-CLIENT-LIVE-MG',
  },
  vb: {
    label: 'Venus Bullion',
    unlockToken: 'UNLOCK-CLIENT-LIVE-VB',
  },
})

export function assertClientLiveAllowsDestructive(tenantKey, { action = 'destructive data op' } = {}) {
  const key = String(tenantKey || '').trim().toLowerCase()
  const entry = CLIENT_LIVE_TENANTS[key]
  if (!entry) return

  const unlock = String(process.env.CLIENT_LIVE_UNLOCK || '').trim()
  if (unlock === entry.unlockToken) return

  console.error(`Refusing ${action} on ${entry.label} (${key}).`)
  console.error('Tenant is CLIENT LIVE — do not wipe / void / empty books / reset masters.')
  console.error(`Emergency unlock: CLIENT_LIVE_UNLOCK=${entry.unlockToken}`)
  process.exit(1)
}
