require('./destructive/_destructive-guard')({ scriptName: __filename })
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const ChartOfAccount = require('./models/ChartOfAccount');
  const InventoryItem = require('./models/InventoryItem');
  const User = require('./models/User');

  const admin = await User.findOne({ role: 'superadmin' }).lean() || await User.findOne({}).lean();

  // Get Metal Inventory account 1210
  const metalInv = await ChartOfAccount.findOne({ accountCode: '1210' });
  if (!metalInv) {
    console.log('ERROR: Metal Inventory account 1210 not found!');
    process.exit(1);
  }
  console.log('Metal Inventory account:', metalInv._id, metalInv.accountName);

  // Check each item's ledger account - if it doesn't exist, point to 1210
  const items = await InventoryItem.find({ isDeleted: false });
  for (const item of items) {
    if (!item.ledgerAccountId) {
      item.ledgerAccountId = metalInv._id;
      item.updatedBy = admin._id;
      await item.save();
      console.log('Fixed', item.name, '-> set to 1210 Metal Inventory');
      continue;
    }
    // Check if the account exists
    const acc = await ChartOfAccount.findById(item.ledgerAccountId).lean();
    if (!acc) {
      console.log(item.name, 'ledgerAccountId', item.ledgerAccountId, 'DOES NOT EXIST -> reassigning to 1210');
      item.ledgerAccountId = metalInv._id;
      item.updatedBy = admin._id;
      await item.save();
    } else {
      console.log(item.name, 'ledger account OK:', acc.accountCode, acc.accountName);
    }
  }

  // Verify
  const fixedItems = await InventoryItem.find({ isDeleted: false }).populate('ledgerAccountId', 'accountCode accountName').lean();
  console.log('\nFinal inventory ledger links:');
  fixedItems.forEach(i => console.log(' ', i.name, '->', i.ledgerAccountId ? i.ledgerAccountId.accountCode + ' ' + i.ledgerAccountId.accountName : 'NONE'));
  
  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
require('./destructive/_destructive-guard')({ scriptName: __filename })
