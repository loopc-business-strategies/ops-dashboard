require('./destructive/_destructive-guard')({ scriptName: __filename })
// repair-inventory-accounts.js
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  if (!process.env.MONGO_URI_CG) throw new Error('Missing MONGO_URI_CG');
  await mongoose.connect(process.env.MONGO_URI_CG);
  const ChartOfAccount = require('./models/ChartOfAccount');
  const InventoryItem = require('./models/InventoryItem');
  const Ledger = require('./models/Ledger');
  const User = require('./models/User');
  const StockMovement = require('./models/StockMovement');

  // Get admin user for createdBy
  const admin = await User.findOne({ role: 'superadmin' }).lean() || await User.findOne({}).lean();
  if (!admin) { console.log('No user found'); process.exit(1); }
  console.log('Using user:', admin.name, admin._id);

  // Ensure Metal Inventory account (1210) exists
  let inv1210 = await ChartOfAccount.findOne({ accountCode: '1210' });
  if (inv1210) {
    console.log('Account 1210:', inv1210.accountName, '- already exists');
    // Rename to Metal Inventory if it's "Inventory - Finished Goods"
    if (inv1210.accountName !== 'Metal Inventory') {
      inv1210.accountName = 'Metal Inventory';
      await inv1210.save();
      console.log('  Renamed to Metal Inventory');
    }
  } else {
    inv1210 = await ChartOfAccount.create({
      accountCode: '1210',
      accountName: 'Metal Inventory',
      accountType: 'Asset',
      description: 'Metal inventory asset account',
      isActive: true,
      createdBy: admin._id
    });
    console.log('Created Metal Inventory account 1210');
  }

  // Ensure AP account (2000) is correct
  const ap2000 = await ChartOfAccount.findOne({ accountCode: '2000' });
  if (ap2000) console.log('Account 2000:', ap2000.accountName, '- OK');

  // Link ALL gold/metal inventory items to account 1210
  const items = await InventoryItem.find({ isDeleted: false });
  for (const item of items) {
    if (!item.ledgerAccountId) {
      item.ledgerAccountId = inv1210._id;
      item.updatedBy = admin._id;
      await item.save();
      console.log('Linked', item.name, 'to Metal Inventory (1210)');
    } else {
      console.log(item.name, 'already has ledger account:', item.ledgerAccountId);
    }
  }

  // Now create the missing purchase accounting entry for "Voucher purchase #3" 
  // kilo bar 995, +1000 units, but unit cost was 0, so amount = 0
  // Instead, let's check if any purchase ledger entries are missing
  console.log('\nChecking for missing purchase accounting...');
  const purchaseMovements = await StockMovement.find({ reason: /Voucher purchase/i }).lean();
  console.log('Purchase stock movements:', purchaseMovements.length);
  purchaseMovements.forEach(m => console.log(' ', m.reason, m.itemName, 'change:', m.change));
  
  // Check existing purchase ledger entries
  const purchaseLedgers = await Ledger.find({ referenceType: 'purchase', isDeleted: { $ne: true } }).lean();
  console.log('Purchase ledger entries:', purchaseLedgers.length);

  console.log('\nDone!');
  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
require('./destructive/_destructive-guard')({ scriptName: __filename })
