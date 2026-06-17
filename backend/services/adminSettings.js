const DepartmentState = require('../models/DepartmentState')

const PERSISTENT_SESSION_MAX_AGE_MS = Number(
  process.env.PERSISTENT_SESSION_MAX_AGE_MS || 10 * 365 * 24 * 60 * 60 * 1000,
)

const DEFAULT_ADMIN_SETTINGS = {
  passwordPolicy: 'strong',
  sessionTimeoutMinutes: '0',
}

async function loadAdminSettings(tenant) {
  const normalized = String(tenant || '').trim().toLowerCase()
  if (!normalized) return { ...DEFAULT_ADMIN_SETTINGS }

  try {
    const Model = await DepartmentState.getTenantModel(normalized)
    const row = await Model.findOne({ module: 'admin' }).lean()
    return { ...DEFAULT_ADMIN_SETTINGS, ...(row?.state || {}) }
  } catch {
    return { ...DEFAULT_ADMIN_SETTINGS }
  }
}

function validatePasswordPolicy(password, policy = DEFAULT_ADMIN_SETTINGS.passwordPolicy) {
  const pwd = String(password || '')
  const normalized = String(policy || 'strong').trim().toLowerCase()

  if (normalized === 'basic') {
    if (pwd.length < 6) return 'Password must be at least 6 characters.'
    return null
  }

  if (pwd.length < 8) return 'Password must be at least 8 characters.'

  if (normalized === 'medium') return null

  if (!/[A-Za-z]/.test(pwd) || !/\d/.test(pwd)) {
    return 'Password must include letters and numbers.'
  }
  if (!/[^A-Za-z0-9]/.test(pwd)) {
    return 'Password must include a symbol.'
  }
  return null
}

function isPersistentSessionForced() {
  return String(process.env.FORCE_PERSISTENT_SESSION || '').trim().toLowerCase() === 'true'
}

function resolveSessionMaxAgeMs(settings = DEFAULT_ADMIN_SETTINGS) {
  if (isPersistentSessionForced()) {
    return PERSISTENT_SESSION_MAX_AGE_MS
  }

  const minutes = Number.parseInt(String(settings?.sessionTimeoutMinutes ?? ''), 10)
  // 0 = stay signed in until logout (persistent session).
  if (minutes === 0) {
    return PERSISTENT_SESSION_MAX_AGE_MS
  }
  if (Number.isFinite(minutes) && minutes >= 5 && minutes <= 1440) {
    return minutes * 60 * 1000
  }
  return PERSISTENT_SESSION_MAX_AGE_MS
}

function resolveJwtExpiresIn(maxAgeMs) {
  const seconds = Math.max(300, Math.floor(Number(maxAgeMs || 0) / 1000))
  return `${seconds}s`
}

module.exports = {
  DEFAULT_ADMIN_SETTINGS,
  PERSISTENT_SESSION_MAX_AGE_MS,
  loadAdminSettings,
  validatePasswordPolicy,
  isPersistentSessionForced,
  resolveSessionMaxAgeMs,
  resolveJwtExpiresIn,
}
