const SalesAiTenantSettings = require('../../models/SalesAiTenantSettings')
const { normalizeTenant } = require('../../config/tenants')

const tenantAutoOverrides = new Map()

function envFlag(name, defaultValue = false) {
  const raw = String(process.env[name] || '').trim().toLowerCase()
  if (!raw) return defaultValue
  return raw === 'true' || raw === '1' || raw === 'yes'
}

function getProactiveIntervalMs() {
  return Number(process.env.SALES_AI_PROACTIVE_INTERVAL_MS || 900_000)
}

function getMaxTavilySearches() {
  return Number(process.env.SALES_AI_MAX_TAVILY_SEARCHES || 2)
}

function getStaleDealDays() {
  return Number(process.env.SALES_AI_STALE_DEAL_DAYS || 7)
}

function getInboxFollowupHours() {
  return Number(process.env.SALES_AI_INBOX_FOLLOWUP_HOURS || 48)
}

function isAutoGloballyEnabled() {
  return envFlag('SALES_AI_AUTO_ENABLED', true)
}

function isProactiveJobEnabled() {
  return envFlag('SALES_AI_PROACTIVE_JOB', true)
}

function isAutoEnabledForTenant(tenantKey) {
  if (!isAutoGloballyEnabled()) return false
  const key = normalizeTenant(tenantKey)
  if (tenantAutoOverrides.has(key)) return tenantAutoOverrides.get(key)
  return true
}

async function loadTenantAutoSettings(tenantKey) {
  const key = normalizeTenant(tenantKey)
  try {
    const row = await SalesAiTenantSettings.findOne({ tenant: key }).lean()
    if (row && typeof row.autoEnabled === 'boolean') {
      tenantAutoOverrides.set(key, row.autoEnabled)
      return row.autoEnabled
    }
  } catch (_) { /* model may not exist yet in tests */ }
  return isAutoEnabledForTenant(key)
}

async function setTenantAutoEnabled(tenantKey, enabled, userId) {
  const key = normalizeTenant(tenantKey)
  tenantAutoOverrides.set(key, Boolean(enabled))
  await SalesAiTenantSettings.findOneAndUpdate(
    { tenant: key },
    { $set: { autoEnabled: Boolean(enabled), updatedBy: userId, updatedAt: new Date() } },
    { upsert: true, returnDocument: 'after' },
  )
  return Boolean(enabled)
}

function getAutomationConfig(tenantKey) {
  const tenant = normalizeTenant(tenantKey)
  return {
    autoEnabled: isAutoEnabledForTenant(tenant),
    autoGloballyEnabled: isAutoGloballyEnabled(),
    proactiveJobEnabled: isProactiveJobEnabled(),
    proactiveIntervalMs: getProactiveIntervalMs(),
    staleDealDays: getStaleDealDays(),
    inboxFollowupHours: getInboxFollowupHours(),
    maxTavilySearches: getMaxTavilySearches(),
    synthesisMode: String(process.env.SALES_AI_SYNTHESIS_MODE || 'auto').trim().toLowerCase(),
    automationMode: true,
  }
}

module.exports = {
  envFlag,
  getProactiveIntervalMs,
  getMaxTavilySearches,
  getStaleDealDays,
  getInboxFollowupHours,
  isAutoGloballyEnabled,
  isProactiveJobEnabled,
  isAutoEnabledForTenant,
  loadTenantAutoSettings,
  setTenantAutoEnabled,
  getAutomationConfig,
}
