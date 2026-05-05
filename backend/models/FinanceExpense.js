const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const schema = new mongoose.Schema(
  {
    expenseNo:  { type: String, trim: true },
    date:       { type: String, trim: true },
    dept:       { type: String, trim: true },
    cat:        { type: String, trim: true },
    amount:     { type: Number, default: 0 },
    submittedBy:{ type: String, trim: true },
    status:     { type: String, trim: true, default: 'Pending' },
    approvedBy: { type: String, trim: true, default: '—' },
    flagged:    { type: Boolean, default: false },
    description:{ type: String, trim: true, default: '' },
    createdById: { type: mongoose.Schema.Types.ObjectId },
    createdByName: { type: String, trim: true },
  },
  { timestamps: true }
)

module.exports = createTenantModel('FinanceExpense', schema)
