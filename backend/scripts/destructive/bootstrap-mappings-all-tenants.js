require('./_destructive-guard')({ scriptName: __filename })
/**
 * bootstrap-mappings-all-tenants.js
 *
 * Adds missing account mappings to MG, CG, and LoopC.
 *
 * What it does:
 *  - CG / LoopC: inserts all 22 operational mappings that MG has (skips the 5 FX/VAT already present)
 *  - ALL tenants: inserts direct-type fallback mappings (sale, purchase, receipt, payment, expense, payroll)
 *    that the ERP engine uses when a transaction has no explicit mappingId
 *  - MG: adds the missing `purchase` and `expense` direct-type fallbacks only
 *  - LoopC: removes the leftover `mark` (1300) and `ooo` (1302) debtor accounts
 *
 * Safe to run multiple times — skips any mappingType that already exists.
 */

require('dotenv').config();
const dns = require('dns');
dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map(s => s.trim()).filter(Boolean));
const mongoose = require('mongoose');

// ── Helpers ──────────────────────────────────────────────────────────────────

async function connect(uri) {
  return mongoose.createConnection(uri, { serverSelectionTimeoutMS: 12000 }).asPromise();
}

/** Look up a chart-of-accounts _id by account code. Throws if not found. */
async function coaId(db, code) {
  const doc = await db.collection('chartofaccounts').findOne({ accountCode: String(code) });
  if (!doc) throw new Error(`COA account code ${code} not found`);
  return doc._id;
}

