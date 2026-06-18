require('./_destructive-guard')({ scriptName: __filename })
require('dotenv').config();
const bcrypt = require('bcryptjs');
const User = require('../../models/User');

async function main() {
  const mgAdminPassword = process.env.MG_ADMIN_PASSWORD;
  if (!mgAdminPassword) throw new Error('MG_ADMIN_PASSWORD is required.');

  const Model = await User.getTenantModel('mg');
  const hash = await bcrypt.hash(mgAdminPassword, 10);

  await Model.updateOne(
    { name: 'mgadmin' },
    {
      $set: {
        name: 'mgadmin',
        email: 'mgadmin@system.local',
        password: hash,
        role: 'super_admin',
        company: 'mg',
      },
    },
    { upsert: true }
  );

  const users = await Model.find({}, 'name role email company').lean();
  console.log(JSON.stringify({ users }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
