const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const OperationsLegalDocumentSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true, trim: true, maxlength: 500 },
    storedFileName: { type: String, required: true, maxlength: 500 },
    mimeType: { type: String, required: true, maxlength: 200 },
    size: { type: Number, required: true, min: 0 },
    uploadedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedByName: { type: String, trim: true, maxlength: 200 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
)

module.exports = createTenantModel('OperationsLegalDocument', OperationsLegalDocumentSchema)
