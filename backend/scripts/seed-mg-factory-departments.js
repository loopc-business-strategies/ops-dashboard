#!/usr/bin/env node
/**
 * Seed MG Factory department kiosk passwords.
 *
 * Usage:
 *   node scripts/seed-mg-factory-departments.js
 *   MG_FACTORY_DEPT_PASSWORD=secret node scripts/seed-mg-factory-departments.js
 *
 * Default password per department: <key>123 (e.g. melting123)
 * Override all with MG_FACTORY_DEPT_PASSWORD.
 */
require('dotenv').config()
const mongoose = require('mongoose')
const { connectTenant } = require('../db/tenantConnections')
const { registerAllOnConnection } = require('../db/tenantModelRegistry')
const { runWithTenantConnection } = require('../db/tenantModelProxy')
const { DEFAULT_FLOW_STAGES } = require('../services/productionControl/constants')

// Ensure model is registered
require('../models/FactoryDepartmentCredential')
const FactoryDepartmentCredential = require('../models/FactoryDepartmentCredential')

async function main() {
  const defaultPassword = process.env.MG_FACTORY_DEPT_PASSWORD || null
  const connection = await connectTenant('mg')
  registerAllOnConnection(connection)

  await runWithTenantConnection(connection, 'mg', async () => {
    const Cred = connection.models.FactoryDepartmentCredential || FactoryDepartmentCredential
    let upserted = 0
    for (const stage of DEFAULT_FLOW_STAGES) {
      const key = String(stage.key).toLowerCase()
      const password = defaultPassword || `${key}123`
      const passwordHash = await FactoryDepartmentCredential.hashPassword(password)
      await Cred.findOneAndUpdate(
        { departmentKey: key },
        {
          departmentKey: key,
          label: stage.label || key,
          passwordHash,
          active: true,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      upserted += 1
      console.log(`  ${key} — password set (${defaultPassword ? 'shared env' : `${key}123`})`)
    }
    console.log(`Seeded ${upserted} MG Factory department credentials.`)
  })
}

main()
  .then(async () => {
    await mongoose.disconnect().catch(() => {})
    process.exit(0)
  })
  .catch(async (err) => {
    console.error(err)
    await mongoose.disconnect().catch(() => {})
    process.exit(1)
  })
