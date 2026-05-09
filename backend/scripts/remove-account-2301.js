require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean));

const TENANT_ID = 'cg';

async function removeAccount2301() {
  let conn;
  try {
    // Connect to MongoDB
    const uri = process.env.MONGO_URI_CG || process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) throw new Error('Missing MONGO_URI_CG (or fallback URI)');

    conn = await mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    }).asPromise();

    console.log('✓ Connected to MongoDB');

    const db = conn.getClient().db();

    // Find account 2301 (including soft-deleted)
    const account = await db.collection('chartofaccounts').findOne({ 
      tenantId: TENANT_ID, 
      code: '2301'
    });

    if (!account) {
      console.log('❌ Account 2301 not found in CG tenant (not even soft-deleted)');
      return;
    }

    const isDeleted = account.deleted === true;
    const status = isDeleted ? '(soft-deleted)' : '(active)';
    
    console.log('✓ Found account:');
    console.log('  Code:', account.code);
    console.log('  Name:', account.name);
    console.log('  Status:', status);
    console.log('  ID:', account._id);

    // Check for references
    const linkedCustomers = await db.collection('customers').countDocuments({
      tenantId: TENANT_ID,
      ledgerAccountId: account._id,
      deleted: { $ne: true }
    });

    const linkedVendors = await db.collection('vendors').countDocuments({
      tenantId: TENANT_ID,
      ledgerAccountId: account._id,
      deleted: { $ne: true }
    });

    const linkedLedgerEntries = await db.collection('ledgers').countDocuments({
      tenantId: TENANT_ID,
      accountId: account._id,
      deleted: { $ne: true }
    });

    const linkedTransactions = await db.collection('transactions').countDocuments({
      tenantId: TENANT_ID,
      'lineItems.accountId': account._id,
      deleted: { $ne: true }
    });

    console.log('\nReferences check:');
    console.log('  Linked customers:', linkedCustomers);
    console.log('  Linked vendors:', linkedVendors);
    console.log('  Ledger entries:', linkedLedgerEntries);
    console.log('  Transactions:', linkedTransactions);

    if (linkedCustomers > 0 || linkedVendors > 0 || linkedLedgerEntries > 0 || linkedTransactions > 0) {
      console.log('\n⚠️  WARNING: Account has active references. Cannot delete.');
      return;
    }

    // Hard-delete the account
    const result = await db.collection('chartofaccounts').deleteOne({ _id: account._id });
    
    if (result.deletedCount === 1) {
      console.log('\n✅ Account 2301 hard-deleted successfully');
      
      // Verify deletion
      const verification = await db.collection('chartofaccounts').findOne({
        tenantId: TENANT_ID,
        code: '2301',
        deleted: { $ne: true }
      });
      
      if (!verification) {
        console.log('✓ Verification: Account 2301 no longer exists in CG');
      }
    } else {
      console.log('\n❌ Failed to delete account 2301');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

removeAccount2301();
