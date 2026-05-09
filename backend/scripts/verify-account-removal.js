require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean));

const TENANT_ID = 'cg';

async function verifyAccountRemoval() {
  let conn;
  try {
    const uri = process.env.MONGO_URI_CG;
    if (!uri) throw new Error('Missing MONGO_URI_CG');
    if (!uri) throw new Error('Missing MONGO_URI_CG (or fallback URI)');

    conn = await mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    }).asPromise();

    console.log('✓ Connected to MongoDB\n');
    const db = conn.getClient().db();

    // Check current state
    console.log('=== VERIFICATION SUMMARY ===\n');

    // 1. Account 2301 - joshua
    const account2301 = await db.collection('chartofaccounts').findOne({ 
      tenantId: TENANT_ID, 
      code: '2301'
    });
    console.log('1️⃣  Account 2301 (joshua Creditor):');
    console.log(`   Status: ${account2301 ? '❌ STILL EXISTS' : '✅ REMOVED'}`);
    
    // 2. hepi account
    const hepiAccount = await db.collection('chartofaccounts').findOne({ 
      tenantId: TENANT_ID, 
      name: /hepi/i,
      deleted: { $ne: true }
    });
    console.log('\n2️⃣  hepi account (Debtor):');
    console.log(`   Status: ${hepiAccount ? '❌ STILL EXISTS' : '✅ REMOVED'}`);

    // 3. josh customer
    const joshCustomer = await db.collection('customers').findOne({ 
      tenantId: TENANT_ID, 
      name: /josh/i,
      deleted: { $ne: true }
    });
    console.log('\n3️⃣  josh customer (under AR):');
    if (joshCustomer) {
      const ledger = await db.collection('chartofaccounts').findOne({ 
        tenantId: TENANT_ID, 
        _id: joshCustomer.ledgerAccountId 
      });
      console.log(`   Status: ✅ EXISTS`);
      console.log(`   Ledger Code: ${ledger?.code || 'N/A'}`);
      console.log(`   Ledger Name: ${ledger?.name || 'N/A'}`);
    } else {
      console.log('   Status: ❌ NOT FOUND');
    }

    // 4. mark supplier
    const markSupplier = await db.collection('vendors').findOne({ 
      tenantId: TENANT_ID, 
      name: /mark/i,
      deleted: { $ne: true }
    });
    console.log('\n4️⃣  mark supplier (under AP):');
    if (markSupplier) {
      const ledger = await db.collection('chartofaccounts').findOne({ 
        tenantId: TENANT_ID, 
        _id: markSupplier.ledgerAccountId 
      });
      console.log(`   Status: ✅ EXISTS`);
      console.log(`   Ledger Code: ${ledger?.code || 'N/A'}`);
      console.log(`   Ledger Name: ${ledger?.name || 'N/A'}`);
    } else {
      console.log('   Status: ❌ NOT FOUND');
    }

    // 5. All bank accounts
    const bankAccounts = await db.collection('chartofaccounts').find({ 
      tenantId: TENANT_ID, 
      code: { $in: ['101001', '101002', '101003', '1010'] },
      deleted: { $ne: true }
    }).toArray();
    
    console.log('\n5️⃣  Bank accounts:');
    if (bankAccounts.length === 0) {
      console.log('   ❌ NO BANK ACCOUNTS FOUND');
    } else {
      bankAccounts.forEach(acc => {
        console.log(`   ✅ ${acc.code} - ${acc.name}`);
      });
    }

    // 6. Active transactions
    const txCount = await db.collection('transactions').countDocuments({ 
      tenantId: TENANT_ID, 
      deleted: { $ne: true }
    });
    console.log('\n6️⃣  Active transactions in CG:');
    console.log(`   Count: ${txCount}`);

    console.log('\n✅ Verification complete');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

verifyAccountRemoval();
