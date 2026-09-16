const express = require('express')
const { protect } = require('../middleware/auth')
const { Joi, validateBody, validateParams } = require('../middleware/validate')
const { auditLog } = require('../middleware/audit')
const { requireStructuredPayroll } = require('../middleware/structuredPayrollGate')
const { canWriteFinanceModule, canManageEmployees } = require('../services/permissions/moduleAccessPolicy')
const Employee = require('../models/Employee')
const EmployeeSalaryAssignment = require('../models/EmployeeSalaryAssignment')
const PayrollRun = require('../models/PayrollRun')
const Payslip = require('../models/Payslip')
const {
  calculateLineFromAssignment,
  calculateRunTotals,
  normalizeComponents,
} = require('../services/payroll/payrollCalculationService')
const {
  assertTransition,
  assertMutable,
} = require('../services/payroll/payrollStateMachine')
const { allocatePayslipNumber } = require('../services/payroll/payslipNumberService')

const router = express.Router()

const idParam = Joi.object({ id: Joi.string().hex().length(24).required() })
const employeeIdParam = Joi.object({ employeeId: Joi.string().hex().length(24).required() })

const componentSchema = Joi.object({
  code: Joi.string().trim().min(1).max(40).required(),
  label: Joi.string().trim().allow('').max(120).optional(),
  amount: Joi.number().min(0).required(),
})

const salaryAssignmentBody = Joi.object({
  earnings: Joi.array().items(componentSchema).default([]),
  deductions: Joi.array().items(componentSchema).default([]),
  employerContributions: Joi.array().items(componentSchema).default([]),
  effectiveFrom: Joi.date().iso().optional(),
  notes: Joi.string().trim().allow('').max(500).optional(),
})

const createRunSchema = Joi.object({
  year: Joi.number().integer().min(2000).max(2100).required(),
  month: Joi.number().integer().min(1).max(12).required(),
  label: Joi.string().trim().allow('').max(120).optional(),
  notes: Joi.string().trim().allow('').max(1000).optional(),
  employeeIds: Joi.array().items(Joi.string().hex().length(24)).optional(),
  idempotencyKey: Joi.string().trim().allow('').max(120).optional(),
})

const selectEmployeesSchema = Joi.object({
  employeeIds: Joi.array().items(Joi.string().hex().length(24)).min(1).required(),
})

const attendancePatchSchema = Joi.object({
  employeeId: Joi.string().hex().length(24).required(),
  daysWorked: Joi.number().min(0).allow(null).optional(),
  daysAbsent: Joi.number().min(0).allow(null).optional(),
  overtimeHours: Joi.number().min(0).allow(null).optional(),
  attendanceNotes: Joi.string().trim().allow('').max(500).optional(),
})

function canReadPayroll(user) {
  return canWriteFinanceModule(user) || canManageEmployees(user) || user?.role === 'super_admin'
}

function actorFields(user, prefix) {
  return {
    [`${prefix}ById`]: user?._id || null,
    [`${prefix}ByName`]: user?.name || '',
  }
}

// ─── Capability + auth on all routes ─────────────────────────────────────────
router.use(protect)
router.use((req, res, next) => {
  if (!requireStructuredPayroll(req, res)) return
  next()
})

// ─── Salary assignment ───────────────────────────────────────────────────────

