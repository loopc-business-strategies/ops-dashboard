require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean));

async function search() {
  let conn;
  try {
    const uri = process.env.MONGO_URI_CG || process.env.MONGODB_URI || process.env.MONGO_URI;
    conn = await mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    }).asPromise();

    const db = conn.getClient().db();
    
    console.log('=== SEARCHING ALL JOSHUA REFERENCES ===\n');
    
    // Search in chartofaccounts
    const coaJoshua = await db.collection('chartofaccounts').find({
      $or: [
        { accountName: /joshua/i },
        { accountCode: /joshua/i }
      ]
    }).toArray();
    
    console.log(`ChartOfAccounts with joshua: ${coaJoshua.length}`);
    coaJoshua.forEach(acc => {
      console.log(`  ${acc.accountCode} - ${acc.accountName}`);
    });
    
    // Search in customers
    const custJoshua = await db.collection('customers').find({
      name: /joshua/i
    }).toArray();
    
    console.log(`\nCustomers with joshua: ${custJoshua.length}`);
    custJoshua.forEach(cust => {
      console.log(`  ${cust.name} - ledger: ${cust.ledgerAccountId}`);
    });
    
    // Search in vendors
    const vendJoshua = await db.collection('vendors').find({
      name: /joshua/i
    }).toArray();
    
    console.log(`\nVendors with joshua: ${vendJoshua.length}`);
    vendJoshua.forEach(vend => {
      console.log(`  ${vend.name} - ledger: ${vend.ledgerAccountId}`);
    });

    // Check if there are duplicate or orphaned joshua accounts
    console.log('\n=== ALL JOSHUA ACCOUNTS IN COA ===\n');
    const all = await db.collection('chartofaccounts').find({
      $text: { $search: 'joshua' }
    }).toArray();
    
    if (all.length === 0) {
      // Try regex since text search might not be indexed
      const regex = await db.collection('chartofaccounts').find({
        accountName: { $regex: 'joshua', $options: 'i' }
      }).toArray();
      
      console.log(`Found ${regex.length} by regex:`);
      regex.forEach(acc => {
        console.log(JSON.stringify(acc, null, 2));
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (conn) await conn.close();
  }
}

search();
