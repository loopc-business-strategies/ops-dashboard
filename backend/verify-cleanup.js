const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(process.cwd(), '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
for (const k in envConfig) process.env[k] = envConfig[k];

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI_MG);
    console.log('[✓] Connected to MongoDB');

    const Ledger = mongoose.model('Ledger');
    
    // Count active exchange entries
    const activeCount = await Ledger.countDocuments({
      referenceType: 'journal',
      description: /Exchange/i,
      $or: [
        { isDeleted: false },
        { isDeleted: { $exists: false } }
      ]
    });
    
    // Count deleted exchange entries
    const deletedCount = await Ledger.countDocuments({
      referenceType: 'journal',
      description: /Exchange/i,
      isDeleted: true
    });
    
    console.log('\n📊 Exchange Entry Status:');
    console.log('   Active (not deleted):    ', activeCount);
    console.log('   Deleted (soft-deleted):  ', deletedCount);
    console.log('   Total:                   ', activeCount + deletedCount);
    
    // List the deleted ones
    if (deletedCount > 0) {
      console.log('\n✅ Deleted entries:');
      const deleted = await Ledger.find({
        referenceType: 'journal',
        description: /Exchange/i,
        isDeleted: true
      }).select('date amount description');
      deleted.forEach(e => {
        console.log(`   ${e.date?.toISOString().split('T')[0]} | ${e.amount} | ${e.description}`);
      });
    }
    
    // List active ones
    if (activeCount > 0) {
      console.log('\n⚠️  Active (non-deleted) exchange entries:');
      const active = await Ledger.find({
        referenceType: 'journal',
        description: /Exchange/i,
        $or: [
          { isDeleted: false },
          { isDeleted: { $exists: false } }
        ]
      }).select('date amount description');
      active.forEach(e => {
        console.log(`   ${e.date?.toISOString().split('T')[0]} | ${e.amount} | ${e.description}`);
      });
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('[✗] Error:', err.message);
    process.exit(1);
  }
})();
