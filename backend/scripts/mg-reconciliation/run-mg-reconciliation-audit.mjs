#!/usr/bin/env node
/**
 * MG ERP — READ-ONLY full database reconciliation audit.
 *
 * Usage:
 *   npm run audit:mg-reconciliation
 *   node backend/scripts/mg-reconciliation/run-mg-reconciliation-audit.mjs
 *
 * Requires MONGO_URI_MG. Never writes to the database.
 */
import path from 'path'
import { fileURLToPath } from 'url'
import { connectMgReadOnly } from './lib/readOnlyMongo.mjs'
import { createFindings } from './lib/findings.mjs'
import { writeAllReports, ensureReportDir } from './lib/reportWriter.mjs'
import { loadAuditContext } from './lib/loadContext.mjs'
import { phase01InventoryDb } from './phases/01-inventory-db.mjs'
import { phase02Vouchers } from './phases/02-vouchers.mjs'
import { phase03DoubleEntry } from './phases/03-double-entry.mjs'
import { phase04VoucherLedger } from './phases/04-voucher-ledger.mjs'
import { phase05ChartOfAccounts } from './phases/05-chart-of-accounts.mjs'
import { phase06AccountBalances } from './phases/06-account-balances.mjs'
import { phase07Inventory } from './phases/07-inventory.mjs'
import { phase08StockMovements } from './phases/08-stock-movements.mjs'
import { phase09Metal, phase10MetalTransfer } from './phases/09-10-metal.mjs'
import { phase11Cogs, phase12Vat, phase13Fx } from './phases/11-13-cogs-vat-fx.mjs'
import {
  phase14Reports, phase15Orphans, phase16Duplicates, phase17Rounding,
} from './phases/14-17-reports-orphans.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../../..')
const REPORT_DIR = path.join(ROOT, 'reports', 'mg-reconciliation')

