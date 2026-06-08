// FILE: backend/models/TaskTemplate.js
// Saved “create task” presets for Operations (and other modules) per tenant.

const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const checklistItemSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, maxlength: 200 },
    done: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { _id: false }
)

const defaultsSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    linkedRecord: { type: String, trim: true, default: '' },
    module: { type: String, trim: true, default: '' },
    status: { type: String, trim: true, default: 'todo' },
    priority: { type: String, trim: true, default: 'medium' },
    tags: { type: [String], default: [] },
    checklist: { type: [checklistItemSchema], default: [] },
  },
  { _id: false }
)

const taskTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    department: { type: String, trim: true, default: '' },
    module: { type: String, trim: true, default: '' },
    defaults: { type: defaultsSchema, default: () => ({}) },
    createdBy: { type: String, trim: true, default: '' },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
)

taskTemplateSchema.index({ department: 1, name: 1 })

module.exports = createTenantModel('TaskTemplate', taskTemplateSchema)
