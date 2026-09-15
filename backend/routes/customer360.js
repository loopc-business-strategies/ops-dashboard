const express = require('express')
const Joi = require('joi')
const { protect } = require('../middleware/auth')
const { validateQuery } = require('../middleware/validate')
const Customer = require('../models/Customer')
const CrmContact = require('../models/CrmContact')
const CrmDeal = require('../models/CrmDeal')
const Transaction = require('../models/Transaction')
const { canViewCustomers, isSuperAdmin } = require('../services/erpAccounting/accessPolicy')
const { canViewCrm } = require('../services/permissions/moduleAccessPolicy')

const router = express.Router()

router.get(
  '/',
  protect,
  validateQuery(Joi.object({
    customerId: Joi.string().hex().length(24),
    contactId: Joi.string().hex().length(24),
    email: Joi.string().trim().email(),
  }).or('customerId', 'contactId', 'email')),
  async (req, res) => {
    try {
      if (!canViewCustomers(req.user) && !canViewCrm(req.user) && !isSuperAdmin(req.user)) {
        return res.status(403).json({ success: false, message: 'Forbidden' })
      }

      let customer = null
      let contact = null

      if (req.query.customerId) {
        customer = await Customer.findById(req.query.customerId).lean()
      }
      if (req.query.contactId) {
        contact = await CrmContact.findOne({ _id: req.query.contactId, isDeleted: { $ne: true } }).lean()
      }
      if (!customer && contact?.erpCustomerId) {
        customer = await Customer.findById(contact.erpCustomerId).lean()
      }
      if (!contact && customer) {
        contact = await CrmContact.findOne({
          isDeleted: { $ne: true },
          $or: [
            { erpCustomerId: customer._id },
            ...(customer.email ? [{ email: String(customer.email).toLowerCase() }] : []),
          ],
        }).lean()
      }
      if (!customer && !contact && req.query.email) {
        const email = String(req.query.email).toLowerCase()
        customer = await Customer.findOne({ email }).lean()
        contact = await CrmContact.findOne({ email, isDeleted: { $ne: true } }).lean()
      }

      if (!customer && !contact) {
        return res.status(404).json({ success: false, message: 'Customer not found' })
      }

      const email = (customer?.email || contact?.email || '').toLowerCase()
      const deals = contact
        ? await CrmDeal.find({
          isDeleted: { $ne: true },
          contactId: contact._id,
        }).sort({ updatedAt: -1 }).limit(20).lean().catch(() => [])
        : []

      const recentVouchers = customer
        ? await Transaction.find({
          customerId: customer._id,
          isDeleted: { $ne: true },
        }).sort({ date: -1 }).limit(20)
          .select('type status amount currency date description voucherMeta')
          .lean()
        : []

      res.json({
        success: true,
        profile: {
          erpCustomer: customer,
          crmContact: contact,
          link: {
            erpCustomerId: customer?._id || contact?.erpCustomerId || null,
            crmContactId: contact?._id || null,
            linkedBy: contact?.erpCustomerId && customer ? 'erpCustomerId' : (email ? 'email' : null),
          },
        },
        deals,
        recentVouchers,
        outstandingHint: 'Use ERP customer-outstanding / customer-margin reports for balances',
      })
    } catch (err) {
      console.error('Customer 360 error:', err)
      res.status(500).json({ success: false, message: 'Failed to load customer 360' })
    }
  },
)

module.exports = router
