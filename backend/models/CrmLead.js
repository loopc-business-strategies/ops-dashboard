const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const stageHistSchema = new mongoose.Schema({ stage: String, date: Date, note: String, by: String }, { _id: false })
const nextActSchema   = new mongoose.Schema({ description: String, dueDate: Date, assignedTo: String, isDone: { type: Boolean, default: false } }, { _id: false })

const LEAD_STAGES = ['Prospect','Contacted','Qualified','Proposal','Negotiating','Closed Won','Closed Lost']

const crmLeadSchema = new mongoose.Schema({
  name:             { type: String, required: true },
  contactId:        { type: mongoose.Schema.Types.ObjectId, ref: 'CrmContact' },
  contactName:      String,
  companyName:      String,
  source:           String,
  dealType:         String,
  stage:            { type: String, enum: LEAD_STAGES, default: 'Prospect' },
  assignedRep:      String,
  estValueUSD:      { type: Number, default: 0 },
  volumeKg:         { type: Number, default: 0 },
  probability:      { type: Number, default: 0, min: 0, max: 100 },
  expectedCloseDate: Date,
  score: {
    companyFit:  { type: Number, default: 0, min: 0, max: 25 },
    budgetMatch: { type: Number, default: 0, min: 0, max: 25 },
    timeline:    { type: Number, default: 0, min: 0, max: 25 },
    engagement:  { type: Number, default: 0, min: 0, max: 25 },
  },
  temperature:  { type: String, enum: ['Cold','Warm','Hot','Very Hot'], default: 'Cold' },
  priority:     { type: String, enum: ['High','Medium','Low'], default: 'Medium' },
  nextAction:   nextActSchema,
  stageHistory: [stageHistSchema],
  lostReason:   String,
  closedDate:   Date,
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDeleted:    { type: Boolean, default: false },
}, { timestamps: true })

crmLeadSchema.index({ stage: 1 })
crmLeadSchema.index({ assignedRep: 1 })

module.exports = createTenantModel('CrmLead', crmLeadSchema)
