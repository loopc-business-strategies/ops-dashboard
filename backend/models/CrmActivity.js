const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const crmActivitySchema = new mongoose.Schema({
  type: { type: String, enum: ['Call','Email','Meeting','Task','Note','Demo'], required: true },
  contactId:     { type: mongoose.Schema.Types.ObjectId, ref: 'CrmContact' },
  contactName:   String,
  dealId:        { type: mongoose.Schema.Types.ObjectId, ref: 'CrmDeal' },
  dealName:      String,
  leadId:        { type: mongoose.Schema.Types.ObjectId, ref: 'CrmLead' },
  date:          { type: Date, default: Date.now },
  durationMin:   Number,
  subject:       { type: String, required: true },
  outcome:       { type: String, enum: ['Positive','Neutral','Negative','Follow-up needed'] },
  notes:         String,
  nextAction: {
    description: String,
    dueDate:     Date,
    assignedTo:  String,
    isDone:      { type: Boolean, default: false },
  },
  isPrivate:     { type: Boolean, default: false },
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByName: String,
  isDeleted:     { type: Boolean, default: false },
}, { timestamps: true })

crmActivitySchema.index({ contactId: 1, date: -1 })
crmActivitySchema.index({ 'nextAction.dueDate': 1, 'nextAction.isDone': 1 })

module.exports = createTenantModel('CrmActivity', crmActivitySchema)
