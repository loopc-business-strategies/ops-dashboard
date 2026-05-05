const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const eligibilitySchema = new mongoose.Schema(
  {
    refId:      { type: String, trim: true },
    entity:     { type: String, trim: true },
    permit:     { type: String, trim: true },
    status:     { type: String, trim: true, default: 'Eligible' },
    lastReview: { type: String, trim: true },
    owner:      { type: String, trim: true },
    notes:      { type: String, trim: true, default: '' },
    createdById: { type: mongoose.Schema.Types.ObjectId },
    createdByName: { type: String, trim: true },
  },
  { timestamps: true }
)

const approvalSchema = new mongoose.Schema(
  {
    refId:         { type: String, trim: true },
    authority:     { type: String, trim: true },
    filing:        { type: String, trim: true },
    dueDate:       { type: String, trim: true },
    submittedDate: { type: String, trim: true, default: '—' },
    status:        { type: String, trim: true, default: 'Pending' },
    refNo:         { type: String, trim: true, default: '—' },
    createdById:   { type: mongoose.Schema.Types.ObjectId },
    createdByName: { type: String, trim: true },
  },
  { timestamps: true }
)

const docSchema = new mongoose.Schema(
  {
    refId:    { type: String, trim: true },
    name:     { type: String, trim: true },
    category: { type: String, trim: true, default: 'Certificate' },
    owner:    { type: String, trim: true },
    version:  { type: String, trim: true, default: 'v1' },
    expiry:   { type: String, trim: true },
    status:   { type: String, trim: true, default: 'Active' },
    createdById: { type: mongoose.Schema.Types.ObjectId },
    createdByName: { type: String, trim: true },
  },
  { timestamps: true }
)

const updateSchema = new mongoose.Schema(
  {
    refId:       { type: String, trim: true },
    title:       { type: String, trim: true },
    source:      { type: String, trim: true },
    effective:   { type: String, trim: true },
    impact:      { type: String, trim: true, default: 'Medium' },
    actionOwner: { type: String, trim: true },
    status:      { type: String, trim: true, default: 'Planned' },
    createdById: { type: mongoose.Schema.Types.ObjectId },
    createdByName: { type: String, trim: true },
  },
  { timestamps: true }
)

const agreementSchema = new mongoose.Schema(
  {
    refId:   { type: String, trim: true },
    partner: { type: String, trim: true },
    type:    { type: String, trim: true },
    start:   { type: String, trim: true },
    end:     { type: String, trim: true },
    value:   { type: Number, default: 0 },
    status:  { type: String, trim: true, default: 'Active' },
    createdById: { type: mongoose.Schema.Types.ObjectId },
    createdByName: { type: String, trim: true },
  },
  { timestamps: true }
)

module.exports = {
  ComplianceEligibility: createTenantModel('ComplianceEligibility', eligibilitySchema),
  ComplianceApproval:    createTenantModel('ComplianceApproval',    approvalSchema),
  ComplianceDoc:         createTenantModel('ComplianceDoc',         docSchema),
  ComplianceUpdate:      createTenantModel('ComplianceUpdate',      updateSchema),
  ComplianceAgreement:   createTenantModel('ComplianceAgreement',   agreementSchema),
}
