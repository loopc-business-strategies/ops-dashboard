const mongoose = require('mongoose')
const { getTenantUri, getLegacyMongoUri, normalizeTenant } = require('../config/tenants')

const tenantConnectionPromises = new Map()

async function connectTenant(tenant) {
  const normalized = normalizeTenant(tenant)
  if (!normalized) {
    throw new Error('Invalid tenant key.')
  }

  if (!tenantConnectionPromises.has(normalized)) {
    const uri = getTenantUri(normalized)
    if (!uri) {
      throw new Error(`Mongo URI not configured for tenant: ${normalized}`)
    }

    const connectionPromise = (async () => {
      try {
        return await mongoose
          .createConnection(uri, {
            autoIndex: true,
          })
          .asPromise()
      } catch (err) {
        const legacyUri = getLegacyMongoUri()
        const shouldRetryWithLegacy =
          legacyUri &&
          legacyUri !== uri &&
          (String(err?.message || '').includes('querySrv') || String(err?.code || '').includes('ECONNREFUSED'))

        if (!shouldRetryWithLegacy) {
          throw err
        }

        return mongoose
          .createConnection(legacyUri, {
            autoIndex: true,
          })
          .asPromise()
      }
    })().catch((err) => {
      tenantConnectionPromises.delete(normalized)
      throw err
    })

    tenantConnectionPromises.set(normalized, connectionPromise)
  }

  return tenantConnectionPromises.get(normalized)
}

module.exports = {
  connectTenant,
}
