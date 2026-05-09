require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean));

async function verify() {
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
    
    // Search for 2301
    const account2301 = await db.collection('chartofaccounts').findOne({ accountCode: '2301' });
    
    // Search for joshua vendor
    const joshVendor = await db.collection('vendors').findOne({ name: 'joshua' });
    
    // Get all vendors
    const allVendors = await db.collection('vendors').find({}).toArray();
    
    console.log('=== FINAL VERIFICATION ===\n');
    console.log('Account 2301 exists:', account2301 ? '❌ YES' : '✅ NO');
    console.log('Joshua vendor exists:', joshVendor ? '❌ YES' : '✅ NO');
    console.log('\nAll vendors in CG database:');
    
    if (allVendors.length === 0) {
      console.log('  (no vendors)');
    } else {
      allVendors.forEach(v => {
        console.log(`  - ${v.name} (${v.vendorCode})`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (conn) await conn.close();
  }
}

verify();
