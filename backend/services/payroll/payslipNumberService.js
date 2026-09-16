const PayrollSequence = require('../../models/PayrollSequence')

/**
 * Allocate next payslip number: LoopC-PS-YYYY-MM-######
 * Tenant-scoped via createTenantModel / getTenantModel.
 */
async function allocatePayslipNumber(tenant, year, month) {
  const y = Number(year)
  const m = Number(month)
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
    const err = new Error('Invalid year/month for payslip number')
    err.statusCode = 400
    throw err
  }

  const mm = String(m).padStart(2, '0')
  const key = `payslip:${y}-${mm}`
  const TenantSeq = await PayrollSequence.getTenantModel(tenant)
  const doc = await TenantSeq.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  )

  const seq = Number(doc.seq) || 1
  const padded = String(seq).padStart(6, '0')
  return `LoopC-PS-${y}-${mm}-${padded}`
}

module.exports = {
  allocatePayslipNumber,
}
