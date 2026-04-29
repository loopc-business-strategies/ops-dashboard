require('dotenv').config();

const User = require('../models/User');
const { TENANT_KEYS, getTenantUri } = require('../config/tenants');

const TARGET_NAME = 'Nan';
const TARGET_EMAIL = 'nan@system.local';
const TARGET_PASSWORD = '123456';

async function ensureUserInTenant(tenant) {
  const TenantUser = await User.getTenantModel(tenant);

  const existing = await TenantUser.findOne({ name: { $regex: '^nan$', $options: 'i' } })
    .select('+password')
    .exec();

  if (existing) {
    const samePassword = await existing.comparePassword(TARGET_PASSWORD);
    return {
      tenant,
      action: 'skipped-existing',
      name: existing.name,
      email: existing.email,
      samePassword,
    };
  }

  const created = await TenantUser.create({
    name: TARGET_NAME,
    email: TARGET_EMAIL,
    password: TARGET_PASSWORD,
    role: 'super_admin',
    department: '',
    company: tenant,
  });

  return {
    tenant,
    action: 'created',
    id: String(created._id),
    name: created.name,
    email: created.email,
  };
}

async function main() {
  const results = [];
  for (const tenant of TENANT_KEYS) {
    if (!getTenantUri(tenant)) {
      results.push({ tenant, action: 'skipped-no-uri' });
      continue;
    }
    results.push(await ensureUserInTenant(tenant));
  }
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
