require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean));

async function findAndRemove() {
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
    
    console.log('=== SEARCHING FOR ACCOUNT 2301 ===\n');
    
    // Search by accountCode
    const byCode = await db.collection('chartofaccounts').find({ accountCode: '2301' }).toArray();
    console.log(`Found by accountCode "2301": ${byCode.length} records`);
    byCode.forEach(acc => {
      console.log(JSON.stringify(acc, null, 2));
    });
    
    // Search by code field
    const byCodeField = await db.collection('chartofaccounts').find({ code: '2301' }).toArray();
    console.log(`\nFound by code "2301": ${byCodeField.length} records`);
    byCodeField.forEach(acc => {
      console.log(JSON.stringify(acc, null, 2));
    });

    // Search by name containing joshua and creditor
    const byName = await db.collection('chartofaccounts').find({ accountName: /joshua.*Creditor/i }).toArray();
    console.log(`\nFound by name "joshua (Creditor)": ${byName.length} records`);
    byName.forEach(acc => {
      console.log(JSON.stringify(acc, null, 2));
    });

    // Remove all found records
    console.log('\n=== REMOVING ALL FOUND RECORDS ===\n');
    
    const allToRemove = [...byCode, ...byCodeField, ...byName];
    const uniqueIds = [...new Set(allToRemove.map(a => a._id.toString()))];
    
    for (const id of uniqueIds) {
      const result = await db.collection('chartofaccounts').deleteOne({ _id: mongoose.Types.ObjectId(id) });
      console.log(`Deleted: ${id} - ${result.deletedCount} records`);
    }

    // Verify
    console.log('\n=== VERIFICATION ===\n');
    const verifyCode = await db.collection('chartofaccounts').countDocuments({ accountCode: '2301' });
    const verifyName = await db.collection('chartofaccounts').countDocuments({ accountName: /joshua.*Creditor/i });
    console.log('Account code 2301 exists:', verifyCode > 0 ? '❌ YES' : '✅ NO');
    console.log('joshua (Creditor) accounts exist:', verifyName > 0 ? '❌ YES' : '✅ NO');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (conn) await conn.close();
  }
}

findAndRemove();
