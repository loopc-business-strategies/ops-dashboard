require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean));

async function check() {
  let conn;
  try {
    const uri = process.env.MONGO_URI_CG || process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) throw new Error('Missing MONGO_URI_CG (or fallback URI)');

    conn = await mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    }).asPromise();

    const db = conn.getClient().db();
    
    const joshCustomer = await db.collection('customers').findOne({ name: 'joshua' });
    const joshVendor = await db.collection('vendors').findOne({ name: 'joshua' });
    
    if (joshCustomer) {
      console.log('=== Joshua Customer ===');
      console.log('ID:', joshCustomer._id);
      console.log('ledgerAccountId:', joshCustomer.ledgerAccountId);
      
      const account = await db.collection('chartofaccounts').findOne({ _id: joshCustomer.ledgerAccountId });
      console.log('\nLinked Account:');
      console.log(JSON.stringify(account, null, 2));
    }
    
    if (joshVendor) {
      console.log('\n\n=== Joshua Vendor ===');
      console.log('ID:', joshVendor._id);
      console.log('ledgerAccountId:', joshVendor.ledgerAccountId);
      
      const account = await db.collection('chartofaccounts').findOne({ _id: joshVendor.ledgerAccountId });
      console.log('\nLinked Account:');
      console.log(JSON.stringify(account, null, 2));
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

check();
