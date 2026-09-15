const ProductionMaintenanceWorkOrder = require('../../models/ProductionMaintenanceWorkOrder')
const ProductionMachine = require('../../models/ProductionMachine')
const ProductionAlert = require('../../models/ProductionAlert')
const { runInTransaction, withSession, writeOpts } = require('../../utils/mongoTransaction')
const { writeProductionAudit } = require('./audit')
const { nextAlertNumber } = require('./numbering')
const { AUDIT_ACTIONS } = require('./constants')
const { ProductionError } = require('./errors')

function actor(req) {
  return {
    id: req.user?._id || null,
    name: req.user?.name || 'system',
  }
}

async function nextMaintenanceWoNumber(session) {
  const year = new Date().getFullYear()
  const prefix = `PM-${year}-`
  const re = new RegExp(`^${prefix}\\d+$`)
  const last = await withSession(
    ProductionMaintenanceWorkOrder.findOne({ woNumber: re }).sort({ woNumber: -1 }).select('woNumber').lean(),
    session,
  )
  let seq = 1
  if (last?.woNumber) {
    const n = Number(String(last.woNumber).split('-').pop())
    if (Number.isFinite(n)) seq = n + 1
  }
  return `${prefix}${String(seq).padStart(5, '0')}`
}

async function listMaintenance(query = {}) {
  const filter = {}
  if (query.status) filter.status = String(query.status).toUpperCase()
  if (query.machineId) filter.machineId = query.machineId
  if (query.type) filter.type = String(query.type).toUpperCase()
  return ProductionMaintenanceWorkOrder.find(filter).sort({ updatedAt: -1 }).limit(200).lean()
}

async function createMaintenance(req, input = {}) {
  const a = actor(req)
  const machineId = input.machineId
  if (!machineId) throw new ProductionError('machineId is required')

  return runInTransaction(async (session) => {
    const machine = await withSession(ProductionMachine.findById(machineId), session)
    if (!machine) throw new ProductionError('Machine not found', 404)

    const woNumber = await nextMaintenanceWoNumber(session)
    const [wo] = await ProductionMaintenanceWorkOrder.create(
      [
        {
          woNumber,
          machineId: machine._id,
          machineCode: machine.machineCode || '',
          machineName: machine.name || '',
          department: machine.department || '',
          type: String(input.type || 'PREVENTIVE').toUpperCase(),
          status: 'SCHEDULED',
          title: input.title || `${input.type || 'PREVENTIVE'} — ${machine.name}`,
          description: input.description || '',
          technicianName: input.technicianName || '',
          technicianId: input.technicianId || null,
          parts: input.parts || '',
          cost: Number(input.cost) || 0,
          downtimeMinutes: Number(input.downtimeMinutes) || 0,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : new Date(),
          nextMaintenanceAt: input.nextMaintenanceAt ? new Date(input.nextMaintenanceAt) : null,
          notes: input.notes || '',
          createdById: a.id,
          createdByName: a.name,
          version: 0,
        },
      ],
      writeOpts(session),
    )

    if (input.setMachineStatus) {
      machine.status = String(input.setMachineStatus).toUpperCase()
      await machine.save(writeOpts(session))
    }
    if (input.nextMaintenanceAt) {
      machine.nextMaintenance = new Date(input.nextMaintenanceAt)
      await machine.save(writeOpts(session))
    }

    await writeProductionAudit(req, {
      resource: 'ProductionMaintenanceWorkOrder',
      resourceId: wo._id,
      action: AUDIT_ACTIONS.MAINTENANCE_WO_CREATED,
      detail: `Maintenance WO ${woNumber} created for ${machine.machineCode}`,
      changes: { woNumber, machineId: String(machine._id), type: wo.type },
      session,
    })

    return wo
  })
}

async function updateMaintenance(req, woId, updates = {}) {
  const a = actor(req)
  return runInTransaction(async (session) => {
    const wo = await withSession(ProductionMaintenanceWorkOrder.findById(woId), session)
    if (!wo) throw new ProductionError('Maintenance work order not found', 404)
    if (wo.status === 'COMPLETED' || wo.status === 'CANCELLED') {
      throw new ProductionError(`Cannot update ${wo.status} work order`)
    }

    const before = {
      status: wo.status,
      technicianName: wo.technicianName,
      parts: wo.parts,
      cost: wo.cost,
      downtimeMinutes: wo.downtimeMinutes,
      notes: wo.notes,
    }

    const allowed = [
      'title', 'description', 'technicianName', 'technicianId', 'parts', 'cost',
      'downtimeMinutes', 'scheduledAt', 'startedAt', 'nextMaintenanceAt', 'notes', 'type', 'status',
    ]
    for (const key of allowed) {
      if (updates[key] === undefined) continue
      if (['scheduledAt', 'startedAt', 'nextMaintenanceAt'].includes(key)) {
        wo[key] = updates[key] ? new Date(updates[key]) : null
      } else if (['cost', 'downtimeMinutes'].includes(key)) {
        wo[key] = Number(updates[key]) || 0
      } else if (key === 'status' || key === 'type') {
        wo[key] = String(updates[key] || '').toUpperCase()
      } else {
        wo[key] = updates[key]
      }
    }

    if (wo.status === 'IN_PROGRESS' && !wo.startedAt) wo.startedAt = new Date()
    wo.version = (wo.version || 0) + 1
    await wo.save(writeOpts(session))

    await writeProductionAudit(req, {
      resource: 'ProductionMaintenanceWorkOrder',
      resourceId: wo._id,
      action: AUDIT_ACTIONS.MAINTENANCE_WO_UPDATED,
      detail: `Maintenance WO ${wo.woNumber} updated by ${a.name}`,
      changes: { before, after: {
        status: wo.status,
        technicianName: wo.technicianName,
        parts: wo.parts,
        cost: wo.cost,
        downtimeMinutes: wo.downtimeMinutes,
        notes: wo.notes,
      } },
      session,
    })

    return wo
  })
}

