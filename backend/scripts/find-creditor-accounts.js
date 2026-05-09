require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean));

async function find() {
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
    
    console.log('=== ALL CREDITOR ACCOUNTS STARTING WITH 2 ===\n');
    
    const accounts = await db.collection('chartofaccounts').find({ 
      accountCode: /^2/,
      accountName: /Creditor/i
    }).sort({ accountCode: 1 }).toArray();
    
    console.log(`Found ${accounts.length} creditor accounts:\n`);
    accounts.forEach(acc => {
      console.log(`${acc.accountCode} - ${acc.accountName}`);
    });
    
    // Also check by pattern 238 or 230-231
    console.log('\n\n=== CHECKING SPECIFIC CODE RANGES ===\n');
    
    const byRange = await db.collection('chartofaccounts').find({
      $or: [
        { accountCode: /^238/ },
        { accountCode: /^230/ },
        { accountCode: /^231/ }
      ]
    }).sort({ accountCode: 1 }).toArray();
    
    console.log(`Found ${byRange.length} accounts in ranges 238*/230*/231*:\n`);
    byRange.forEach(acc => {
      console.log(`${acc.accountCode} - ${acc.accountName}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (conn) await conn.close();
  }
}

find();
