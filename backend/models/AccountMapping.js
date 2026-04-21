const mongoose = require('mongoose')

const accountMappingSchema = new mongoose.Schema(
  {
    mappingType: { type: String, required: true, trim: true }, // "expense", "invoice", "purchase", "payment", "salary", etc.
    debitAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true },
    creditAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true },
    department: { type: String, default: '', trim: true },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

accountMappingSchema.index({ mappingType: 1 })
accountMappingSchema.index({ department: 1 })

module.exports = mongoose.model('AccountMapping', accountMappingSchema)
