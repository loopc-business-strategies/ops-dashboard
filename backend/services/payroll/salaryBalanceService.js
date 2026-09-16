const SalaryBalance = require('../../models/SalaryBalance')
const { toAmount } = require('./payrollCalculationService')
const { auditLog } = require('../../middleware/audit')

/**
 * Idempotently create salary-balance (arrears) records for lines with outstanding > 0.
 * Does not mutate PayrollRun earned amounts.
 */
async function ensureSalaryBalancesForRun(tenant, run, actor = {}) {
  const TenantBalance = await SalaryBalance.getTenantModel(tenant)
  const created = []
  const skipped = []

  for (const line of run.lines || []) {
    const outstanding = toAmount(line.salaryBalance)
    if (!(outstanding > 0)) continue

    const existing = await TenantBalance.findOne({
      payrollRunId: run._id,
      employeeId: line.employeeId,
      isDeleted: { $ne: true },
    })

    if (existing) {
      skipped.push(existing)
      continue
    }

    const doc = await TenantBalance.create({
      employeeId: line.employeeId,
      employeeName: line.employeeName || '',
      employeeCode: line.employeeCode || '',
      payrollRunId: run._id,
      year: run.year,
      month: run.month,
      earnedAmount: toAmount(line.net),
      amountPaidFromPayroll: toAmount(line.amountPaid),
      originalOutstanding: outstanding,
      outstandingAmount: outstanding,
      status: 'OUTSTANDING',
      payments: [],
      createdById: actor._id || null,
      createdByName: actor.name || '',
    })
    created.push(doc)
  }

  return { created, skipped }
}

async function applySalaryBalancePayment(tenant, balanceId, { amount, note, idempotencyKey }, actor, req) {
  const TenantBalance = await SalaryBalance.getTenantModel(tenant)
  const balance = await TenantBalance.findOne({ _id: balanceId, isDeleted: { $ne: true } })
  if (!balance) {
    const err = new Error('Salary balance not found.')
    err.statusCode = 404
    throw err
  }
  if (balance.status === 'PAID') {
    return { balance, idempotent: true }
  }

  if (idempotencyKey) {
    const prior = (balance.payments || []).find((p) => p.idempotencyKey && p.idempotencyKey === idempotencyKey)
    if (prior) return { balance, idempotent: true }
  }

  const pay = toAmount(amount)
  if (!(pay > 0)) {
    const err = new Error('Payment amount must be greater than zero.')
    err.statusCode = 400
    throw err
  }
  if (pay > toAmount(balance.outstandingAmount) + 0.001) {
    const err = new Error('Payment exceeds outstanding salary balance.')
    err.statusCode = 400
    throw err
  }

  const nextOutstanding = toAmount(Math.max(0, toAmount(balance.outstandingAmount) - pay))
  balance.payments.push({
    amount: pay,
    paidAt: new Date(),
    note: note || '',
    paidById: actor._id || null,
    paidByName: actor.name || '',
    idempotencyKey: idempotencyKey || '',
  })
  balance.outstandingAmount = nextOutstanding
  balance.status = nextOutstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID'
  await balance.save()

  if (req) {
    await auditLog(req, {
      resource: 'SalaryBalance',
      resourceId: balance._id,
      action: 'salary_balance_payment',
      detail: `paid=${pay} remaining=${nextOutstanding}`,
    })
  }

  return { balance, idempotent: false }
}

module.exports = {
  ensureSalaryBalancesForRun,
  applySalaryBalancePayment,
}
