require('./destructive/_destructive-guard')({ scriptName: __filename })
require('dotenv').config()
const dns = require('dns')

const ChartOfAccount = require('../models/ChartOfAccount')
const AccountMapping = require('../models/AccountMapping')
const { TENANT_KEYS } = require('../config/tenants')

dns.setServers(['8.8.8.8', '1.1.1.1'])

const ACCOUNT_DEFINITIONS = [
  {
    accountCode: '1190',
    accountName: 'VAT Receivable',
    accountType: 'Asset',
    description: 'Input VAT to recover from tax authority',
    department: 'finance',
    parentCode: '1100',
  },
  {
    accountCode: '2190',
    accountName: 'VAT Payable',
    accountType: 'Liability',
    description: 'Output VAT owed to tax authority',
    department: 'finance',
    parentCode: '2000',
  },
  {
    accountCode: '5190',
    accountName: 'Exchange Loss',
    accountType: 'Expense',
    description: 'Foreign exchange loss on settlements',
    department: 'finance',
    parentCode: '6100',
  },
]

const MAPPING_DEFINITIONS = [
  {
    mappingType: 'exchange_gain',
    debitCode: '1010',
    creditCode: '4190',
    description: 'FX gain adjustment: Dr Bank / Cr Exchange Gain (Income 4190)',
    department: 'finance',
  },
  {
    mappingType: 'exchange_loss',
    debitCode: '5190',
    creditCode: '1010',
    description: 'FX loss adjustment: Dr Exchange Loss / Cr Bank',
    department: 'finance',
  },
  {
    mappingType: 'vat_input',
    debitCode: '1190',
    creditCode: '2000',
    description: 'Input VAT accrual: Dr VAT Receivable / Cr Accounts Payable',
    department: 'finance',
  },
  {
    mappingType: 'vat_output',
    debitCode: '1100',
    creditCode: '2190',
    description: 'Output VAT accrual: Dr Accounts Receivable / Cr VAT Payable',
    department: 'finance',
  },
  {
    mappingType: 'vat_settlement',
    debitCode: '2190',
    creditCode: '1190',
    description: 'VAT net-off during tax return period close',
    department: 'finance',
  },
]

async function ensureAccount(AccountModel, definition) {
  const parent = definition.parentCode
    ? await AccountModel.findOne({ accountCode: definition.parentCode })
        .select('_id')
        .lean()
    : null

  await AccountModel.updateOne(
    { accountCode: definition.accountCode },
    {
      $set: {
        accountName: definition.accountName,
        accountType: definition.accountType,
        description: definition.description,
        department: definition.department || '',
        currency: 'USD',
        isActive: true,
        parentAccountId: parent?._id || null,
      },
      $setOnInsert: {
        openingBalance: 0,
        usedInTransactions: false,
      },
    },
    { upsert: true }
  )

  return AccountModel.findOne({ accountCode: definition.accountCode })
    .select('_id accountCode accountName accountType')
    .lean()
}

async function ensureMapping(MappingModel, accountByCode, definition) {
  const debit = accountByCode.get(definition.debitCode)
  const credit = accountByCode.get(definition.creditCode)

  if (!debit || !credit) {
    throw new Error(`Missing account(s) for mapping ${definition.mappingType}: ${definition.debitCode} -> ${definition.creditCode}`)
  }

  await MappingModel.updateOne(
    { mappingType: definition.mappingType },
    {
      $set: {
        mappingType: definition.mappingType,
        debitAccountId: debit._id,
        creditAccountId: credit._id,
        description: definition.description,
        department: definition.department || '',
        isActive: true,
      },
    },
    { upsert: true }
  )
}

async function bootstrapTenant(tenant) {
  const AccountModel = await ChartOfAccount.getTenantModel(tenant)
  const MappingModel = await AccountMapping.getTenantModel(tenant)

  const baselineCodes = ['1010', '1100', '2000', '6100']
  for (const code of baselineCodes) {
    const baseline = await AccountModel.findOne({ accountCode: code }).lean()
    if (!baseline) {
      console.warn(`[${tenant}] Baseline account ${code} is missing. Some parent links may be skipped.`)
    }
  }

  const allNeededCodes = Array.from(new Set([
    ...ACCOUNT_DEFINITIONS.map((x) => x.accountCode),
    ...MAPPING_DEFINITIONS.map((x) => x.debitCode),
    ...MAPPING_DEFINITIONS.map((x) => x.creditCode),
  ]))

  const accountByCode = new Map()

  for (const definition of ACCOUNT_DEFINITIONS) {
    const account = await ensureAccount(AccountModel, definition)
    accountByCode.set(definition.accountCode, account)
  }

  for (const code of allNeededCodes) {
    if (accountByCode.has(code)) continue
    const account = await AccountModel.findOne({ accountCode: code })
      .select('_id accountCode accountName accountType')
      .lean()

    if (!account) {
      throw new Error(`[${tenant}] Required account ${code} does not exist. Seed base chart first.`)
    }

    accountByCode.set(code, account)
  }

  for (const definition of MAPPING_DEFINITIONS) {
    await ensureMapping(MappingModel, accountByCode, definition)
  }

  const mappingTypes = MAPPING_DEFINITIONS.map((x) => x.mappingType)
  const activeMappings = await MappingModel.find({ mappingType: { $in: mappingTypes }, isActive: true })
    .select('mappingType debitAccountId creditAccountId')
    .lean()

  return {
    tenant,
    accountsEnsured: ACCOUNT_DEFINITIONS.length,
    mappingsEnsured: activeMappings.length,
  }
}

async function main() {
  console.log('Bootstrapping VAT/FX statutory accounts and mappings across tenants...')

  const results = []
  for (const tenant of TENANT_KEYS) {
    const summary = await bootstrapTenant(tenant)
    results.push(summary)
    console.log(`[${tenant}] accounts=${summary.accountsEnsured}, mappings=${summary.mappingsEnsured}`)
  }

  console.log('Completed statutory bootstrap for tenants:', results.map((x) => x.tenant).join(', '))
  process.exit(0)
}

main().catch((err) => {
  console.error('Statutory bootstrap failed:', err.message)
  process.exit(1)
})
require('./destructive/_destructive-guard')({ scriptName: __filename })
