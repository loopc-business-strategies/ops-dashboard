const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')
const { ENQUIRY_STATUSES, ENQUIRY_TYPES } = require('../utils/websiteEnquiryConstants')

const statusHistorySchema = new mongoose.Schema({
  status: { type: String, enum: ENQUIRY_STATUSES },
  note:   String,
  by:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  byName: String,
  at:     { type: Date, default: Date.now },
}, { _id: false })

const websiteEnquirySchema = new mongoose.Schema({
  name:           { type: String, required: true, trim: true },
  company:        { type: String, trim: true, default: '' },
  email:          { type: String, required: true, trim: true, lowercase: true },
  phone:          { type: String, required: true, trim: true },
  enquiryType:    { type: String, required: true, enum: ENQUIRY_TYPES },
  requirement:    { type: String, required: true, trim: true },
  message:        { type: String, trim: true, default: '' },
  source:         { type: String, default: 'website' },
  status:         { type: String, enum: ENQUIRY_STATUSES, default: 'NEW' },
  assignedTo:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedToName: { type: String, default: '' },
  statusHistory:  [statusHistorySchema],
  isDeleted:      { type: Boolean, default: false },
}, { timestamps: true })

websiteEnquirySchema.index({ status: 1, createdAt: -1 })

module.exports = createTenantModel('WebsiteEnquiry', websiteEnquirySchema)
