const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const signatoryBlockSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    name: { type: String, trim: true, default: '' },
    visible: { type: Boolean, default: true },
  },
  { _id: false }
)

const voucherTableHeadersSchema = new mongoose.Schema(
  {
    no: { type: String, trim: true, default: 'No.' },
    description: { type: String, trim: true, default: 'Account Description' },
    type: { type: String, trim: true, default: 'Type' },
    amountFc: { type: String, trim: true, default: 'Amount FC' },
    amountLc: { type: String, trim: true, default: 'Amount' },
  },
  { _id: false }
)

const voucherPrintSchema = new mongoose.Schema(
  {
    logoOffsetX: { type: Number, default: 0 },
    logoOffsetY: { type: Number, default: 0 },
    logoTransparent: { type: Boolean, default: true },
    titleAccentColor: { type: String, trim: true, default: '#7F1D1D' },
    headerDividerColor: { type: String, trim: true, default: '#111827' },
    tableHeaders: { type: voucherTableHeadersSchema, default: () => ({}) },
    signatories: { type: [signatoryBlockSchema], default: undefined },
    confirmedForLabel: { type: String, trim: true, default: 'Confirmed for & on behalf of' },
    footerNote: { type: String, trim: true, default: '' },
  },
  { _id: false }
)

const statementPrintSchema = new mongoose.Schema(
  {
    logoOffsetX: { type: Number, default: 0 },
    logoOffsetY: { type: Number, default: 0 },
    logoTransparent: { type: Boolean, default: true },
    title: { type: String, trim: true, default: 'Statement of Account' },
    subtitle: { type: String, trim: true, default: '' },
    footerNote: { type: String, trim: true, default: '' },
    signatories: { type: [signatoryBlockSchema], default: undefined },
    showPrintNote: { type: Boolean, default: true },
  },
  { _id: false }
)

const reportBrandingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'default' },
    entityName: { type: String, trim: true, default: 'Main Entity' },
    branchName: { type: String, trim: true, default: '' },
    isDefault: { type: Boolean, default: false },
    companyName: { type: String, trim: true, default: 'Ops Dashboard ERP' },
    legalName: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    trn: { type: String, trim: true, default: '' },
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
    voucherPrint: { type: voucherPrintSchema, default: () => ({}) },
    statementPrint: { type: statementPrintSchema, default: () => ({}) },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
)

module.exports = createTenantModel('ReportBranding', reportBrandingSchema)