router.get('/employees/:employeeId/salary-assignment', validateParams(employeeIdParam), async (req, res) => {
  try {
    if (!canReadPayroll(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }
    const TenantAssignment = await EmployeeSalaryAssignment.getTenantModel(req.tenant)
    const assignment = await TenantAssignment.findOne({
      employeeId: req.params.employeeId,
      isActive: true,
      isDeleted: { $ne: true },
    }).lean()
    res.json({ success: true, data: assignment || null })
  } catch (err) {
    console.error('[payroll-v2] get salary-assignment', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.put(
  '/employees/:employeeId/salary-assignment',
  validateParams(employeeIdParam),
  validateBody(salaryAssignmentBody),
  async (req, res) => {
    try {
      if (!canWriteFinanceModule(req.user) && !canManageEmployees(req.user)) {
        return res.status(403).json({ success: false, message: 'Access denied.' })
      }

      const TenantEmployee = await Employee.getTenantModel(req.tenant)
      const employee = await TenantEmployee.findOne({
        _id: req.params.employeeId,
        isDeleted: { $ne: true },
      })
      if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found.' })
      }

      const TenantAssignment = await EmployeeSalaryAssignment.getTenantModel(req.tenant)
      const existing = await TenantAssignment.findOne({
        employeeId: employee._id,
        isActive: true,
        isDeleted: { $ne: true },
      })

      const payload = {
        earnings: normalizeComponents(req.body.earnings),
        deductions: normalizeComponents(req.body.deductions),
        employerContributions: normalizeComponents(req.body.employerContributions),
        effectiveFrom: req.body.effectiveFrom ? new Date(req.body.effectiveFrom) : new Date(),
        notes: req.body.notes || '',
        createdById: req.user._id,
        createdByName: req.user.name,
        isActive: true,
        isDeleted: false,
      }

      let assignment
      const oldSnapshot = existing
        ? {
            earnings: existing.earnings,
            deductions: existing.deductions,
            employerContributions: existing.employerContributions,
            version: existing.version,
          }
        : null

      if (existing) {
        existing.isActive = false
        await existing.save()
        assignment = await TenantAssignment.create({
          ...payload,
          employeeId: employee._id,
          version: (existing.version || 1) + 1,
        })
      } else {
        assignment = await TenantAssignment.create({
          ...payload,
          employeeId: employee._id,
          version: 1,
        })
      }

      await auditLog(req, {
        resource: 'EmployeeSalaryAssignment',
        resourceId: assignment._id,
        action: existing ? 'salary_assignment_updated' : 'salary_assignment_created',
        detail: `Employee ${employee.employeeCode}`,
        changes: { old: oldSnapshot, new: {
          earnings: assignment.earnings,
          deductions: assignment.deductions,
          employerContributions: assignment.employerContributions,
          version: assignment.version,
        } },
      })

      res.json({ success: true, data: assignment })
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ success: false, message: 'Active salary assignment conflict. Retry.' })
      }
      console.error('[payroll-v2] put salary-assignment', err)
      res.status(500).json({ success: false, message: 'Server error.' })
    }
  }
)

// ─── Payroll runs ────────────────────────────────────────────────────────────

router.get('/runs', async (req, res) => {
  try {
    if (!canReadPayroll(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }
    const TenantRun = await PayrollRun.getTenantModel(req.tenant)
    const filter = { isDeleted: { $ne: true } }
    if (req.query.year) filter.year = Number(req.query.year)
    if (req.query.month) filter.month = Number(req.query.month)
    if (req.query.status) filter.status = String(req.query.status).toUpperCase()

    const runs = await TenantRun.find(filter)
      .select('-lines')
      .sort({ year: -1, month: -1, createdAt: -1 })
      .limit(100)
      .lean()
    res.json({ success: true, data: runs })
  } catch (err) {
    console.error('[payroll-v2] list runs', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.get('/runs/:id', validateParams(idParam), async (req, res) => {
  try {
    if (!canReadPayroll(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }
    const TenantRun = await PayrollRun.getTenantModel(req.tenant)
    const run = await TenantRun.findOne({ _id: req.params.id, isDeleted: { $ne: true } }).lean()
    if (!run) return res.status(404).json({ success: false, message: 'Payroll run not found.' })
    res.json({ success: true, data: run })
  } catch (err) {
    console.error('[payroll-v2] get run', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.post('/runs', validateBody(createRunSchema), async (req, res) => {
  try {
    if (!canWriteFinanceModule(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }

    const TenantRun = await PayrollRun.getTenantModel(req.tenant)
    const { year, month, label, notes, employeeIds, idempotencyKey } = req.body

    if (idempotencyKey) {
      const existing = await TenantRun.findOne({
        idempotencyKey,
        isDeleted: { $ne: true },
      }).lean()
      if (existing) {
        return res.status(200).json({ success: true, data: existing, idempotent: true })
      }
    }

    const periodClash = await TenantRun.findOne({
      year,
      month,
      isDeleted: { $ne: true },
    }).lean()
    if (periodClash) {
      return res.status(409).json({
        success: false,
        message: `A payroll run already exists for ${year}-${String(month).padStart(2, '0')}.`,
        data: periodClash,
      })
    }

    let lines = []
    if (Array.isArray(employeeIds) && employeeIds.length) {
      lines = await buildDraftLines(req.tenant, employeeIds)
    }

    const run = await TenantRun.create({
      year,
      month,
      label: label || `${year}-${String(month).padStart(2, '0')}`,
      notes: notes || '',
      status: 'DRAFT',
      lines,
      totals: calculateRunTotals(lines),
      idempotencyKey: idempotencyKey || '',
      ...actorFields(req.user, 'created'),
    })

    await auditLog(req, {
      resource: 'PayrollRun',
      resourceId: run._id,
      action: 'payroll_run_created',
      detail: `${run.label} (${run.lines.length} employees)`,
    })

    res.status(201).json({ success: true, data: run })
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Payroll run already exists for this period.' })
    }
    console.error('[payroll-v2] create run', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.post('/runs/:id/select-employees', validateParams(idParam), validateBody(selectEmployeesSchema), async (req, res) => {
  try {
    if (!canWriteFinanceModule(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }
    const TenantRun = await PayrollRun.getTenantModel(req.tenant)
    const run = await TenantRun.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
    if (!run) return res.status(404).json({ success: false, message: 'Payroll run not found.' })
    assertMutable(run)
    if (run.status !== 'DRAFT') {
      return res.status(400).json({ success: false, message: 'Employees can only be selected in DRAFT.' })
    }

    const lines = await buildDraftLines(req.tenant, req.body.employeeIds)
    run.lines = lines
    run.totals = calculateRunTotals(lines)
    run.version = (run.version || 1) + 1
    await run.save()

    await auditLog(req, {
      resource: 'PayrollRun',
      resourceId: run._id,
      action: 'payroll_employees_selected',
      detail: `${lines.length} employees`,
    })

    res.json({ success: true, data: run })
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code })
    console.error('[payroll-v2] select-employees', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.patch('/runs/:id/attendance', validateParams(idParam), validateBody(attendancePatchSchema), async (req, res) => {
  try {
    if (!canWriteFinanceModule(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }
    const TenantRun = await PayrollRun.getTenantModel(req.tenant)
    const run = await TenantRun.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
    if (!run) return res.status(404).json({ success: false, message: 'Payroll run not found.' })
    assertMutable(run)

    const line = run.lines.find((l) => String(l.employeeId) === String(req.body.employeeId))
    if (!line) return res.status(404).json({ success: false, message: 'Employee not on this run.' })

    if (req.body.daysWorked !== undefined) line.daysWorked = req.body.daysWorked
    if (req.body.daysAbsent !== undefined) line.daysAbsent = req.body.daysAbsent
    if (req.body.overtimeHours !== undefined) line.overtimeHours = req.body.overtimeHours
    if (req.body.attendanceNotes !== undefined) line.attendanceNotes = req.body.attendanceNotes

    await run.save()
    res.json({ success: true, data: run })
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code })
    console.error('[payroll-v2] attendance', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.post('/runs/:id/calculate', validateParams(idParam), async (req, res) => {
  try {
    if (!canWriteFinanceModule(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }
    const TenantRun = await PayrollRun.getTenantModel(req.tenant)
    const run = await TenantRun.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
    if (!run) return res.status(404).json({ success: false, message: 'Payroll run not found.' })

    // Idempotent: already CALCULATED with same version → return
    if (run.status === 'CALCULATED' && req.body?.idempotencyKey && run.idempotencyKey === req.body.idempotencyKey) {
      return res.json({ success: true, data: run, idempotent: true })
    }

    assertMutable(run)
    if (!['DRAFT', 'CALCULATED'].includes(run.status)) {
      assertTransition(run.status, 'CALCULATED')
    }

    if (!run.lines.length) {
      return res.status(400).json({ success: false, message: 'Select employees before calculating.' })
    }

    const TenantAssignment = await EmployeeSalaryAssignment.getTenantModel(req.tenant)
    const TenantEmployee = await Employee.getTenantModel(req.tenant)
    const employeeIds = run.lines.map((l) => l.employeeId)
    const [employees, assignments] = await Promise.all([
      TenantEmployee.find({ _id: { $in: employeeIds }, isDeleted: { $ne: true } }).lean(),
      TenantAssignment.find({
        employeeId: { $in: employeeIds },
        isActive: true,
        isDeleted: { $ne: true },
      }).lean(),
    ])
    const empMap = new Map(employees.map((e) => [String(e._id), e]))
    const asgMap = new Map(assignments.map((a) => [String(a.employeeId), a]))

    const missing = []
    const newLines = run.lines.map((line) => {
      const emp = empMap.get(String(line.employeeId))
      const asg = asgMap.get(String(line.employeeId))
      if (!emp || !asg) {
        missing.push(line.employeeCode || String(line.employeeId))
        return line
      }
      const calc = calculateLineFromAssignment(asg, emp)
      return {
        ...line.toObject?.() || line,
        ...calc,
        daysWorked: line.daysWorked,
        daysAbsent: line.daysAbsent,
        overtimeHours: line.overtimeHours,
        attendanceNotes: line.attendanceNotes || '',
      }
    })

    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Missing active salary assignment for: ${missing.join(', ')}`,
        missing,
      })
    }

    if (run.status === 'DRAFT') assertTransition('DRAFT', 'CALCULATED')

    run.lines = newLines
    run.totals = calculateRunTotals(newLines)
    run.status = 'CALCULATED'
    run.calculatedAt = new Date()
    Object.assign(run, actorFields(req.user, 'calculated'))
    run.version = (run.version || 1) + 1
    if (req.body?.idempotencyKey) run.idempotencyKey = req.body.idempotencyKey
    await run.save()

    await auditLog(req, {
      resource: 'PayrollRun',
      resourceId: run._id,
      action: 'payroll_run_calculated',
      detail: `totals net=${run.totals.net}`,
    })

    res.json({ success: true, data: run })
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code })
    console.error('[payroll-v2] calculate', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

async function transitionRun(req, res, { fromHint, toStatus, actorPrefix, action }) {
  try {
    if (!canWriteFinanceModule(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }
    const TenantRun = await PayrollRun.getTenantModel(req.tenant)
    const run = await TenantRun.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
    if (!run) return res.status(404).json({ success: false, message: 'Payroll run not found.' })

    if (run.status === toStatus) {
      return res.json({ success: true, data: run, idempotent: true })
    }

    if (fromHint && run.status !== fromHint && !(Array.isArray(fromHint) && fromHint.includes(run.status))) {
      assertTransition(run.status, toStatus)
    } else {
      assertTransition(run.status, toStatus)
    }

    run.status = toStatus
    run[`${actorPrefix}At`] = new Date()
    Object.assign(run, actorFields(req.user, actorPrefix))
    run.version = (run.version || 1) + 1
    await run.save()

    await auditLog(req, {
      resource: 'PayrollRun',
      resourceId: run._id,
      action,
      detail: `status → ${toStatus}`,
    })

    res.json({ success: true, data: run })
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code })
    console.error(`[payroll-v2] ${action}`, err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

router.post('/runs/:id/submit-review', validateParams(idParam), (req, res) =>
  transitionRun(req, res, {
    fromHint: 'CALCULATED',
    toStatus: 'UNDER_REVIEW',
    actorPrefix: 'submitted',
    action: 'payroll_run_submitted',
  })
)

router.post('/runs/:id/approve', validateParams(idParam), (req, res) =>
  transitionRun(req, res, {
    fromHint: 'UNDER_REVIEW',
    toStatus: 'APPROVED',
    actorPrefix: 'approved',
    action: 'payroll_run_approved',
  })
)

router.post('/runs/:id/finalize', validateParams(idParam), async (req, res) => {
  try {
    if (!canWriteFinanceModule(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }
    const TenantRun = await PayrollRun.getTenantModel(req.tenant)
    const run = await TenantRun.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
    if (!run) return res.status(404).json({ success: false, message: 'Payroll run not found.' })

    if (run.status === 'FINALIZED' || run.status === 'PAID') {
      return res.json({ success: true, data: run, idempotent: true })
    }

    assertTransition(run.status, 'FINALIZED')
    run.status = 'FINALIZED'
    run.finalizedAt = new Date()
    Object.assign(run, actorFields(req.user, 'finalized'))
    run.version = (run.version || 1) + 1
    await run.save()

    await auditLog(req, {
      resource: 'PayrollRun',
      resourceId: run._id,
      action: 'payroll_run_finalized',
      detail: `status → FINALIZED`,
    })

    res.json({ success: true, data: run })
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code })
    console.error('[payroll-v2] finalize', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.post('/runs/:id/mark-paid', validateParams(idParam), (req, res) =>
  transitionRun(req, res, {
    fromHint: 'FINALIZED',
    toStatus: 'PAID',
    actorPrefix: 'paid',
    action: 'payroll_run_paid',
  })
)

// ─── Payslips ────────────────────────────────────────────────────────────────

router.get('/payslips', async (req, res) => {
  try {
    if (!canReadPayroll(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }
    const TenantPayslip = await Payslip.getTenantModel(req.tenant)
    const filter = { isDeleted: { $ne: true } }
    if (req.query.year) filter.year = Number(req.query.year)
    if (req.query.month) filter.month = Number(req.query.month)
    if (req.query.employeeId) filter.employeeId = req.query.employeeId
    if (req.query.payrollRunId) filter.payrollRunId = req.query.payrollRunId
    if (req.query.q) {
      const q = String(req.query.q).trim()
      filter.$or = [
        { number: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { employeeName: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { employeeCode: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      ]
    }

    const slips = await TenantPayslip.find(filter).sort({ year: -1, month: -1, number: -1 }).limit(500).lean()
    res.json({ success: true, data: slips })
  } catch (err) {
    console.error('[payroll-v2] list payslips', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.get('/payslips/:id', validateParams(idParam), async (req, res) => {
  try {
    if (!canReadPayroll(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }
    const TenantPayslip = await Payslip.getTenantModel(req.tenant)
    const slip = await TenantPayslip.findOne({ _id: req.params.id, isDeleted: { $ne: true } }).lean()
    if (!slip) return res.status(404).json({ success: false, message: 'Payslip not found.' })
    res.json({ success: true, data: slip })
  } catch (err) {
    console.error('[payroll-v2] get payslip', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.post('/runs/:id/generate-payslips', validateParams(idParam), async (req, res) => {
  try {
    if (!canWriteFinanceModule(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }
    const TenantRun = await PayrollRun.getTenantModel(req.tenant)
    const run = await TenantRun.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
    if (!run) return res.status(404).json({ success: false, message: 'Payroll run not found.' })
    if (!['FINALIZED', 'PAID'].includes(run.status)) {
      return res.status(400).json({
        success: false,
        message: 'Payslips can only be generated for FINALIZED or PAID runs.',
      })
    }

    const TenantPayslip = await Payslip.getTenantModel(req.tenant)
    const created = []
    const skipped = []
    const failures = []

    for (const line of run.lines) {
      try {
        const existing = await TenantPayslip.findOne({
          payrollRunId: run._id,
          employeeId: line.employeeId,
          isDeleted: { $ne: true },
          isReissue: { $ne: true },
          paymentStatus: { $nin: ['REISSUED', 'VOID'] },
        }).lean()

        if (existing) {
          skipped.push({ employeeId: line.employeeId, payslipId: existing._id, number: existing.number })
          continue
        }

        const number = await allocatePayslipNumber(req.tenant, run.year, run.month)
        const slip = await TenantPayslip.create({
          number,
          payrollRunId: run._id,
          employeeId: line.employeeId,
          year: run.year,
          month: run.month,
          employeeName: line.employeeName,
          employeeCode: line.employeeCode,
          department: line.department,
          position: line.position,
          earnings: line.earnings,
          deductions: line.deductions,
          employerContributions: line.employerContributions,
          gross: line.gross,
          totalDeductions: line.totalDeductions,
          net: line.net,
          employerTotal: line.employerTotal,
          paymentDate: run.paidAt || null,
          paymentStatus: run.status === 'PAID' ? 'PAID' : 'PENDING',
          bankMasked: '****',
          generatedById: req.user._id,
          generatedByName: req.user.name,
          generatedAt: new Date(),
        })
        created.push({ employeeId: line.employeeId, payslipId: slip._id, number: slip.number })
      } catch (lineErr) {
        failures.push({
          employeeId: line.employeeId,
          employeeCode: line.employeeCode,
          message: lineErr.message,
        })
      }
    }

    await auditLog(req, {
      resource: 'PayrollRun',
      resourceId: run._id,
      action: 'payslips_bulk_generated',
      detail: `created=${created.length} skipped=${skipped.length} failed=${failures.length}`,
    })

    res.json({
      success: true,
      data: { created, skipped, failures },
    })
  } catch (err) {
    console.error('[payroll-v2] generate-payslips', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.post('/payslips/:id/reissue', validateParams(idParam), async (req, res) => {
  try {
    if (!canWriteFinanceModule(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }
    const TenantPayslip = await Payslip.getTenantModel(req.tenant)
    const original = await TenantPayslip.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
    if (!original) return res.status(404).json({ success: false, message: 'Payslip not found.' })
    if (original.paymentStatus === 'VOID') {
      return res.status(400).json({ success: false, message: 'Cannot reissue a void payslip.' })
    }

    const number = await allocatePayslipNumber(req.tenant, original.year, original.month)
    const reissue = await TenantPayslip.create({
      number,
      payrollRunId: original.payrollRunId,
      employeeId: original.employeeId,
      year: original.year,
      month: original.month,
      employeeName: original.employeeName,
      employeeCode: original.employeeCode,
      department: original.department,
      position: original.position,
      earnings: original.earnings,
      deductions: original.deductions,
      employerContributions: original.employerContributions,
      gross: original.gross,
      totalDeductions: original.totalDeductions,
      net: original.net,
      employerTotal: original.employerTotal,
      paymentDate: original.paymentDate,
      paymentStatus: 'PENDING',
      bankMasked: '****',
      supersedesPayslipId: original._id,
      isReissue: true,
      generatedById: req.user._id,
      generatedByName: req.user.name,
      generatedAt: new Date(),
    })

    original.paymentStatus = 'REISSUED'
    await original.save()

    await auditLog(req, {
      resource: 'Payslip',
      resourceId: reissue._id,
      action: 'payslip_reissued',
      detail: `${original.number} → ${reissue.number}`,
    })

    res.status(201).json({ success: true, data: reissue })
  } catch (err) {
    console.error('[payroll-v2] reissue', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.post('/payslips/:id/download-audit', validateParams(idParam), async (req, res) => {
  try {
    if (!canReadPayroll(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }
    await auditLog(req, {
      resource: 'Payslip',
      resourceId: req.params.id,
      action: 'payslip_downloaded',
      detail: 'PDF download',
    })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ─── My Payslips (self-service) ──────────────────────────────────────────────

router.get('/my-payslips', async (req, res) => {
  try {
    const code = String(req.user?.employeeCode || '').trim()
    if (!code) {
      return res.status(403).json({ success: false, message: 'No employee code linked to your user.' })
    }

    const TenantEmployee = await Employee.getTenantModel(req.tenant)
    const employee = await TenantEmployee.findOne({
      employeeCode: new RegExp(`^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      isDeleted: { $ne: true },
    }).lean()

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee record not found for your account.' })
    }

    // Force isolation — ignore any employeeId query param
    const TenantPayslip = await Payslip.getTenantModel(req.tenant)
    const TenantRun = await PayrollRun.getTenantModel(req.tenant)

    const finalizedRuns = await TenantRun.find({
      status: { $in: ['FINALIZED', 'PAID'] },
      isDeleted: { $ne: true },
    }).select('_id').lean()
    const runIds = finalizedRuns.map((r) => r._id)

    const slips = await TenantPayslip.find({
      employeeId: employee._id,
      payrollRunId: { $in: runIds },
      isDeleted: { $ne: true },
      paymentStatus: { $nin: ['VOID'] },
    })
      .sort({ year: -1, month: -1 })
      .limit(100)
      .lean()

    res.json({ success: true, data: slips })
  } catch (err) {
    console.error('[payroll-v2] my-payslips', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.get('/dashboard', async (req, res) => {
  try {
    if (!canReadPayroll(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }
    const TenantRun = await PayrollRun.getTenantModel(req.tenant)
    const TenantPayslip = await Payslip.getTenantModel(req.tenant)
    const TenantEmployee = await Employee.getTenantModel(req.tenant)
    const TenantAssignment = await EmployeeSalaryAssignment.getTenantModel(req.tenant)

    const [runCount, latestRun, payslipCount, employeeCount, assignmentCount] = await Promise.all([
      TenantRun.countDocuments({ isDeleted: { $ne: true } }),
      TenantRun.findOne({ isDeleted: { $ne: true } }).sort({ year: -1, month: -1 }).select('-lines').lean(),
      TenantPayslip.countDocuments({ isDeleted: { $ne: true } }),
      TenantEmployee.countDocuments({ isDeleted: { $ne: true }, status: { $ne: 'TERMINATED' } }),
      TenantAssignment.countDocuments({ isActive: true, isDeleted: { $ne: true } }),
    ])

    res.json({
      success: true,
      data: {
        runCount,
        latestRun,
        payslipCount,
        employeeCount,
        assignmentCount,
        totals: latestRun?.totals || null,
      },
    })
  } catch (err) {
    console.error('[payroll-v2] dashboard', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

async function buildDraftLines(tenant, employeeIds) {
  const TenantEmployee = await Employee.getTenantModel(tenant)
  const TenantAssignment = await EmployeeSalaryAssignment.getTenantModel(tenant)
  const employees = await TenantEmployee.find({
    _id: { $in: employeeIds },
    isDeleted: { $ne: true },
  }).lean()
  const assignments = await TenantAssignment.find({
    employeeId: { $in: employeeIds },
    isActive: true,
    isDeleted: { $ne: true },
  }).lean()
  const asgMap = new Map(assignments.map((a) => [String(a.employeeId), a]))

  return employees.map((emp) => {
    const asg = asgMap.get(String(emp._id))
    if (asg) {
      return {
        ...calculateLineFromAssignment(asg, emp),
        daysWorked: null,
        daysAbsent: null,
        overtimeHours: null,
        attendanceNotes: '',
      }
    }
    return {
      employeeId: emp._id,
      employeeCode: emp.employeeCode || '',
      employeeName: emp.name || '',
      department: emp.department || '',
      position: emp.position || '',
      salaryAssignmentId: null,
      salaryAssignmentVersion: null,
      earnings: [],
      deductions: [],
      employerContributions: [],
      gross: 0,
      totalDeductions: 0,
      net: 0,
      employerTotal: 0,
      daysWorked: null,
      daysAbsent: null,
      overtimeHours: null,
      attendanceNotes: '',
    }
  })
}

module.exports = router
