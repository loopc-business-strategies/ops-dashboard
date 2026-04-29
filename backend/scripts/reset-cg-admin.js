require('dotenv').config();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function resetAdmins() {
  const cgModel = await User.getTenantModel('cg');

  // Ensure cgadmin exists with correct password and role
  const cgHash = await bcrypt.hash('CgAdmin@2026!', 10);
  await cgModel.updateOne(
    { name: 'cgadmin' },
    { $set: { name: 'cgadmin', email: 'cgadmin@system.local', password: cgHash, role: 'super_admin', company: 'cg' } },
    { upsert: true }
  );

  // Ensure Nan exists with correct password in CG
  const nanHash = await bcrypt.hash('123456', 10);
  await cgModel.updateOne(
    { name: 'Nan' },
    { $set: { name: 'Nan', email: 'nan@system.local', password: nanHash, role: 'super_admin', company: 'cg' } },
    { upsert: true }
  );

  const users = await cgModel.find({}, 'name role email').lean();
  console.log(JSON.stringify({ tenant: 'cg', users }, null, 2));
}

resetAdmins().catch((err) => { console.error(err); process.exit(1); });
