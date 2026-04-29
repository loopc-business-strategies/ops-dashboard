const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const crmCompanySchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  type:       { type: String, enum: ['Customer','Supplier','Partner','Prospect'], default: 'Prospect' },
  country:    String,
  city:       String,
  website:    String,
  industry:   String,
  status:     { type: String, enum: ['Active','Negotiating','Meeting Scheduled','Contacted','Qualified','Prospect','Inactive'], default: 'Prospect' },
  riskRating: { type: String, enum: ['Low','Medium','High'], default: 'Medium' },
  notes:      String,
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDeleted:  { type: Boolean, default: false },
}, { timestamps: true })

module.exports = createTenantModel('CrmCompany', crmCompanySchema)
