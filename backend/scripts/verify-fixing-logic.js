require('dotenv').config();
const mongoose = require('mongoose');

async function verifyFixingLogic() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/sh-erp';
    await mongoose.connect(mongoUri);
    
    // Register schemas
    require('./models/ChartOfAccount');
    const Transaction = require('./models/Transaction');
    const Ledger = require('./models/Ledger');
    const StockMovement = require('./models/StockMovement');
    
    console.log('\n=== Verify Fixed/Unfixed Transaction Logic ===\n');
    
    // Get all posted sales
    const sales = await Transaction.find({
      type: 'sale',
      status: 'posted'
    }).sort({ createdAt: -1 }).lean();
    
    console.log(`Total Posted Sales: ${sales.length}\n`);
    
    for (const sale of sales) {
      const voucherNo = sale.voucherMeta?.vocNo || sale._id;
      const fixingType = sale.voucherMeta?.fixingType || sale.metalFixStatus || 'NOT SET';
      
      console.log('??????????????????????????????????????????');
      console.log(`Voucher: ${voucherNo}`);
      console.log(`Amount: $${sale.amount}`);
      console.log(`Fixing Type: ${fixingType}`);
      console.log(`Debit Account: ${sale.debitAccountId}`);
      console.log(`Credit Account: ${sale.creditAccountId}`);
      
      // Check ledger entries
      const ledgerEntries = await Ledger.find({
        referenceId: sale._id,
        referenceType: 'sale',
        isDeleted: { $ne: true }
      }).populate('debitAccountId', 'accountCode accountName').populate('creditAccountId', 'accountCode accountName').lean();
      
      console.log(`\nLedger Entries: ${ledgerEntries.length}`);
      if (ledgerEntries.length > 0) {
        ledgerEntries.forEach(le => {
          const dr = le.debitAccountId;
          const cr = le.creditAccountId;
          console.log(`  ? Dr ${dr?.accountCode} (${dr?.accountName}) = $${le.amount}`);
          console.log(`    Cr ${cr?.accountCode} (${cr?.accountName})`);
        });
      }
      
      // Check stock movements
      const stockMovements = await StockMovement.find({
        reason: { $regex: String(voucherNo), $options: 'i' }
      }).lean();
      
      console.log(`\nStock Movements: ${stockMovements.length}`);
      if (stockMovements.length > 0) {
        stockMovements.forEach(sm => {
          const changeLabel = sm.change > 0 ? '+' : '';
          console.log(`  ? ${sm.itemName}: ${sm.quantityBefore} ? ${sm.quantityAfter} (${changeLabel}${sm.change} units)`);
        });
      }
      
      // Verify logic
      const isUnfixed = ['unfixed', 'non-fixing', 'nonfixing', 'non_fixing'].includes(String(fixingType).toLowerCase());
      
      console.log(`\nExpected for ${isUnfixed ? 'UNFIXED' : 'FIXED'}:`);
      if (isUnfixed) {
        console.log('  � Stock Movements: YES (should have entries)');
        console.log('  � Ledger Entries: NO (should be 0)');
        const isCorrect = ledgerEntries.length === 0 && stockMovements.length > 0;
        console.log(`  ${isCorrect ? '? CORRECT' : '? INCORRECT'}`);
      } else {
        console.log('  � Stock Movements: NO (should be 0)');
        console.log('  � Ledger Entries: YES (should have entries)');
        const isCorrect = ledgerEntries.length > 0 && stockMovements.length === 0;
        console.log(`  ${isCorrect ? '? CORRECT' : '? INCORRECT'}`);
      }
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

verifyFixingLogic();
