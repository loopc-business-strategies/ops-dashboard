require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean));

async function list() {
  let conn;
  try {
    const uri = process.env.MONGO_URI_CG;
    conn = await mongoose.createConnection(uri).asPromise();
    const db = conn.getClient().db();
    
    // Get AP account
    const ap = await db.collection('chartofaccounts').findOne({ accountCode: '2000' });
    
    if (!ap) {
      console.log('AP account 2000 not found!');
      return;
    }
    
    console.log('=== ACCOUNTS PAYABLE (2000) CHILDREN ===\n');
    console.log(`Parent ID: ${ap._id}\n`);
    
    // Get all children
    const children = await db.collection('chartofaccounts').find({
      parentAccountId: ap._id
    }).sort({ accountCode: 1 }).toArray();
    
    console.log(`Found ${children.length} children:\n`);
    children.forEach(child => {
      console.log(`${child.accountCode} - ${child.accountName}`);
    });

    // Also search for any account with "joshua" anywhere
    console.log('\n\n=== ALL JOSHUA ACCOUNTS ===\n');
    const joshua = await db.collection('chartofaccounts').find({
      accountName: /joshua/i
    }).toArray();
    
    console.log(`Found ${joshua.length}`);
    joshua.forEach(j => console.log(j.accountName));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (conn) await conn.close();
  }
}

list();
