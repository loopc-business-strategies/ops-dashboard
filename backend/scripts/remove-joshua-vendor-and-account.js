require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean));

async function removeJoshuaVendorAndAccount() {
  let conn;
  try {
    const uri = process.env.MONGO_URI_CG;
    if (!uri) throw new Error('Missing MONGO_URI_CG');

    conn = await mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    }).asPromise();

    const db = conn.getClient().db();
    
    console.log('✓ Connected to MongoDB\n');

    // 1. Find and delete account 2301 (joshua Creditor)
    console.log('=== Removing Account 2301 (joshua Creditor) ===\n');
    
    const account2301 = await db.collection('chartofaccounts').findOne({ 
      accountCode: '2301' 
    });
    
    if (account2301) {
      console.log('Found account 2301:');
      console.log('  Name:', account2301.accountName);
      console.log('  Code:', account2301.accountCode);
      console.log('  ID:', account2301._id);
      
      const delResult = await db.collection('chartofaccounts').deleteOne({ _id: account2301._id });
      console.log(`\n✅ Deleted: ${delResult.deletedCount} account record`);
    } else {
      console.log('❌ Account 2301 not found');
    }

    // 2. Find and delete joshua vendor
    console.log('\n=== Removing Joshua Vendor ===\n');
    
    const joshVendor = await db.collection('vendors').findOne({ name: 'joshua' });
    
    if (joshVendor) {
      console.log('Found joshua vendor:');
      console.log('  Name:', joshVendor.name);
      console.log('  Code:', joshVendor.vendorCode);
      console.log('  ID:', joshVendor._id);
      
      const delResult = await db.collection('vendors').deleteOne({ _id: joshVendor._id });
      console.log(`\n✅ Deleted: ${delResult.deletedCount} vendor record`);
    } else {
      console.log('❌ Joshua vendor not found');
    }

    // 3. Verify deletion
    console.log('\n=== Verification ===\n');
    
    const verifyAccount = await db.collection('chartofaccounts').findOne({ accountCode: '2301' });
    const verifyVendor = await db.collection('vendors').findOne({ name: 'joshua' });
    
    console.log('Account 2301 exists?', verifyAccount ? '❌ YES' : '✅ NO');
    console.log('Joshua vendor exists?', verifyVendor ? '❌ YES' : '✅ NO');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

removeJoshuaVendorAndAccount();