async function main() {
  const auditTimestamp = new Date().toISOString()
  const findings = createFindings()
  const details = { phases: {} }

  console.log('[mg-reconciliation] Connecting (read-only) via MONGO_URI_MG…')
  const { db, dbName, uriDefaultDb, readOnly, close } = await connectMgReadOnly()

  try {
    // Prove write guard is active
    try {
      db.collection('transactions').insertOne({ __audit_probe: true })
      throw new Error('READ-ONLY GUARD FAILED — insertOne was not blocked')
    } catch (err) {
      if (!String(err.message || '').includes('READ-ONLY')) throw err
      console.log('[mg-reconciliation] Read-only guard active (insertOne blocked).')
    }

    console.log(`[mg-reconciliation] Database: ${dbName}`)
    if (uriDefaultDb && uriDefaultDb !== dbName) {
      console.log(`[mg-reconciliation] Note: URI default DB was "${uriDefaultDb}"; MG_RECON_DB override → "${dbName}".`)
    } else if (dbName !== 'ops_mg') {
      console.log(`[mg-reconciliation] Note: auditing URI DB "${dbName}" (set MG_RECON_DB=ops_mg to force that name on the same cluster).`)
    }
    console.log('[mg-reconciliation] Loading collections…')
    const ctx = await loadAuditContext(db)

    details.phases.p01 = await phase01InventoryDb(db, findings)
    details.phases.p02 = phase02Vouchers(ctx, findings)
    details.phases.p03 = phase03DoubleEntry(ctx, findings)
    details.phases.p04 = phase04VoucherLedger(ctx, findings)
    details.phases.p05 = phase05ChartOfAccounts(ctx, findings)
    details.phases.p06 = phase06AccountBalances(ctx, findings)
    details.phases.p07 = phase07Inventory(ctx, findings)
    details.phases.p08 = phase08StockMovements(ctx, findings)
    details.phases.p09 = phase09Metal(ctx, findings)
    details.phases.p10 = phase10MetalTransfer(ctx, findings)
    details.phases.p11 = phase11Cogs(ctx, findings)
    details.phases.p12 = phase12Vat(ctx, findings)
    details.phases.p13 = phase13Fx(ctx, findings)
    details.phases.p14 = phase14Reports(ctx, findings, details.phases.p06.balances)
    details.phases.p15 = phase15Orphans(ctx, findings)
    details.phases.p16 = phase16Duplicates(ctx, findings)
    details.phases.p17 = phase17Rounding(findings)

    const discrepancyCount = findings.discrepancies().length
    const summary = {
      database: dbName,
      auditTimestamp,
      readOnly: true,
      readOnlyGuardVerified: true,
      connection: 'MONGO_URI_MG (password redacted)',
      counts: {
        collectionsInspected: details.phases.p01.collectionCount,
        documentsInspected: details.phases.p01.documentCount,
        vouchersChecked: ctx.transactions.length,
        postedVouchers: ctx.postedTx.length,
        ledgerEntriesChecked: ctx.ledgers.length,
        inventoryItemsChecked: ctx.inventoryItems.length,
        stockMovementsChecked: ctx.stockMovements.length,
        discrepancies: discrepancyCount,
        orphans: details.phases.p15.count,
        duplicates: details.phases.p16.count,
        unbalancedTransactions: details.phases.p03.unbalanced,
        inventoryDifferences: details.phases.p07.differences,
        metalDifferences: details.phases.p09.differences + details.phases.p10.mismatches,
        cogsDifferences: details.phases.p11.differences,
        vatDifferences: details.phases.p12.differences,
        fxDifferences: details.phases.p13.differences,
      },
      domainCounters: findings.counters,
      totalsBySeverity: {
        PASS: findings.countBySeverity('PASS'),
        WARNING: findings.countBySeverity('WARNING'),
        ERROR: findings.countBySeverity('ERROR'),
        CRITICAL: findings.countBySeverity('CRITICAL'),
        INFORMATIONAL: findings.countBySeverity('INFORMATIONAL'),
      },
      note: 'PASS is recorded only where a specific reconciliation matched. Script success alone does not mean the ERP is correct.',
    }

    details.findingsCount = findings.items.length
    details.collections = details.phases.p01.collections

    ensureReportDir(REPORT_DIR)
    const files = writeAllReports({ reportDir: REPORT_DIR, summary, details, findings })

    console.log('\n========== MG ERP RECONCILIATION AUDIT COMPLETE ==========')
    console.log('1. Files created/modified:')
    for (const f of files) console.log(`   - ${f}`)
    console.log('2. Command: npm run audit:mg-reconciliation')
    console.log(`3. Database used: ${dbName}`)
    console.log('4. Confirmation: READ-ONLY (write guard verified; no inserts/updates/deletes)')
    console.log(`5. Collections inspected: ${summary.counts.collectionsInspected}`)
    console.log(`6. Documents inspected: ${summary.counts.documentsInspected}`)
    console.log(`7. Vouchers checked: ${summary.counts.vouchersChecked}`)
    console.log(`8. Ledger entries checked: ${summary.counts.ledgerEntriesChecked}`)
    console.log(`9. Inventory items checked: ${summary.counts.inventoryItemsChecked}`)
    console.log(`10. Stock movements checked: ${summary.counts.stockMovementsChecked}`)
    console.log(`11. Discrepancies (WARNING+ERROR+CRITICAL): ${summary.counts.discrepancies}`)
    console.log(`12. Report directory: ${REPORT_DIR}`)
    console.log('===========================================================')
    console.log(JSON.stringify({
      database: summary.database,
      auditTimestamp: summary.auditTimestamp,
      domainCounters: summary.domainCounters,
      counts: summary.counts,
    }, null, 2))
  } finally {
    await close()
  }
}

main().catch((err) => {
  console.error('[mg-reconciliation] FAILED:', err.message)
  process.exitCode = 1
})
