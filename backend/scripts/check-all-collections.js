require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean));

const TENANT_ID = 'cg';

async function checkAllCollections() {
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
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('All collections in database:');
    collections.forEach(col => console.log(`  - ${col.name}`));

    console.log('\n=== Searching for account 2301 ===\n');

    // Search for 2301 in all collections
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments({ code: '2301' });
      if (count > 0) {
        console.log(`Found in ${col.name}: ${count} documents`);
        const docs = await db.collection(col.name).find({ code: '2301' }).toArray();
        docs.forEach(doc => {
          console.log(JSON.stringify(doc, null, 2));
        });
      }
    }

    // Also search for "joshua" in all collections
    console.log('\n=== Searching for "joshua" ===\n');
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments({ $or: [{ name: /joshua/i }, { code: /joshua/i }] });
      if (count > 0) {
        console.log(`Found in ${col.name}: ${count} documents`);
        const docs = await db.collection(col.name).find({ $or: [{ name: /joshua/i }, { code: /joshua/i }] }).toArray();
        docs.forEach(doc => {
          console.log(JSON.stringify(doc, null, 2));
        });
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

checkAllCollections();
