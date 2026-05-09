require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean));

async function search() {
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
    
    console.log('=== DEEP SEARCH FOR JOSHUA ===\n');
    
    const collections = await db.listCollections().toArray();
    
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments({
        $or: [
          { accountName: /joshua/i },
          { name: /joshua/i },
          { accountCode: /joshua/i },
          { code: /joshua/i }
        ]
      });
      
      if (count > 0) {
        console.log(`\n${col.name}: ${count} records`);
        const docs = await db.collection(col.name).find({
          $or: [
            { accountName: /joshua/i },
            { name: /joshua/i },
            { accountCode: /joshua/i },
            { code: /joshua/i }
          ]
        }).toArray();
        
        docs.forEach(doc => {
          console.log(JSON.stringify(doc, null, 2));
        });
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (conn) await conn.close();
  }
}

search();
