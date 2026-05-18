require('./destructive/_destructive-guard')({ scriptName: __filename })
require('dotenv').config()
const mongoose = require('mongoose')
const AccountMapping = require('../models/AccountMapping')
const ChartOfAccount = require('../models/ChartOfAccount')

const normalizeDepartment = (value) => String(value || '').trim().toLowerCase()

async function backfill() {
  if (!process.env.MONGO_URI_CG) throw new Error('Missing MONGO_URI_CG')
  await mongoose.connect(process.env.MONGO_URI_CG)

  const mappings = await AccountMapping.find({}).lean()
  let updatedCount = 0
  let skippedCount = 0

  for (const mapping of mappings) {
    if (normalizeDepartment(mapping.department)) {
      skippedCount += 1
      continue
    }

    const [debitAccount, creditAccount] = await Promise.all([
      ChartOfAccount.findById(mapping.debitAccountId).select('department accountCode').lean(),
      ChartOfAccount.findById(mapping.creditAccountId).select('department accountCode').lean(),
    ])

    const debitDepartment = normalizeDepartment(debitAccount?.department)
    const creditDepartment = normalizeDepartment(creditAccount?.department)

    let nextDepartment = ''
    if (debitDepartment && creditDepartment && debitDepartment === creditDepartment) {
      nextDepartment = debitDepartment
    } else if (debitDepartment && !creditDepartment) {
      nextDepartment = debitDepartment
    } else if (!debitDepartment && creditDepartment) {
      nextDepartment = creditDepartment
    }

    if (!nextDepartment) {
      console.log(`Skipping ${mapping.mappingType}: unable to infer department from ${debitAccount?.accountCode || 'N/A'} / ${creditAccount?.accountCode || 'N/A'}`)
      skippedCount += 1
      continue
    }

    await AccountMapping.updateOne({ _id: mapping._id }, { $set: { department: nextDepartment } })
    console.log(`Updated ${mapping.mappingType} -> ${nextDepartment}`)
    updatedCount += 1
  }

  console.log(`Backfill complete. Updated: ${updatedCount}, skipped: ${skippedCount}`)
  await mongoose.disconnect()
}

backfill().catch(async (error) => {
  console.error('Mapping department backfill failed:', error.message)
  await mongoose.disconnect()
  process.exit(1)
})
require('./destructive/_destructive-guard')({ scriptName: __filename })
