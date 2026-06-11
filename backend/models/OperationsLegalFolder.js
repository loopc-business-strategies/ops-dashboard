const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const OperationsLegalFolderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdByName: { type: String, trim: true, maxlength: 200 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
)

OperationsLegalFolderSchema.index({ name: 1 }, { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } })

module.exports = createTenantModel('OperationsLegalFolder', OperationsLegalFolderSchema)
