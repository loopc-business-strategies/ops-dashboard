const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const MAINTENANCE_TYPES = ['PREVENTIVE', 'BREAKDOWN', 'CORRECTIVE', 'INSPECTION']
const MAINTENANCE_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']

const productionMaintenanceWorkOrderSchema = new mongoose.Schema(
  {
    woNumber: { type: String, required: true, trim: true, uppercase: true },
    machineId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionMachine', required: true },
    machineCode: { type: String, trim: true, default: '' },
    machineName: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    type: { type: String, enum: MAINTENANCE_TYPES, default: 'PREVENTIVE' },
    status: { type: String, enum: MAINTENANCE_STATUSES, default: 'SCHEDULED' },
    title: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    technicianName: { type: String, trim: true, default: '' },
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    parts: { type: String, trim: true, default: '' },
    cost: { type: Number, default: 0, min: 0 },
    downtimeMinutes: { type: Number, default: 0, min: 0 },
    scheduledAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    nextMaintenanceAt: { type: Date, default: null },
    notes: { type: String, trim: true, default: '' },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByName: { type: String, trim: true, default: '' },
    completedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    completedByName: { type: String, trim: true, default: '' },
    version: { type: Number, default: 0 },
  },
  { timestamps: true },
)

productionMaintenanceWorkOrderSchema.index({ woNumber: 1 }, { unique: true })
productionMaintenanceWorkOrderSchema.index({ machineId: 1, status: 1 })
productionMaintenanceWorkOrderSchema.index({ status: 1, scheduledAt: 1 })
productionMaintenanceWorkOrderSchema.index({ nextMaintenanceAt: 1 })

module.exports = createTenantModel('ProductionMaintenanceWorkOrder', productionMaintenanceWorkOrderSchema)
