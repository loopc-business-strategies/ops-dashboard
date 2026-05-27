const mongoose = require('mongoose')
const { getTenantUri, normalizeTenant } = require('../config/tenants')

const tenantConnectionPromises = new Map()

function envBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue
  return String(value).trim().toLowerCase() === 'true'
}

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
      const mongoOptions = {
        autoIndex: true,
        serverSelectionTimeoutMS: 10000,   // fail fast if Atlas SRV unreachable
        socketTimeoutMS:          45000,   // drop idle sockets after 45s
        connectTimeoutMS:         10000,   // initial TCP timeout
        maxPoolSize:              10,      // connection pool per tenant
        retryWrites:              true,
      }
      try {
        return await mongoose
          .createConnection(uri, mongoOptions)
          .asPromise()
      } catch (err) {
        throw new Error(
          `Tenant DB connection failed for "${normalized}". ` +
          `Original error: ${err.message}`
        )
      }
    })().catch((err) => {
      tenantConnectionPromises.delete(normalized)
      throw err
    })

    tenantConnectionPromises.set(normalized, connectionPromise)
  }

  return tenantConnectionPromises.get(normalized)
}

async function closeAllTenantConnections() {
  const pending = [...tenantConnectionPromises.entries()]
  tenantConnectionPromises.clear()

  await Promise.allSettled(
    pending.map(async ([, connectionPromise]) => {
      const connection = await connectionPromise.catch(() => null)
      if (connection?.readyState === 1) {
        await connection.close()
      }
    }),
  )
}

module.exports = {
  connectTenant,
  closeAllTenantConnections,
}