async function completeMaintenance(req, woId, input = {}) {
  const a = actor(req)
  return runInTransaction(async (session) => {
    const wo = await withSession(ProductionMaintenanceWorkOrder.findById(woId), session)
    if (!wo) throw new ProductionError('Maintenance work order not found', 404)
    if (wo.status === 'COMPLETED') return wo
    if (wo.status === 'CANCELLED') throw new ProductionError('Cannot complete cancelled work order')

    wo.status = 'COMPLETED'
    wo.completedAt = new Date()
    wo.completedById = a.id
    wo.completedByName = a.name
    if (input.cost != null) wo.cost = Number(input.cost) || 0
    if (input.downtimeMinutes != null) wo.downtimeMinutes = Number(input.downtimeMinutes) || 0
    if (input.parts != null) wo.parts = input.parts
    if (input.notes != null) wo.notes = input.notes
    if (input.nextMaintenanceAt) wo.nextMaintenanceAt = new Date(input.nextMaintenanceAt)
    wo.version = (wo.version || 0) + 1
    await wo.save(writeOpts(session))

    const machine = await withSession(ProductionMachine.findById(wo.machineId), session)
    if (machine) {
      machine.lastMaintenance = wo.completedAt
      if (wo.nextMaintenanceAt) machine.nextMaintenance = wo.nextMaintenanceAt
      if (machine.status === 'MAINTENANCE' || machine.status === 'FAULT') {
        machine.status = input.machineStatus || 'IDLE'
      }
      if (input.notes) machine.notes = input.notes
      await machine.save(writeOpts(session))
    }

    await writeProductionAudit(req, {
      resource: 'ProductionMaintenanceWorkOrder',
      resourceId: wo._id,
      action: AUDIT_ACTIONS.MAINTENANCE_WO_COMPLETED,
      detail: `Maintenance WO ${wo.woNumber} completed`,
      changes: {
        machineId: String(wo.machineId),
        nextMaintenanceAt: wo.nextMaintenanceAt,
        downtimeMinutes: wo.downtimeMinutes,
        cost: wo.cost,
      },
      session,
    })

    return wo
  })
}

/** Raise alerts for overdue preventive maintenance (nextMaintenance / WO due). */
async function evaluateOverdueMaintenance(req) {
  const now = new Date()
  const machines = await ProductionMachine.find({
    isActive: { $ne: false },
    nextMaintenance: { $ne: null, $lt: now },
  }).limit(100).lean()

  const openWos = await ProductionMaintenanceWorkOrder.find({
    status: { $in: ['SCHEDULED', 'IN_PROGRESS'] },
    scheduledAt: { $ne: null, $lt: now },
  }).limit(100).lean()

  const raised = []
  for (const m of machines) {
    const existing = await ProductionAlert.findOne({
      status: { $in: ['OPEN', 'ACKNOWLEDGED'] },
      machineId: m._id,
      code: 'MAINTENANCE_OVERDUE',
    }).lean()
    if (existing) continue
    const alertNumber = await nextAlertNumber(ProductionAlert)
    const [alert] = await ProductionAlert.create([{
      alertNumber,
      category: 'machine',
      code: 'MAINTENANCE_OVERDUE',
      title: 'Maintenance overdue',
      message: `Machine ${m.machineCode || m.name} overdue for maintenance`,
      severity: 'warning',
      machineId: m._id,
      status: 'OPEN',
      metadata: { machineId: String(m._id), machineCode: m.machineCode },
    }])
    raised.push(alert)
  }

  for (const wo of openWos) {
    const existing = await ProductionAlert.findOne({
      status: { $in: ['OPEN', 'ACKNOWLEDGED'] },
      code: 'MAINTENANCE_WO_OVERDUE',
      'metadata.maintenanceWoId': String(wo._id),
    }).lean()
    if (existing) continue
    const alertNumber = await nextAlertNumber(ProductionAlert)
    const [alert] = await ProductionAlert.create([{
      alertNumber,
      category: 'machine',
      code: 'MAINTENANCE_WO_OVERDUE',
      title: 'Maintenance WO overdue',
      message: `Maintenance WO ${wo.woNumber} is overdue`,
      severity: 'warning',
      machineId: wo.machineId,
      status: 'OPEN',
      metadata: { maintenanceWoId: String(wo._id), machineId: String(wo.machineId) },
    }])
    raised.push(alert)
  }

  return raised
}

module.exports = {
  listMaintenance,
  createMaintenance,
  updateMaintenance,
  completeMaintenance,
  evaluateOverdueMaintenance,
  ProductionError,
}
