const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const noteSchema = new mongoose.Schema(
  { text: { type: String, required: true }, author: String, isPrivate: { type: Boolean, default: false } },
  { timestamps: true }
)

const kycDocSchema = new mongoose.Schema({
  name:         { type: String },
  status:       { type: String, enum: ['Pending','Verified','Expired'], default: 'Pending' },
  verifiedDate: { type: String },
  relativePath: { type: String },
  mimeType:     { type: String },
  size:         { type: Number },
  uploadedAt:   { type: Date, default: Date.now },
  uploadedByName: { type: String },
})

const crmContactSchema = new mongoose.Schema({
  firstName:      { type: String, required: true, trim: true },
  lastName:       { type: String, required: true, trim: true },
  email:          { type: String, trim: true, lowercase: true },
  phone:          String,
  whatsApp:       String,
  jobTitle:       String,
  companyName:    String,
  companyId:      { type: mongoose.Schema.Types.ObjectId, ref: 'CrmCompany' },
  contactType:    { type: String, enum: ['Customer','Supplier','Partner','Prospect'], default: 'Prospect' },
  country:        String,
  city:           String,
  website:        String,
  industry:       String,
  status:         { type: String, enum: ['Active','Negotiating','Meeting Scheduled','Contacted','Qualified','Prospect','Inactive'], default: 'Prospect' },
  assignedRep:    String,
  leadSource:     String,
  estDealValue:   { type: Number, default: 0 },
  volumeTargetKg: { type: Number, default: 0 },
  paymentTerms:   String,
  priority:       { type: String, enum: ['High','Medium','Low'], default: 'Medium' },
  tags:           [String],
  notes:          [noteSchema],
  kyc: {
    status:         { type: String, enum: ['Not Started','In Progress','Verified','Expired'], default: 'Not Started' },
    riskRating:     { type: String, enum: ['Low','Medium','High'], default: 'Medium' },
    nextReview:     String,
    amlClear:       Boolean,
    pepClear:       Boolean,
    sanctionsClear: Boolean,
    documents:      [kycDocSchema],
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true })

crmContactSchema.index({ email: 1 })
crmContactSchema.index({ contactType: 1, status: 1 })
crmContactSchema.index({ assignedRep: 1 })

module.exports = createTenantModel('CrmContact', crmContactSchema)
