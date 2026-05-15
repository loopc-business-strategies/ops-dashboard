require('./_destructive-guard')({ scriptName: __filename })
/**
 * fix-exchange-gain-mapping.js
 *
 * Fixes exchange_gain mapping to use 4190 (Income) instead of 5191 (Contra Expense)
 * and removes the 5191 account from all tenants.
 *
 * Per IFRS IAS 21: exchange gains are Other Income, not contra-expenses.
 */

require('dotenv').config()
const dns = require('dns')
const ChartOfAccount = require('../../models/ChartOfAccount')
const AccountMapping = require('../../models/AccountMapping')
const Ledger = require('../../models/Ledger')
const { TENANT_KEYS } = require('../../config/tenants')

dns.setServers(['8.8.8.8', '1.1.1.1'])

async function fixTenant(tenant) {
  const AccountModel = await ChartOfAccount.getTenantModel(tenant)
  const MappingModel = await AccountMapping.getTenantModel(tenant)
  const LedgerModel = await Ledger.getTenantModel(tenant)

  // 1. Find 4190 (Exchange Gain - Income)
  const gain4190 = await AccountModel.findOne({ accountCode: '4190' }).select('_id accountName').lean()
  if (!gain4190) {
    console.error(`[${tenant}] Account 4190 not found — skipping`)
    return
  }

  // 2. Find 5191 (Exchange Gain Contra Expense)
  const contra5191 = await AccountModel.findOne({ accountCode: '5191' }).select('_id accountName').lean()
  if (!contra5191) {
    console.log(`[${tenant}] 5191 not found — nothing to remove`)
  }

  // 3. Find bank account 1010
  const bank1010 = await AccountModel.findOne({ accountCode: '1010' }).select('_id').lean()
  if (!bank1010) {
    console.error(`[${tenant}] Account 1010 not found — skipping`)
    return
  }

  // 4. Update exchange_gain mapping: creditAccountId → 4190
  const mappingResult = await MappingModel.updateOne(
    { mappingType: 'exchange_gain' },
    {
      $set: {
        debitAccountId: bank1010._id,
        creditAccountId: gain4190._id,
        description: 'FX gain adjustment: Dr Bank / Cr Exchange Gain (Income 4190)',
      },
    }
  )
  console.log(`[${tenant}] exchange_gain mapping updated → 4190 (matched: ${mappingResult.matchedCount}, modified: ${mappingResult.modifiedCount})`)

  // 5. Check if 5191 has any ledger history before removing
  if (contra5191) {
    const ledgerCount = await LedgerModel.countDocuments({
      $or: [
        { debitAccountId: contra5191._id },
        { creditAccountId: contra5191._id },
      ],
    })

    if (ledgerCount > 0) {
      console.warn(`[${tenant}] 5191 has ${ledgerCount} ledger entries — marking inactive instead of deleting`)
      await AccountModel.updateOne({ accountCode: '5191' }, { $set: { isActive: false } })
    } else {
      await AccountModel.deleteOne({ accountCode: '5191' })
      console.log(`[${tenant}] 5191 deleted (no ledger history)`)
    }
  }
}

async function main() {
  console.log('Fixing exchange_gain mapping: 5191 → 4190 across all tenants...\n')

  for (const tenant of TENANT_KEYS) {
    try {
      await fixTenant(tenant)
    } catch (err) {
      console.error(`[${tenant}] Error:`, err.message)
    }
  }

  console.log('\nDone.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fix failed:', err.message)
  process.exit(1)
})
