const DepartmentState = require('../models/DepartmentState')

const DEFAULT_ADMIN_SETTINGS = {
  passwordPolicy: 'strong',
  sessionTimeoutMinutes: '30',
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

function resolveSessionMaxAgeMs(settings = DEFAULT_ADMIN_SETTINGS) {
  const minutes = Number.parseInt(String(settings?.sessionTimeoutMinutes ?? ''), 10)
  if (Number.isFinite(minutes) && minutes >= 5 && minutes <= 1440) {
    return minutes * 60 * 1000
  }
  return Number(process.env.COOKIE_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000)
}

function resolveJwtExpiresIn(maxAgeMs) {
  const seconds = Math.max(300, Math.floor(Number(maxAgeMs || 0) / 1000))
  return `${seconds}s`
}

module.exports = {
  DEFAULT_ADMIN_SETTINGS,
  loadAdminSettings,
  validatePasswordPolicy,
  resolveSessionMaxAgeMs,
  resolveJwtExpiresIn,
}
