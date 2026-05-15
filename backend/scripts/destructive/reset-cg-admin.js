require('./_destructive-guard')({ scriptName: __filename })
require('dotenv').config();
const bcrypt = require('bcryptjs');
const User = require('../../models/User');

async function resetAdmins() {
  const cgModel = await User.getTenantModel('cg');
  const cgAdminPassword = process.env.CG_ADMIN_PASSWORD;
  const nanPassword = process.env.NAN_PASSWORD || process.env.TARGET_PASSWORD;

  if (!cgAdminPassword) throw new Error('CG_ADMIN_PASSWORD is required.');
  if (!nanPassword) throw new Error('NAN_PASSWORD or TARGET_PASSWORD is required.');

  // Ensure cgadmin exists with correct password and role
  const cgHash = await bcrypt.hash(cgAdminPassword, 10);
  await cgModel.updateOne(
    { name: 'cgadmin' },
    { $set: { name: 'cgadmin', email: 'cgadmin@system.local', password: cgHash, role: 'super_admin', company: 'cg' } },
    { upsert: true }
  );

  // Ensure Nan exists with correct password in CG
  const nanHash = await bcrypt.hash(nanPassword, 10);
  await cgModel.updateOne(
    { name: 'Nan' },
    { $set: { name: 'Nan', email: 'nan@system.local', password: nanHash, role: 'super_admin', company: 'cg' } },
    { upsert: true }
  );

  const users = await cgModel.find({}, 'name role email').lean();
  console.log(JSON.stringify({ tenant: 'cg', users }, null, 2));
}

resetAdmins().catch((err) => { console.error(err); process.exit(1); });
