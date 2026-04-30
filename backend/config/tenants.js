const TENANT_KEYS = ['mg', 'cg', 'loopc']

const TENANTS = {
  mg: {
    key: 'mg',
    name: 'MG',
    envVar: 'MONGO_URI_MG',
  },
  cg: {
    key: 'cg',
    name: 'CG',
    envVar: 'MONGO_URI_CG',
  },
  loopc: {
    key: 'loopc',
    name: 'LoopC',
    envVar: 'MONGO_URI_LOOPC',
  },
}

function getLegacyMongoUri() {
  if (process.env.MONGO_URI) {
    return process.env.MONGO_URI
  }

  const DB_USER = process.env.DB_USER
  const DB_PASS = process.env.DB_PASS
  const DB_CLUSTER = process.env.DB_CLUSTER
  const DB_NAME = process.env.DB_NAME || 'ops-dashboard'
  const DB_PARAMS = process.env.DB_PARAMS || 'retryWrites=true&w=majority'

  if (!DB_USER || !DB_PASS || !DB_CLUSTER) {
    return null
  }

  const encodedPass = encodeURIComponent(DB_PASS)
  return `mongodb+srv://${DB_USER}:${encodedPass}@${DB_CLUSTER}/${DB_NAME}?${DB_PARAMS}`
}

function normalizeTenant(value) {
  const tenant = String(value || '').trim().toLowerCase()
  if (!tenant) return null
  if (!TENANT_KEYS.includes(tenant)) return null
  return tenant
}

function getDefaultTenant() {
  return normalizeTenant(process.env.DEFAULT_TENANT) || 'loopc'
}

function getTenantUri(tenant) {
  const normalized = normalizeTenant(tenant)
  if (!normalized) return null
  const cfg = TENANTS[normalized]
  const uri = process.env[cfg.envVar]
  return uri || getLegacyMongoUri()
}

module.exports = {
  TENANT_KEYS,
  TENANTS,
  normalizeTenant,
  getDefaultTenant,
  getTenantUri,
}
