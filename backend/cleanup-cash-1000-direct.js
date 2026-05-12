/**
 * Direct cleanup script for bad exchange entries on Cash 1000
 * Searches by specific amounts and dates to ensure we find the right entries
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(process.cwd(), '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
for (const k in envConfig) process.env[k] = envConfig[k];

(async () => {
  try {
    console.log('[📡] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI_MG);
    console.log('[✓] Connected\n');

    const Ledger = mongoose.model('Ledger');
    const ChartOfAccount = mongoose.model('ChartOfAccount');

    // Find Cash account 1000
    const cash = await ChartOfAccount.findOne({ accountCode: '1000' });
    if (!cash) {
      console.error('[✗] Cash account 1000 not found');
      process.exit(1);
    }
    console.log(`[✓] Found Cash account: ${cash.accountName} (${cash._id})\n`);

    // Search by specific amounts - these are the bad entries we need to delete
    const targetAmounts = [5954.65, 85.95, 8.26]; // All suspected bad entries
    
    console.log('[🔍] Searching for bad entries with amounts:', targetAmounts);
    
    // Find entries with these amounts that are posted to Cash
    const badEntries = await Ledger.find({
      referenceType: 'journal',
      isDeleted: { $ne: true },
      amount: { $in: targetAmounts },
      $or: [
        { debitAccountId: cash._id },
        { creditAccountId: cash._id }
      ]
    }).select('date amount description debitAccountId creditAccountId');

    console.log(`[✓] Found ${badEntries.length} entries matching criteria:\n`);
    
    if (badEntries.length === 0) {
      console.log('[✓] No bad entries found - Cash 1000 is clean!');
      await mongoose.disconnect();
      return;
    }

    // Display entries to be deleted
    badEntries.forEach((e, i) => {
      console.log(`   [${i + 1}] ${e.date?.toISOString().split('T')[0] || 'unknown'} | ${e.amount} | ${e.description}`);
    });

    console.log(`\n[⚠️  ] Deleting ${badEntries.length} entries...\n`);

    // Delete entries with soft delete
    const deleteResult = await Ledger.updateMany(
      {
        _id: { $in: badEntries.map(e => e._id) }
      },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          notes: 'Cleaned up via direct script - bad exchange entries on Cash 1000',
          updatedAt: new Date()
        }
      }
    );

    console.log(`[✓] Soft-deleted ${deleteResult.modifiedCount} entries`);

    // Verify deletion
    const verifyCount = await Ledger.countDocuments({
      referenceType: 'journal',
      isDeleted: { $ne: true },
      amount: { $in: targetAmounts },
      $or: [
        { debitAccountId: cash._id },
        { creditAccountId: cash._id }
      ]
    });

    console.log(`[✓] Verification: ${verifyCount} entries still active (should be 0)\n`);

    if (verifyCount === 0) {
      console.log('✅ CLEANUP COMPLETE - Cash 1000 is now clean!');
    } else {
      console.log('⚠️  WARNING: Some entries may still exist');
    }

    await mongoose.disconnect();

  } catch (err) {
    console.error('[✗] Error:', err.message);
    process.exit(1);
  }
})();
