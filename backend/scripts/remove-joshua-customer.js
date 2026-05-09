require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean));

async function remove() {
  let conn;
  try {
    const uri = process.env.MONGO_URI_CG || process.env.MONGODB_URI || process.env.MONGO_URI;
    conn = await mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    }).asPromise();

    const db = conn.getClient().db();
    
    console.log('=== REMOVING JOSHUA CUSTOMER ===\n');
    
    // Find and delete joshua customer
    const joshCustomer = await db.collection('customers').findOne({ name: 'joshua' });
    
    if (joshCustomer) {
      console.log('Found joshua customer:');
      console.log('  Name:', joshCustomer.name);
      console.log('  Ledger:', joshCustomer.ledgerAccountId);
      console.log('  ID:', joshCustomer._id);
      
      // Delete customer
      const delCust = await db.collection('customers').deleteOne({ _id: joshCustomer._id });
      console.log(`\n✅ Deleted customer: ${delCust.deletedCount}`);
      
      // Delete linked account
      const delAcc = await db.collection('chartofaccounts').deleteOne({ _id: joshCustomer.ledgerAccountId });
      console.log(`✅ Deleted linked account (1300): ${delAcc.deletedCount}`);
    } else {
      console.log('❌ joshua customer not found');
    }

    // Verify
    console.log('\n=== VERIFICATION ===\n');
    const verifyCustomer = await db.collection('customers').countDocuments({ name: 'joshua' });
    const verifyAccount = await db.collection('chartofaccounts').countDocuments({ accountName: /joshua/i });
    console.log('joshua customer exists:', verifyCustomer > 0 ? '❌ YES' : '✅ NO');
    console.log('joshua accounts exist:', verifyAccount > 0 ? '❌ YES' : '✅ NO');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (conn) await conn.close();
  }
}

remove();
