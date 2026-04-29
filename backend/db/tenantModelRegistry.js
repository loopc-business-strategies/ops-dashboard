const tenantSchemaRegistry = new Map()

function registerTenantSchema(modelName, schema) {
  if (!modelName || !schema) return
  if (!tenantSchemaRegistry.has(modelName)) {
    tenantSchemaRegistry.set(modelName, schema)
  }
}

function registerAllOnConnection(connection) {
  if (!connection) return
  for (const [modelName, schema] of tenantSchemaRegistry.entries()) {
    if (!connection.models[modelName]) {
      connection.model(modelName, schema)
    }
  }
}

module.exports = {
  registerTenantSchema,
  registerAllOnConnection,
}
