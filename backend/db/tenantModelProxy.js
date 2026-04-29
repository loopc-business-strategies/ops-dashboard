const mongoose = require('mongoose')
const { AsyncLocalStorage } = require('async_hooks')
const { connectTenant } = require('./tenantConnections')
const { registerTenantSchema, registerAllOnConnection } = require('./tenantModelRegistry')

const tenantModelStorage = new AsyncLocalStorage()

function createTenantModel(modelName, schema) {
  registerTenantSchema(modelName, schema)

  const defaultModel = mongoose.models[modelName] || mongoose.model(modelName, schema)

  const resolveModel = () => {
    const store = tenantModelStorage.getStore()
    if (!store?.connection) return defaultModel

    registerAllOnConnection(store.connection)
    return store.connection.models[modelName] || store.connection.model(modelName, schema)
  }

  return new Proxy(defaultModel, {
    get(_target, prop) {
      if (prop === 'schema') return schema
      if (prop === 'getTenantModel') {
        return async (tenant) => {
          const connection = await connectTenant(tenant)
          registerAllOnConnection(connection)
          return connection.models[modelName] || connection.model(modelName, schema)
        }
      }

      const model = resolveModel()
      const value = model[prop]
      return typeof value === 'function' ? value.bind(model) : value
    },
  })
}

function runWithTenantConnection(connection, tenant, callback) {
  return tenantModelStorage.run({ connection, tenant }, callback)
}

module.exports = {
  createTenantModel,
  runWithTenantConnection,
}