/** Insert a mapping only if mappingType does not already exist. */
async function upsertMapping(db, { mappingType, debitCode, creditCode, department, description }) {
  const exists = await db.collection('accountmappings').findOne({ mappingType });
  if (exists) {
    console.log(`  SKIP  ${mappingType} (already exists)`);
    return false;
  }
  const debitAccountId  = await coaId(db, debitCode);
  const creditAccountId = await coaId(db, creditCode);
  await db.collection('accountmappings').insertOne({
    mappingType,
    debitAccountId,
    creditAccountId,
    department: department || '',
    description: description || '',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log(`  ADD   ${mappingType} → DR ${debitCode} / CR ${creditCode}  [${department || 'all'}]`);
  return true;
}

// ── Mapping definitions ───────────────────────────────────────────────────────

/**
 * Direct-type fallback mappings.
 * The ERP engine calls: AccountMapping.findOne({ mappingType: transactionType })
 * where transactionType is one of: sale, purchase, receipt, payment, expense, payroll
 */
const DIRECT_FALLBACKS = [
  { mappingType: 'sale',     debitCode: '1100', creditCode: '4000', department: 'sales',      description: 'Default mapping for sale transactions' },
  { mappingType: 'purchase', debitCode: '1200', creditCode: '2000', department: 'operations', description: 'Default mapping for purchase transactions' },
  { mappingType: 'receipt',  debitCode: '1010', creditCode: '1100', department: 'sales',      description: 'Default mapping for receipt transactions' },
  { mappingType: 'payment',  debitCode: '2000', creditCode: '1010', department: 'finance',    description: 'Default mapping for payment transactions' },
  { mappingType: 'expense',  debitCode: '6100', creditCode: '1010', department: 'operations', description: 'Default mapping for expense transactions' },
  { mappingType: 'payroll',  debitCode: '6200', creditCode: '2100', department: 'hr',         description: 'Default mapping for payroll transactions' },
];

/**
 * Full operational mapping set (mirrors MG).
 * CG and LoopC need all of these; MG already has them.
 */
const OPERATIONAL_MAPPINGS = [
  { mappingType: 'sales_invoice',       debitCode: '1010', creditCode: '4000', department: 'sales',      description: 'Record customer invoice receipts' },
  { mappingType: 'sales_domestic',      debitCode: '1010', creditCode: '4100', department: 'sales',      description: 'Domestic sales revenue' },
  { mappingType: 'sales_export',        debitCode: '1010', creditCode: '4110', department: 'sales',      description: 'Export sales revenue' },
  { mappingType: 'sales_service',       debitCode: '1010', creditCode: '4200', department: 'sales',      description: 'Service revenue' },
  { mappingType: 'inventory_purchase',  debitCode: '1200', creditCode: '2000', department: 'production', description: 'Inventory raw material purchase' },
  { mappingType: 'raw_material_usage',  debitCode: '5100', creditCode: '1200', department: 'production', description: 'Raw material consumed in production' },
  { mappingType: 'cogs_recognition',    debitCode: '5000', creditCode: '1210', department: 'production', description: 'Cost of goods sold recognition' },
  { mappingType: 'vendor_payment',      debitCode: '2000', creditCode: '1010', department: 'finance',    description: 'Payment to vendor / accounts payable' },
  { mappingType: 'customer_payment',    debitCode: '1010', creditCode: '1100', department: 'sales',      description: 'Receipt from customer / accounts receivable' },
  { mappingType: 'payroll_accrual',     debitCode: '6200', creditCode: '2100', department: 'hr',         description: 'Accrue payroll expense' },
  { mappingType: 'payroll_payment',     debitCode: '2100', creditCode: '1010', department: 'hr',         description: 'Pay out accrued payroll' },
  { mappingType: 'payroll_tax',         debitCode: '6210', creditCode: '2120', department: 'hr',         description: 'Payroll tax accrual' },
  { mappingType: 'operations_expense',  debitCode: '6100', creditCode: '1010', department: 'operations', description: 'General operations expense' },
  { mappingType: 'rent_expense',        debitCode: '6000', creditCode: '1010', department: 'operations', description: 'Monthly rent payment' },
  { mappingType: 'utilities_expense',   debitCode: '6110', creditCode: '1010', department: 'operations', description: 'Utilities payment' },
  { mappingType: 'office_supplies',     debitCode: '6130', creditCode: '1010', department: 'operations', description: 'Office supplies purchase' },
  { mappingType: 'marketing_campaign',  debitCode: '6300', creditCode: '1010', department: 'sales',      description: 'Marketing and advertising expense' },
  { mappingType: 'sales_commission',    debitCode: '6310', creditCode: '2100', department: 'sales',      description: 'Sales commission payable' },
  { mappingType: 'depreciation',        debitCode: '6140', creditCode: '1600', department: 'finance',    description: 'Asset depreciation journal' },
  { mappingType: 'bank_interest',       debitCode: '1010', creditCode: '4300', department: 'finance',    description: 'Interest income from bank' },
  { mappingType: 'interest_expense',    debitCode: '6700', creditCode: '1010', department: 'finance',    description: 'Interest expense payment' },
  { mappingType: 'tax_payment',         debitCode: '2120', creditCode: '1010', department: 'finance',    description: 'Income tax payment' },
];

// ── Per-tenant processing ─────────────────────────────────────────────────────

async function processTenant(name, uri, opts = {}) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Tenant: ${name}`);
  console.log('='.repeat(60));

  let conn;
  try {
    conn = await connect(uri);
  } catch (e) {
    console.error(`  ERROR connecting: ${e.message}`);
    return;
  }

  const db = conn.getClient().db();
  let added = 0;

  // 1. Direct-type fallback mappings — all tenants need these
  console.log('\n-- Direct-type fallback mappings --');
  for (const m of DIRECT_FALLBACKS) {
    const ok = await upsertMapping(db, m);
    if (ok) added++;
  }

  // 2. Operational mappings — CG and LoopC only (MG already has them)
  if (opts.addOperational) {
    console.log('\n-- Operational mappings --');
    for (const m of OPERATIONAL_MAPPINGS) {
      const ok = await upsertMapping(db, m);
      if (ok) added++;
    }
  }

  // 3. LoopC-specific: remove leftover mark/ooo debtor accounts
  if (opts.cleanupLoopC) {
    console.log('\n-- Cleanup: remove mark/ooo debtor accounts --');
    const targets = ['1300', '1302'];
    for (const code of targets) {
      const doc = await db.collection('chartofaccounts').findOne({ accountCode: code });
      if (!doc) {
        console.log(`  SKIP  accountCode ${code} not found`);
        continue;
      }
      // Check if any ledger entries reference this account
      const ledgerRefs = await db.collection('ledgers').countDocuments({
        $or: [{ debitAccountId: doc._id }, { creditAccountId: doc._id }],
      });
      if (ledgerRefs > 0) {
        console.log(`  SKIP  accountCode ${code} "${doc.accountName}" — has ${ledgerRefs} ledger entries, manual review required`);
        continue;
      }
      await db.collection('chartofaccounts').deleteOne({ _id: doc._id });
      console.log(`  REMOVED  ${code} "${doc.accountName}"`);
    }
  }

  await conn.close();
  console.log(`\n  Done. ${added} mapping(s) added.`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  await processTenant('MG',    process.env.MONGO_URI_MG,    { addOperational: false, cleanupLoopC: false });
  await processTenant('CG',    process.env.MONGO_URI_CG,    { addOperational: true,  cleanupLoopC: false });
  await processTenant('LoopC', process.env.MONGO_URI_LOOPC, { addOperational: true,  cleanupLoopC: true  });

  console.log('\nAll tenants processed.');
  process.exit(0);
})().catch(async (e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
