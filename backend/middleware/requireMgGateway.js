/**
 * Dedicated MG Device Gateway authentication.
 * Headers: X-Gateway-Id + X-Gateway-Secret
 * Env: MG_GATEWAY_SECRETS="MG-GATEWAY-001=secret,MG-GATEWAY-002=other"
 *
 * Optional JWT fallback only when MG_GATEWAY_ALLOW_JWT_FALLBACK=1 (dev/staging — not production).
 * Always binds the MG tenant DB connection (gateway requests have no JWT).
 */
const { protect } = require('./auth')
const { requireMgTenant } = require('./requireMgTenant')
const { connectTenant } = require('../db/tenantConnections')
const { registerAllOnConnection } = require('../db/tenantModelRegistry')
const { runWithTenantConnection } = require('../db/tenantModelProxy')

function parseGatewaySecrets() {
  const map = new Map()
  const raw = String(process.env.MG_GATEWAY_SECRETS || '').trim()
  if (!raw) return map
  for (const pair of raw.split(',')) {
    const idx = pair.indexOf('=')
    if (idx <= 0) continue
    const id = String(pair.slice(0, idx) || '').trim().toUpperCase()
    const secret = String(pair.slice(idx + 1) || '').trim()
    if (id && secret) map.set(id, secret)
  }
  return map
}

function timingSafeEqualString(a, b) {
  const x = Buffer.from(String(a || ''), 'utf8')
  const y = Buffer.from(String(b || ''), 'utf8')
  if (x.length !== y.length) return false
  try {
    return require('crypto').timingSafeEqual(x, y)
  } catch {
    return false
  }
}

async function bindMgTenant(req, res, next) {
  req.tenant = 'mg'
  try {
    const connection = await connectTenant('mg')
    registerAllOnConnection(connection)
    return runWithTenantConnection(connection, 'mg', () => next())
  } catch (err) {
    return next(err)
  }
}

function requireMgGateway(req, res, next) {
  const gatewayId = String(
    req.headers['x-gateway-id'] || req.body?.gatewayId || '',
  )
    .trim()
    .toUpperCase()
  const secret = String(req.headers['x-gateway-secret'] || '').trim()
  const secrets = parseGatewaySecrets()

  if (secrets.size && gatewayId && !secrets.has(gatewayId)) {
    return res.status(403).json({
      success: false,
      message: 'Unknown gateway id',
      code: 'GATEWAY_UNKNOWN',
    })
  }

  if (gatewayId && secret && secrets.has(gatewayId) && timingSafeEqualString(secrets.get(gatewayId), secret)) {
    req.mgGateway = { gatewayId, authType: 'secret' }
    return bindMgTenant(req, res, next)
  }

  const allowJwtFallback =
    String(process.env.MG_GATEWAY_ALLOW_JWT_FALLBACK || '').trim() === '1'
    && process.env.NODE_ENV !== 'production'

  if (allowJwtFallback) {
    return protect(req, res, (err) => {
      if (err) return next(err)
      return requireMgTenant(req, res, () => {
        req.mgGateway = {
          gatewayId: gatewayId || 'MG-GATEWAY-JWT',
          authType: 'jwt_fallback',
        }
        return next()
      })
    })
  }

  if (!secrets.size) {
    return res.status(503).json({
      success: false,
      message: 'Gateway auth not configured (set MG_GATEWAY_SECRETS).',
      code: 'GATEWAY_AUTH_UNCONFIGURED',
    })
  }

  return res.status(401).json({
    success: false,
    message: 'Invalid or missing MG gateway credentials (X-Gateway-Id + X-Gateway-Secret).',
    code: 'GATEWAY_AUTH_REQUIRED',
  })
}

module.exports = {
  requireMgGateway,
  parseGatewaySecrets,
}
