const { isAccountingPeriodClosingEnabled } = require('../../shared/accountingPeriodClosing')
const { getActiveTenantKey } = require('../../db/tenantModelProxy')

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function toDate(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function calendarParts(date) {
  const d = toDate(date)
  if (!d) return null
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
  }
}

function monthBounds(year, month) {
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
  return { startDate, endDate }
}

function yearBounds(year) {
  const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0))
  const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))
  return { startDate, endDate }
}

function periodLabel(periodType, financialYear, month) {
  if (periodType === 'YEARLY') return `FY ${financialYear}`
  const name = MONTH_NAMES[(month || 1) - 1] || `Month ${month}`
  return `${name} ${financialYear}`
}

function makePeriodClosedError(label) {
  const err = new Error(
    `${label} is closed. Accounting entries in this period cannot be modified. Please contact Super Admin if a correction is required.`,
  )
  err.status = 409
  err.code = 'ACCOUNTING_PERIOD_CLOSED'
  err.details = { periodLabel: label }
  return err
}

function createAccountingPeriodLockService(deps = {}) {
  const AccountingPeriod = deps.AccountingPeriod
  const Transaction = deps.Transaction
  const Ledger = deps.Ledger
  const ChartOfAccount = deps.ChartOfAccount

  async function ensureMonthlyPeriod(year, month) {
    const { startDate, endDate } = monthBounds(year, month)
    let doc = await AccountingPeriod.findOne({
      periodType: 'MONTHLY',
      financialYear: year,
      month,
    })
    if (doc) return doc
    try {
      doc = await AccountingPeriod.create({
        periodType: 'MONTHLY',
        financialYear: year,
        month,
        startDate,
        endDate,
        status: 'OPEN',
      })
      return doc
    } catch (err) {
      if (err?.code === 11000) {
        return AccountingPeriod.findOne({ periodType: 'MONTHLY', financialYear: year, month })
      }
      throw err
    }
  }

  async function ensureYearlyPeriod(year) {
    const { startDate, endDate } = yearBounds(year)
    let doc = await AccountingPeriod.findOne({
      periodType: 'YEARLY',
      financialYear: year,
      month: null,
    })
    if (doc) return doc
    try {
      doc = await AccountingPeriod.create({
        periodType: 'YEARLY',
        financialYear: year,
        month: null,
        startDate,
        endDate,
        status: 'OPEN',
      })
      return doc
    } catch (err) {
      if (err?.code === 11000) {
        return AccountingPeriod.findOne({ periodType: 'YEARLY', financialYear: year, month: null })
      }
      throw err
    }
  }

  async function ensurePeriodsForDate(date) {
    const parts = calendarParts(date)
    if (!parts) return null
    const [monthly, yearly] = await Promise.all([
      ensureMonthlyPeriod(parts.year, parts.month),
      ensureYearlyPeriod(parts.year),
    ])
    return { monthly, yearly, ...parts }
  }

  async function assertDateOpen(date) {
    const parts = calendarParts(date)
    if (!parts) return
    const { monthly, yearly } = await ensurePeriodsForDate(date)
    if (monthly?.status === 'CLOSED') {
      throw makePeriodClosedError(periodLabel('MONTHLY', parts.year, parts.month))
    }
    if (yearly?.status === 'CLOSED') {
      throw makePeriodClosedError(periodLabel('YEARLY', parts.year, null))
    }
  }

  /**
   * Central lock check. No-op when feature flag is off for the tenant.
   * On edits, pass both `date` (new) and `existingDate` (stored).
   */
  async function assertAccountingPeriodOpen({ tenant, date, existingDate } = {}) {
    const tenantKey = String(tenant || getActiveTenantKey() || '').trim().toLowerCase()
    if (!isAccountingPeriodClosingEnabled(tenantKey)) return
    if (existingDate) await assertDateOpen(existingDate)
    if (date) await assertDateOpen(date)
  }

  function effectiveTransactionDate(tx) {
    return toDate(tx?.voucherMeta?.valueDate || tx?.date || null)
  }

  async function listPeriodsForYear(financialYear) {
    const year = Number(financialYear)
    if (!Number.isFinite(year)) return { yearly: null, months: [] }

    await ensureYearlyPeriod(year)
    await Promise.all(Array.from({ length: 12 }, (_, i) => ensureMonthlyPeriod(year, i + 1)))

    const rows = await AccountingPeriod.find({ financialYear: year }).sort({ periodType: -1, month: 1 }).lean()
    const yearly = rows.find((r) => r.periodType === 'YEARLY') || null
    const months = rows.filter((r) => r.periodType === 'MONTHLY')
    return { yearly, months }
  }

  async function getClosingChecklist(period) {
    if (!period) {
      return { canClose: false, blocking: [{ id: 'missing', label: 'Period not found', ok: false }], informational: [] }
    }

    const start = toDate(period.startDate)
    const end = toDate(period.endDate)
    const blocking = []
    const informational = []

    const unposted = await Transaction.countDocuments({
      isDeleted: { $ne: true },
      status: { $in: ['draft', 'submitted', 'approved'] },
      $or: [
        { 'voucherMeta.valueDate': { $gte: start, $lte: end } },
        {
          $and: [
            { $or: [{ 'voucherMeta.valueDate': null }, { 'voucherMeta.valueDate': { $exists: false } }] },
            { date: { $gte: start, $lte: end } },
          ],
        },
      ],
    })
    blocking.push({
      id: 'unposted',
      label: unposted
        ? `${unposted} draft/submitted/approved transaction(s) in period`
        : 'All transactions posted (no drafts pending)',
      ok: unposted === 0,
      count: unposted,
    })

    const ledgers = await Ledger.find({
      isDeleted: { $ne: true },
      date: { $gte: start, $lte: end },
    }).select('debitAccountId creditAccountId amount referenceType referenceId').lean()

    const missingAccounts = ledgers.filter((row) => !row.debitAccountId || !row.creditAccountId).length
    blocking.push({
      id: 'ledger_refs',
      label: missingAccounts
        ? `${missingAccounts} ledger entr(ies) missing debit/credit account`
        : 'Ledger account references OK',
      ok: missingAccounts === 0,
      count: missingAccounts,
    })

    if (ChartOfAccount) {
      const accountIds = [...new Set(ledgers.flatMap((r) => [
        String(r.debitAccountId || ''),
        String(r.creditAccountId || ''),
      ]).filter(Boolean))]
      if (accountIds.length) {
        const existing = await ChartOfAccount.find({
          _id: { $in: accountIds },
          isDeleted: { $ne: true },
        }).select('_id').lean()
        const existingSet = new Set(existing.map((a) => String(a._id)))
        const orphaned = accountIds.filter((id) => !existingSet.has(id)).length
        blocking.push({
          id: 'orphan_accounts',
          label: orphaned
            ? `${orphaned} ledger account reference(s) not found`
            : 'Ledger integrity OK',
          ok: orphaned === 0,
          count: orphaned,
        })
      } else {
        blocking.push({ id: 'orphan_accounts', label: 'Ledger integrity OK', ok: true, count: 0 })
      }
    }

    const bankCount = ledgers.filter((r) => r.referenceType === 'bank_jv').length
    const vatCount = ledgers.filter((r) => r.referenceType === 'vat_input' || r.referenceType === 'vat_output').length
    const invCount = ledgers.filter((r) => r.referenceType === 'inventory' || r.referenceType === 'cogs').length
    informational.push(
      { id: 'bank', label: `Bank accounting checked (${bankCount} bank JV lines)`, ok: true },
      { id: 'tax', label: `Tax/VAT accounting checked (${vatCount} VAT lines)`, ok: true },
      { id: 'inventory', label: `Inventory accounting checked (${invCount} stock/COGS lines)`, ok: true },
      { id: 'customer', label: 'Customer accounting checked', ok: true },
      { id: 'vendor', label: 'Vendor accounting checked', ok: true },
    )

    const canClose = blocking.every((item) => item.ok)
    return { canClose, blocking, informational }
  }

  async function cascadeCloseMonthlyPeriodsForYear({ financialYear, closedAt, closedBy, closeReason }) {
    const year = Number(financialYear)
    if (!Number.isFinite(year)) return []

    const cascaded = []
    for (let month = 1; month <= 12; month += 1) {
      const monthly = await ensureMonthlyPeriod(year, month)
      if (!monthly || String(monthly.status || '').toUpperCase() === 'CLOSED') continue
      const previousStatus = monthly.status
      monthly.status = 'CLOSED'
      monthly.closedAt = closedAt
      monthly.closedBy = closedBy
      monthly.closeReason = closeReason
      await monthly.save()
      cascaded.push({
        period: monthly,
        previousStatus,
        label: periodLabel('MONTHLY', year, month),
      })
    }
    return cascaded
  }

  return {
    isAccountingPeriodClosingEnabled,
    ensurePeriodsForDate,
    ensureMonthlyPeriod,
    ensureYearlyPeriod,
    cascadeCloseMonthlyPeriodsForYear,
    assertAccountingPeriodOpen,
    effectiveTransactionDate,
    listPeriodsForYear,
    getClosingChecklist,
    periodLabel,
    calendarParts,
    monthBounds,
    yearBounds,
    makePeriodClosedError,
  }
}

module.exports = {
  createAccountingPeriodLockService,
  isAccountingPeriodClosingEnabled,
  periodLabel,
  calendarParts,
  monthBounds,
  yearBounds,
  makePeriodClosedError,
}
