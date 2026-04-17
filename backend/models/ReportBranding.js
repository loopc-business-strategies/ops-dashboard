const mongoose = require('mongoose')

const reportBrandingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'default' },
    entityName: { type: String, trim: true, default: 'Main Entity' },
    branchName: { type: String, trim: true, default: '' },
    isDefault: { type: Boolean, default: false },
    companyName: { type: String, trim: true, default: 'Ops Dashboard ERP' },
    legalName: { type: String, trim: true, default: '' },
    reportSubtitle: { type: String, trim: true, default: 'Finance & Accounts Division' },
    logoUrl: { type: String, default: '' },
    logoWidth: { type: Number, default: 180 },
    logoHeight: { type: Number, default: 56 },
    logoFit: { type: String, enum: ['contain', 'cover', 'fill'], default: 'contain' },
    reportFooter: { type: String, trim: true, default: 'Confidential Internal Statement' },
    preparedByTitle: { type: String, trim: true, default: 'Prepared By' },
    preparedByName: { type: String, trim: true, default: 'Finance Officer' },
    reviewedByTitle: { type: String, trim: true, default: 'Reviewed By' },
    reviewedByName: { type: String, trim: true, default: 'Accounts Manager' },
    approvedByTitle: { type: String, trim: true, default: 'Authorized Signatory' },
    approvedByName: { type: String, trim: true, default: 'Finance Controller' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
)

module.exports = mongoose.model('ReportBranding', reportBrandingSchema)
