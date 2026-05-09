require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean));

async function check() {
  let conn;
  try {
    const uri = process.env.MONGO_URI_CG || process.env.MONGODB_URI || process.env.MONGO_URI;
    conn = await mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    }).asPromise();

    const db = conn.getClient().db();
    
    // Get all accounts under Accounts Payable (2000) and its children
    const apAccount = await db.collection('chartofaccounts').findOne({ 
      accountCode: '2000'
    });
    
    console.log('=== ACCOUNTS PAYABLE HIERARCHY ===\n');
    
    if (apAccount) {
      console.log('Parent: 2000 -', apAccount.accountName);
      console.log('ID:', apAccount._id);
      
      // Find all children
      const children = await db.collection('chartofaccounts').find({
        parentAccountId: apAccount._id
      }).sort({ accountCode: 1 }).toArray();
      
      console.log(`\nChildren (${children.length}):`);
      children.forEach(child => {
        console.log(`  ${child.accountCode} - ${child.accountName} (isActive: ${child.isActive})`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (conn) await conn.close();
  }
}

check();
