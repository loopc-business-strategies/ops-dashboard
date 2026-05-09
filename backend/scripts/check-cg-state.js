require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean));

const TENANT_ID = 'cg';

async function checkCGState() {
  let conn;
  try {
    const uri = process.env.MONGO_URI_CG;
    if (!uri) throw new Error('Missing MONGO_URI_CG');

    conn = await mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    }).asPromise();

    console.log('✓ Connected to MongoDB\n');
    const db = conn.getClient().db();

    // Get all collections in CG
    const coaCount = await db.collection('chartofaccounts').countDocuments({ tenantId: TENANT_ID });
    const custCount = await db.collection('customers').countDocuments({ tenantId: TENANT_ID });
    const vendCount = await db.collection('vendors').countDocuments({ tenantId: TENANT_ID });
    const txCount = await db.collection('transactions').countDocuments({ tenantId: TENANT_ID });
    const ledCount = await db.collection('ledgers').countDocuments({ tenantId: TENANT_ID });

    console.log('=== CG DATABASE STATE ===\n');
    console.log(`Chart of Accounts (all, including deleted): ${coaCount}`);
    console.log(`Customers (all, including deleted): ${custCount}`);
    console.log(`Vendors (all, including deleted): ${vendCount}`);
    console.log(`Transactions (all, including deleted): ${txCount}`);
    console.log(`Ledger Entries (all, including deleted): ${ledCount}`);

    // Get active accounts
    const activeAccounts = await db.collection('chartofaccounts').find({
      tenantId: TENANT_ID,
      deleted: { $ne: true }
    }).toArray();

    console.log(`\nActive (not deleted) Accounts: ${activeAccounts.length}`);
    
    if (activeAccounts.length > 0) {
      console.log('\nActive Accounts List:');
      activeAccounts.slice(0, 20).forEach(acc => {
        console.log(`  ${acc.code} - ${acc.name}`);
      });
      if (activeAccounts.length > 20) {
        console.log(`  ... and ${activeAccounts.length - 20} more`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

checkCGState();
