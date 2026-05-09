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
    
    console.log('=== ALL JOSHUA-RELATED ACCOUNTS ===\n');
    
    // Find all accounts with joshua in name
    const accounts = await db.collection('chartofaccounts').find({ 
      accountName: /joshua/i 
    }).toArray();
    
    console.log(`Found ${accounts.length} accounts:\n`);
    accounts.forEach(acc => {
      console.log(`${acc.accountCode} - ${acc.accountName}`);
      console.log(`  ID: ${acc._id}`);
      console.log(`  Type: ${acc.accountType}`);
      console.log(`  Active: ${acc.isActive}`);
      console.log();
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (conn) await conn.close();
  }
}

find();
