const mongoose = require('mongoose')

const FinanceRecordSchema = new mongoose.Schema(
  {
    recordType: {
      type: String,
      enum: ['expense', 'revenue', 'budget'],
      required: true,
    },
    category: {
      type: String,
      enum: ['raw_materials', 'salaries', 'utilities', 'sales_revenue', 'supplier_payments', 'other'],
      default: 'other',
    },
    department: String,
    amount: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    description: String,
    relatedDocId: mongoose.Schema.Types.ObjectId,
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    approvedBy: String,
    approvedAt: Date,
    createdById: mongoose.Schema.Types.ObjectId,
    createdByName: String,
  },
  { timestamps: true }
)

module.exports = mongoose.model('FinanceRecord', FinanceRecordSchema)
