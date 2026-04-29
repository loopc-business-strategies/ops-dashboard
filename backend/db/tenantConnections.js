const mongoose = require('mongoose')
const { getTenantUri, normalizeTenant } = require('../config/tenants')

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

    const connectionPromise = mongoose
      .createConnection(uri, {
        autoIndex: true,
      })
      .asPromise()
      .catch((err) => {
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
