const {
  getDefaultTenant,
  normalizeTenantKey,
  resolveTenantFromHostOrNull,
} = require('../config/tenantRegistry')

function firstHeaderValue(value) {
  return String(value || '').split(',')[0].trim()
}

function hostnameFromUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    return new URL(raw).hostname
  } catch {
    return ''
  }
}

function getRequestHostname(req) {
  const forwarded = firstHeaderValue(req?.headers?.['x-forwarded-host'])
  if (forwarded) return forwarded
  const originHost = hostnameFromUrl(req?.headers?.origin)
  if (originHost) return originHost
  const refererHost = hostnameFromUrl(req?.headers?.referer)
  if (refererHost) return refererHost
  if (req?.hostname) return req.hostname
  return firstHeaderValue(req?.headers?.host)
}

/**
 * Resolve tenant for API requests that may arrive via:
 * - tenant portal rewrite (Host becomes api.loopcstrategies.com)
 * - browser Origin/Referer on the portal
 * - explicit x-tenant / company fields
 *
 * Portal host wins over a spoofed x-tenant when the host is a known tenant.
 */
function resolveTenantFromRequest(req, extraHint) {
  const forwardedTenant = resolveTenantFromHostOrNull(firstHeaderValue(req?.headers?.['x-forwarded-host']))
  const originTenant = resolveTenantFromHostOrNull(
    hostnameFromUrl(req?.headers?.origin || req?.headers?.referer),
  )
  const hostTenant = resolveTenantFromHostOrNull(req?.hostname || firstHeaderValue(req?.headers?.host))
  const extra = normalizeTenantKey(extraHint)
  const headerTenant = normalizeTenantKey(req?.headers?.['x-tenant'] || req?.headers?.['x-company'])
  const queryTenant = normalizeTenantKey(req?.query?.tenant || req?.query?.company)

  return forwardedTenant
    || originTenant
    || hostTenant
    || extra
    || headerTenant
    || queryTenant
    || getDefaultTenant()
}

module.exports = {
  getRequestHostname,
  resolveTenantFromRequest,
}
