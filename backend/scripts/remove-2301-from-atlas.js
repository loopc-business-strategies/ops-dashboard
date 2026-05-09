require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean));

async function remove() {
  let conn;
  try {
    // Use the CORRECT MongoDB Atlas URI from .env
    const uri = process.env.MONGO_URI_CG;
    console.log('Connecting to Atlas CG database...');
    console.log('URI prefix:', uri.substring(0, 50) + '...');
    
    if (!uri) throw new Error('MONGO_URI_CG not set');

    conn = await mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    }).asPromise();

    const db = conn.getClient().db();
    
    console.log('\n✓ Connected to MongoDB Atlas CG\n');

    // Search for accounts with joshua
    console.log('=== SEARCHING FOR JOSHUA ACCOUNTS ===\n');
    
    const accounts = await db.collection('chartofaccounts').find({
      $or: [
        { accountName: /joshua/i },
        { accountCode: '2301' }
      ]
    }).toArray();
    
    console.log(`Found ${accounts.length} accounts:\n`);
    accounts.forEach(acc => {
      console.log(`${acc.accountCode} - ${acc.accountName}`);
      console.log(`  ID: ${acc._id}`);
    });

    // Delete all found accounts
    if (accounts.length > 0) {
      console.log('\n=== DELETING ===\n');
      
      for (const acc of accounts) {
        const result = await db.collection('chartofaccounts').deleteOne({ _id: acc._id });
        console.log(`✅ Deleted ${acc.accountCode}: ${result.deletedCount} record`);
      }
    }

    // Verify
    console.log('\n=== VERIFICATION ===\n');
    const remaining = await db.collection('chartofaccounts').countDocuments({
      $or: [
        { accountName: /joshua/i },
        { accountCode: '2301' }
      ]
    });
    
    console.log(`Joshua accounts remaining: ${remaining}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (conn) await conn.close();
  }
}

remove();
