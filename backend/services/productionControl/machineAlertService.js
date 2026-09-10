const ProductionMachine = require('../../models/ProductionMachine')
const ProductionAlert = require('../../models/ProductionAlert')
const { runInTransaction, withSession, writeOpts } = require('../../utils/mongoTransaction')
const { writeProductionAudit } = require('./audit')
const { nextAlertNumber } = require('./numbering')
const { AUDIT_ACTIONS, MACHINE_STATUSES } = require('./constants')
const { ProductionError } = require('./batchService')

function actor(req) {
  return { id: req.user?._id || null, name: req.user?.name || 'system' }
}

async function createMachine(req, input = {}) {
  const { machineCode, name, department = '', process = '', notes = '' } = input
  if (!machineCode || !name) throw new ProductionError('machineCode and name are required')

  const existing = await ProductionMachine.findOne({ machineCode: String(machineCode).trim() })
  if (existing) throw new ProductionError('Machine code already exists')

  const machine = await ProductionMachine.create({
    machineCode: String(machineCode).trim(),
    name: String(name).trim(),
    department,
    process,
    status: 'IDLE',
    notes,
    isActive: true,
  })

  await writeProductionAudit(req, {
    resource: 'ProductionMachine',
    resourceId: machine._id,
    action: AUDIT_ACTIONS.MACHINE_UPDATED,
    detail: `Machine ${machine.machineCode} created`,
    changes: { after: { machineCode: machine.machineCode, name: machine.name } },
  })

  return machine
}

async function updateMachineStatus(req, machineId, { status, expectedStatus } = {}) {
  if (!MACHINE_STATUSES.includes(status)) throw new ProductionError('Invalid machine status')

  return runInTransaction(async (session) => {
    const machine = await withSession(ProductionMachine.findById(machineId), session)
    if (!machine) throw new ProductionError('Machine not found', 404)
    if (expectedStatus && machine.status !== expectedStatus) {
      throw new ProductionError('Machine status changed. Refresh and retry.', 409)
    }
    const from = machine.status
    machine.status = status
    if (status === 'IDLE' || status === 'STOPPED' || status === 'OFFLINE') {
      machine.currentBatchId = null
      machine.currentBatchNumber = ''
      machine.currentOperatorId = null
      machine.currentOperatorName = ''
    }
    await machine.save(writeOpts(session))

    await writeProductionAudit(req, {
      resource: 'ProductionMachine',
      resourceId: machine._id,
      action: AUDIT_ACTIONS.MACHINE_UPDATED,
      detail: `Machine ${machine.machineCode} ${from} → ${status}`,
      changes: { fromState: from, toState: status },
      session,
    })

    if (status === 'FAULT') {
      const alertNumber = await nextAlertNumber(ProductionAlert, session)
      const a = actor(req)
      await ProductionAlert.create(
        [
          {
            alertNumber,
            category: 'machine',
            code: 'MACHINE_FAULT',
            title: 'Machine fault',
            message: `${machine.name} (${machine.machineCode}) reported FAULT`,
            severity: 'critical',
            machineId: machine._id,
            raisedById: a.id,
            raisedByName: a.name,
          },
        ],
        writeOpts(session),
      )
    }

    return machine
  })
}

async function raiseAlert(req, input = {}) {
  const {
    category = 'process',
    code = 'MANUAL',
    title,
    message = '',
    severity = 'warning',
    batchId = null,
    batchNumber = '',
    passId = null,
    machineId = null,
    metadata = {},
  } = input

  if (!title) throw new ProductionError('Alert title is required')
  const a = actor(req)

  return runInTransaction(async (session) => {
    const alertNumber = await nextAlertNumber(ProductionAlert, session)
    const [alert] = await ProductionAlert.create(
      [
        {
          alertNumber,
          category,
          code,
          title,
          message,
          severity,
          batchId,
          batchNumber,
          passId,
          machineId,
          metadata,
          raisedById: a.id,
          raisedByName: a.name,
        },
      ],
      writeOpts(session),
    )

    await writeProductionAudit(req, {
      resource: 'ProductionAlert',
      resourceId: alert._id,
      action: AUDIT_ACTIONS.ALERT_RAISED,
      detail: title,
      changes: { category, code, severity },
      session,
    })

    return alert
  })
}

async function resolveAlert(req, alertId) {
  const a = actor(req)
  return runInTransaction(async (session) => {
    const alert = await withSession(ProductionAlert.findById(alertId), session)
    if (!alert) throw new ProductionError('Alert not found', 404)
    if (alert.status === 'RESOLVED') return alert
    alert.status = 'RESOLVED'
    alert.resolvedAt = new Date()
    alert.resolvedById = a.id
    alert.resolvedByName = a.name
    await alert.save(writeOpts(session))

    await writeProductionAudit(req, {
      resource: 'ProductionAlert',
      resourceId: alert._id,
      action: AUDIT_ACTIONS.ALERT_RESOLVED,
      detail: `Alert ${alert.alertNumber} resolved`,
      changes: { status: 'RESOLVED' },
      session,
    })
    return alert
  })
}

module.exports = {
  createMachine,
  updateMachineStatus,
  raiseAlert,
  resolveAlert,
}
