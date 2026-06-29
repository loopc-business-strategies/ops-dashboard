const AccountMapping = require('../models/AccountMapping')
const ChartOfAccount = require('../models/ChartOfAccount')

const normalizeDepartment = (value) => String(value || '').trim().toLowerCase()

module.exports = {
  id: '002-backfill-mapping-departments',
  async up({ tenant }) {
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
        skippedCount += 1
        continue
      }

      await AccountMapping.updateOne({ _id: mapping._id }, { $set: { department: nextDepartment } })
      updatedCount += 1
    }

    console.log(`[${tenant}] mapping departments: updated=${updatedCount} skipped=${skippedCount}`)
  },
}
