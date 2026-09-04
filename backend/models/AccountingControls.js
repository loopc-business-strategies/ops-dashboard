const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

/**
 * Singleton-style accounting control flags per tenant DB.
 * Missing document ⇒ voucher24HourLockEnabled defaults to true when feature is available.
 */
const accountingControlsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true, index: true },
    voucher24HourLockEnabled: { type: Boolean, default: true },
  },
  { timestamps: true },
)

module.exports = createTenantModel('AccountingControls', accountingControlsSchema)
