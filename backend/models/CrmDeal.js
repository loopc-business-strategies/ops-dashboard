const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const stageHistSchema = new mongoose.Schema({ stage: String, date: Date, note: String, by: String }, { _id: false })
const nextActSchema   = new mongoose.Schema({ description: String, dueDate: Date, assignedTo: String, isDone: { type: Boolean, default: false } }, { _id: false })

const DEAL_STAGES = ['Prospect','Contacted','Qualified','Proposal','Negotiating','Agreement Signed','Active','Closed Won','Closed Lost']

const crmDealSchema = new mongoose.Schema({
  name:             { type: String, required: true },
  contactName:      String,
  contactId:        { type: mongoose.Schema.Types.ObjectId, ref: 'CrmContact' },
  companyName:      String,
  companyId:        { type: mongoose.Schema.Types.ObjectId, ref: 'CrmCompany' },
  leadId:           { type: mongoose.Schema.Types.ObjectId, ref: 'CrmLead' },
  stage:            { type: String, enum: DEAL_STAGES, default: 'Prospect' },
  assignedRep:      String,
  volumeKg:         { type: Number, default: 0 },
  valueUSD:         { type: Number, default: 0 },
  probability:      { type: Number, default: 0, min: 0, max: 100 },
  quotedPricePerKg: Number,
  paymentTerms:     String,
  expectedPaymentDate: Date,
  expectedCloseDate:   Date,
  stageHistory:     [stageHistSchema],
  nextAction:       nextActSchema,
  closedWon: {
    finalValue:       Number,
    closeDate:        Date,
    contractSigned:   Boolean,
    paymentConfirmed: Boolean,
  },
  closedLost: {
    reason:     String,
    competitor: String,
    notes:      String,
  },
  revenueRecognized: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true })

crmDealSchema.index({ stage: 1 })
crmDealSchema.index({ assignedRep: 1 })

module.exports = createTenantModel('CrmDeal', crmDealSchema)
