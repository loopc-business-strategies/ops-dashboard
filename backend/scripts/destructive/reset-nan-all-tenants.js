require('./_destructive-guard')({ scriptName: __filename })
require('dotenv').config()

const User = require('../../models/User')
const { TENANT_KEYS } = require('../../config/tenants')
const { connectTenant } = require('../../db/tenantConnections')

const TARGET_NAME = process.env.ADMIN_USERNAME || 'Nan'
const TARGET_PASSWORD = process.env.TARGET_PASSWORD

if (!TARGET_PASSWORD) {
  throw new Error('TARGET_PASSWORD is required.')
}

async function ensureNanForTenant(tenant) {
  const TenantUser = await User.getTenantModel(tenant)
  let user = await TenantUser.findOne({ name: { $regex: new RegExp(`^${TARGET_NAME}$`, 'i') } }).select('+password')

  if (!user) {
    user = new TenantUser({
      name: TARGET_NAME,
      email: `${TARGET_NAME.toLowerCase()}@system.local`,
      password: TARGET_PASSWORD,
      role: 'super_admin',
      department: '',
      isActive: true,
    })
    await user.save()
    return { tenant, action: 'created' }
  }

  user.name = TARGET_NAME
  user.password = TARGET_PASSWORD
  user.role = 'super_admin'
  user.department = ''
  user.isActive = true

  if (!user.email || !/^\S+@\S+\.\S+$/.test(String(user.email))) {
    user.email = `${TARGET_NAME.toLowerCase()}@system.local`
  }

  await user.save()
  return { tenant, action: 'updated' }
}

async function run() {
  if (String(TARGET_PASSWORD).length < 6) {
    throw new Error('Password must be at least 6 characters.')
  }

  const openedConnections = []

  try {
    for (const tenant of TENANT_KEYS) {
      const conn = await connectTenant(tenant)
      openedConnections.push(conn)
      const result = await ensureNanForTenant(tenant)
      console.log(`[${result.tenant}] ${result.action} user ${TARGET_NAME}`)
    }

    console.log('Done: Nan is ready in all tenants.')
  } finally {
    await Promise.allSettled(
      openedConnections.map((conn) => conn?.close?.())
    )
  }
}

run().catch((err) => {
  console.error('Failed:', err.message)
  process.exit(1)
})
