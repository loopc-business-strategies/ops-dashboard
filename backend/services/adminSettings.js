const DepartmentState = require('../models/DepartmentState')
const { isLocalDevEnv } = require('../utils/securityEnv')

/** Product cap: persistent / stay-signed-in sessions expire after 30 days. */
const MAX_SESSION_AGE_MS = 30 * 24 * 60 * 60 * 1000

function resolvePersistentSessionMaxAgeMs() {
  const envMs = Number(process.env.PERSISTENT_SESSION_MAX_AGE_MS)
  if (Number.isFinite(envMs) && envMs > 0) {
    return isLocalDevEnv() ? envMs : Math.min(envMs, MAX_SESSION_AGE_MS)
  }
  return MAX_SESSION_AGE_MS
}

const PERSISTENT_SESSION_MAX_AGE_MS = resolvePersistentSessionMaxAgeMs()

const DEFAULT_ADMIN_SETTINGS = {
  passwordPolicy: 'strong',
  sessionTimeoutMinutes: '0',
  idleTimeoutMinutes: '30',
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
  const cappedPersistent = Math.min(PERSISTENT_SESSION_MAX_AGE_MS, MAX_SESSION_AGE_MS)

  if (isPersistentSessionForced()) {
    return cappedPersistent
  }

  const minutes = Number.parseInt(String(settings?.sessionTimeoutMinutes ?? ''), 10)
  // 0 = stay signed in until logout (capped at 30 days).
  if (minutes === 0) {
    return cappedPersistent
  }
  if (Number.isFinite(minutes) && minutes >= 5 && minutes <= 1440) {
    return Math.min(minutes * 60 * 1000, MAX_SESSION_AGE_MS)
  }
  return cappedPersistent
}

function resolveJwtExpiresIn(maxAgeMs) {
  const seconds = Math.max(300, Math.floor(Number(maxAgeMs || 0) / 1000))
  return `${seconds}s`
}

const DEFAULT_IDLE_TIMEOUT_MINUTES = 30
const IDLE_WARNING_MINUTES = 5

function resolveIdleTimeoutMinutes(settings = DEFAULT_ADMIN_SETTINGS) {
  const minutes = Number.parseInt(String(settings?.idleTimeoutMinutes ?? ''), 10)
  if (minutes === 0) return 0
  if (Number.isFinite(minutes) && minutes >= 5 && minutes <= 1440) return minutes
  return DEFAULT_IDLE_TIMEOUT_MINUTES
}

function resolveIdleTimeoutMs(settings = DEFAULT_ADMIN_SETTINGS) {
  const minutes = resolveIdleTimeoutMinutes(settings)
  if (minutes === 0) return null
  return minutes * 60 * 1000
}

function buildWebSessionPolicy(settings = DEFAULT_ADMIN_SETTINGS) {
  return {
    idleTimeoutMinutes: resolveIdleTimeoutMinutes(settings),
    idleWarningMinutes: IDLE_WARNING_MINUTES,
  }
}

module.exports = {
  DEFAULT_ADMIN_SETTINGS,
  MAX_SESSION_AGE_MS,
  PERSISTENT_SESSION_MAX_AGE_MS,
  DEFAULT_IDLE_TIMEOUT_MINUTES,
  IDLE_WARNING_MINUTES,
  loadAdminSettings,
  validatePasswordPolicy,
  isPersistentSessionForced,
  resolveSessionMaxAgeMs,
  resolveJwtExpiresIn,
  resolveIdleTimeoutMinutes,
  resolveIdleTimeoutMs,
  buildWebSessionPolicy,
}
