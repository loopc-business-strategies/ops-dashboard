require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean));

const TENANT_ID = 'cg';

async function findOrphanLedgers() {
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
    
    // Check the ledger accounts referenced by joshua
    console.log('=== Checking joshua references ===\n');
    
    const joshCustomer = await db.collection('customers').findOne({ name: 'joshua' });
    const joshVendor = await db.collection('vendors').findOne({ name: 'joshua' });
    
    if (joshCustomer) {
      console.log('Joshua Customer ledgerAccountId:', joshCustomer.ledgerAccountId);
      const ledger = await db.collection('chartofaccounts').findOne({ _id: joshCustomer.ledgerAccountId });
      console.log('Ledger exists?:', ledger ? 'YES' : 'NO');
      if (ledger) {
        console.log('Ledger details:', ledger.code, ledger.name);
      }
    }
    
    if (joshVendor) {
      console.log('\nJoshua Vendor ledgerAccountId:', joshVendor.ledgerAccountId);
      const ledger = await db.collection('chartofaccounts').findOne({ _id: joshVendor.ledgerAccountId });
      console.log('Ledger exists?:', ledger ? 'YES' : 'NO');
      if (ledger) {
        console.log('Ledger details:', ledger.code, ledger.name);
      }
    }

    // Find all customers/vendors with dead ledger account references
    console.log('\n\n=== Checking all customers/vendors for dead references ===\n');
    
    const customers = await db.collection('customers').find({}).toArray();
    const vendors = await db.collection('vendors').find({}).toArray();
    
    let deadCustomers = 0, deadVendors = 0;
    
    for (const cust of customers) {
      if (cust.ledgerAccountId) {
        const ledger = await db.collection('chartofaccounts').findOne({ _id: cust.ledgerAccountId });
        if (!ledger) {
          deadCustomers++;
          console.log(`DEAD CUSTOMER: ${cust.name} -> ${cust.ledgerAccountId}`);
        }
      }
    }
    
    for (const vend of vendors) {
      if (vend.ledgerAccountId) {
        const ledger = await db.collection('chartofaccounts').findOne({ _id: vend.ledgerAccountId });
        if (!ledger) {
          deadVendors++;
          console.log(`DEAD VENDOR: ${vend.name} -> ${vend.ledgerAccountId}`);
        }
      }
    }
    
    console.log(`\nTotal customers with dead references: ${deadCustomers}`);
    console.log(`Total vendors with dead references: ${deadVendors}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

findOrphanLedgers();
