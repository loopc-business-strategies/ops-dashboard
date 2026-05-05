const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const schema = new mongoose.Schema(
  {
    invoiceNo:   { type: String, trim: true },
    client:      { type: String, trim: true },
    invoiceType: { type: String, trim: true, default: 'Sales' }, // Sales | Purchase
    amount:      { type: Number, default: 0 },
    issueDate:   { type: String, trim: true },
    dueDate:     { type: String, trim: true },
    status:      { type: String, trim: true, default: 'Draft' },
    daysOverdue: { type: Number, default: 0 },
    createdById: { type: mongoose.Schema.Types.ObjectId },
    createdByName: { type: String, trim: true },
  },
  { timestamps: true }
)

module.exports = createTenantModel('FinanceInvoice', schema)
