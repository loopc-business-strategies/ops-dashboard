const { Joi } = require('../../middleware/validate')
const { ACCOUNT_TYPES } = require('../../constants/accountTypes')



// ─── Joi Schemas ────────────────────────────────────────────────────────────
const ACC_TYPES = ACCOUNT_TYPES
const TX_TYPES  = ['expense', 'sale', 'purchase', 'receipt', 'payment', 'payroll']

const idParam = Joi.object({ id: Joi.string().hex().length(24).required() })

const accountCreateSchema = Joi.object({
  accountName:     Joi.string().trim().min(1).max(200).required(),
  accountCode:     Joi.string().trim().min(1).max(20).required(),
  accountType:     Joi.string().valid(...ACC_TYPES).required(),
  parentAccountId: Joi.string().hex().length(24).allow('', null).optional(),
  currency:        Joi.string().trim().allow('').max(10).optional(),
  description:     Joi.string().trim().allow('').max(500).optional(),
  address:         Joi.string().trim().allow('').max(300).optional(),
})

const accountPatchSchema = Joi.object({
  accountName:     Joi.string().trim().min(1).max(200).optional(),
  accountCode:     Joi.string().trim().min(1).max(20).optional(),
  accountType:     Joi.string().valid(...ACC_TYPES).optional(),
  parentAccountId: Joi.string().hex().length(24).allow('', null).optional(),
  currency:        Joi.string().trim().allow('').max(10).optional(),
  description:     Joi.string().trim().allow('').max(500).optional(),
  address:         Joi.string().trim().allow('').max(300).optional(),
  isActive:        Joi.boolean().optional(),
}).min(1)

const mappingCreateSchema = Joi.object({
  mappingType:     Joi.string().trim().min(1).max(100).required(),
  debitAccountId:  Joi.string().hex().length(24).required(),
  creditAccountId: Joi.string().hex().length(24).required(),
  description:     Joi.string().trim().allow('').max(300).optional(),
  department:      Joi.string().trim().allow('').max(80).optional(),
})

const mappingPatchSchema = Joi.object({
  mappingType:     Joi.string().trim().min(1).max(100).optional(),
  debitAccountId:  Joi.string().hex().length(24).optional(),
  creditAccountId: Joi.string().hex().length(24).optional(),
  description:     Joi.string().trim().allow('').max(300).optional(),
  department:      Joi.string().trim().allow('').max(80).optional(),
  isActive:        Joi.boolean().optional(),
}).min(1)

const currencyCreateSchema = Joi.object({
  code:         Joi.string().trim().min(2).max(10).required(),
  name:         Joi.string().trim().min(1).max(100).required(),
  symbol:       Joi.string().trim().allow('').max(20).optional(),
  exchangeRate: Joi.number().positive().required(),
  isActive:     Joi.boolean().optional(),
  baseCurrency: Joi.boolean().optional(),
})

const currencyPatchSchema = Joi.object({
  code:         Joi.string().trim().min(2).max(10).optional(),
  name:         Joi.string().trim().min(1).max(100).optional(),
  symbol:       Joi.string().trim().allow('').max(20).optional(),
  exchangeRate: Joi.number().positive().optional(),
  isActive:     Joi.boolean().optional(),
  baseCurrency: Joi.boolean().optional(),
}).min(1)

const customerCreateSchema = Joi.object({
  name:             Joi.string().trim().min(1).max(200).required(),
  phone:            Joi.string().trim().allow('').max(30).optional(),
  email:            Joi.string().email({ tlds: { allow: false } }).allow('').optional(),
  address:          Joi.string().trim().allow('').max(300).optional(),
  gstVat:           Joi.string().trim().allow('').max(60).optional(),
  openingBalance:   Joi.number().optional(),
  creditLimit:      Joi.number().min(0).optional(),
  paymentTermsDays: Joi.number().integer().min(0).optional(),
  currency:         Joi.string().trim().allow('').max(10).optional(),
  notes:            Joi.string().trim().allow('').max(2000).optional(),
})

const customerPatchSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  phone: Joi.string().trim().allow('').max(30).optional(),
  email: Joi.string().email({ tlds: { allow: false } }).allow('').optional(),
  address: Joi.string().trim().allow('').max(300).optional(),
  gstVat: Joi.string().trim().allow('').max(60).optional(),
  creditLimit: Joi.number().min(0).optional(),
  paymentTermsDays: Joi.number().integer().min(0).optional(),
  currency: Joi.string().trim().allow('').max(10).optional(),
  notes: Joi.string().trim().allow('').max(2000).optional(),
  isActive: Joi.boolean().optional(),
  ledgerAccountId: Joi.string().hex().length(24).allow('', null).optional(),
}).min(1)

const vendorCreateSchema = Joi.object({
  vendorCode:         Joi.string().trim().allow('').max(30).optional(),
  name:               Joi.string().trim().min(1).max(200).required(),
  contactPerson:      Joi.string().trim().allow('').max(120).optional(),
  phone:              Joi.string().trim().allow('').max(30).optional(),
  email:              Joi.string().email({ tlds: { allow: false } }).allow('').optional(),
  address:            Joi.string().trim().allow('').max(300).optional(),
  city:               Joi.string().trim().allow('').max(80).optional(),
  country:            Joi.string().trim().allow('').max(80).optional(),
  postalCode:         Joi.string().trim().allow('').max(20).optional(),
  gstVat:             Joi.string().trim().allow('').max(60).optional(),
  taxRegistrationNo:  Joi.string().trim().allow('').max(60).optional(),
  openingBalance:     Joi.number().optional(),
  paymentTermsDays:   Joi.number().integer().min(0).optional(),
  creditLimit:        Joi.number().min(0).optional(),
  category:           Joi.string().trim().allow('').max(80).optional(),
  rating:             Joi.number().integer().min(1).max(5).optional(),
  riskLevel:          Joi.string().valid('low', 'medium', 'high', 'Low', 'Medium', 'High').optional(),
  status:             Joi.string().trim().allow('').max(30).optional(),
  notes:              Joi.string().trim().allow('').max(2000).optional(),
  tags:               Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
  preferredCurrency:  Joi.string().trim().allow('').max(10).optional(),
  bankName:           Joi.string().trim().allow('').max(120).optional(),
  bankAccountNumber:  Joi.string().trim().allow('').max(60).optional(),
  iban:               Joi.string().trim().allow('').max(34).optional(),
  swiftCode:          Joi.string().trim().allow('').max(20).optional(),
  currency:           Joi.string().trim().allow('').max(10).optional(),
})

const vendorPatchSchema = Joi.object({
  vendorCode: Joi.string().trim().allow('').max(30).optional(),
  name: Joi.string().trim().min(1).max(200).optional(),
  contactPerson: Joi.string().trim().allow('').max(120).optional(),
  phone: Joi.string().trim().allow('').max(30).optional(),
  email: Joi.string().email({ tlds: { allow: false } }).allow('').optional(),
  address: Joi.string().trim().allow('').max(300).optional(),
  city: Joi.string().trim().allow('').max(80).optional(),
  country: Joi.string().trim().allow('').max(80).optional(),
  postalCode: Joi.string().trim().allow('').max(20).optional(),
  gstVat: Joi.string().trim().allow('').max(60).optional(),
  taxRegistrationNo: Joi.string().trim().allow('').max(60).optional(),
  paymentTermsDays: Joi.number().integer().min(0).optional(),
  creditLimit: Joi.number().min(0).optional(),
  category: Joi.string().trim().allow('').max(80).optional(),
  rating: Joi.number().integer().min(1).max(5).optional(),
  riskLevel: Joi.string().valid('low', 'medium', 'high', 'Low', 'Medium', 'High').optional(),
  status: Joi.string().trim().allow('').max(30).optional(),
  notes: Joi.string().trim().allow('').max(2000).optional(),
  tags: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim().max(50)).max(20),
    Joi.string().allow('').max(500)
  ).optional(),
  preferredCurrency: Joi.string().trim().allow('').max(10).optional(),
  bankName: Joi.string().trim().allow('').max(120).optional(),
  bankAccountNumber: Joi.string().trim().allow('').max(60).optional(),
  iban: Joi.string().trim().allow('').max(34).optional(),
  swiftCode: Joi.string().trim().allow('').max(20).optional(),
  currency: Joi.string().trim().allow('').max(10).optional(),
  isActive: Joi.boolean().optional(),
}).min(1)

const transactionPatchSchema = Joi.object({
  type: Joi.string().valid(...TX_TYPES).optional(),
  amount: Joi.number().optional(),
  date: Joi.string().allow('', null).optional(),
  description: Joi.string().trim().allow('').max(1000).optional(),
  currency: Joi.string().trim().allow('').max(10).optional(),
  exchangeRate: Joi.number().positive().optional(),
  customerId: Joi.string().hex().length(24).allow('', null).optional(),
  vendorId: Joi.string().hex().length(24).allow('', null).optional(),
  inventoryItemId: Joi.string().hex().length(24).allow('', null).optional(),
  mappingId: Joi.string().hex().length(24).allow('', null).optional(),
  debitAccountId: Joi.string().hex().length(24).allow('', null).optional(),
  creditAccountId: Joi.string().hex().length(24).allow('', null).optional(),
  voucherMeta: Joi.object().optional(),
  metalFixStatus: Joi.string().trim().allow('').max(30).optional(),
}).min(1)

const transactionCreateSchema = Joi.object({
  type:              Joi.string().valid(...TX_TYPES).required(),
  amount:            Joi.number().required(),
  date:              Joi.string().allow('', null).optional(),
  description:       Joi.string().trim().allow('').max(1000).optional(),
  currency:          Joi.string().trim().allow('').max(10).optional(),
  exchangeRate:      Joi.number().positive().optional(),
  customerId:        Joi.string().hex().length(24).allow('', null).optional(),
  vendorId:          Joi.string().hex().length(24).allow('', null).optional(),
  inventoryItemId:   Joi.string().hex().length(24).allow('', null).optional(),
  mappingId:         Joi.string().hex().length(24).allow('', null).optional(),
  debitAccountId:    Joi.string().hex().length(24).allow('', null).optional(),
  creditAccountId:   Joi.string().hex().length(24).allow('', null).optional(),
  voucherMeta:       Joi.object().optional(),
  metalFixStatus:    Joi.string().trim().allow('').max(30).optional(),
})

const ledgerEntrySchema = Joi.object({
  date:          Joi.string().allow('', null).optional(),
  description:   Joi.string().trim().allow('').max(1000).optional(),
  debitAmount:   Joi.number().min(0).optional(),
  creditAmount:  Joi.number().min(0).optional(),
  currency:      Joi.string().trim().allow('').max(10).optional(),
  exchangeRate:  Joi.number().positive().optional(),
  referenceType: Joi.string().trim().allow('').max(80).optional(),
  referenceId:   Joi.string().hex().length(24).allow('', null).optional(),
  accountId:     Joi.string().hex().length(24).allow('', null).optional(),
  notes:         Joi.string().trim().allow('').max(1000).optional(),
}).unknown(true)

const hardDeleteSchema = Joi.object({
  code: Joi.string().trim().min(1).max(20).required(),
})
// ────────────────────────────────────────────────────────────────────────────

// ==========================================
// ROLE-BASED ACCESS CONTROL
// ==========================================

module.exports = {
  idParam,
  accountCreateSchema,
  accountPatchSchema,
  mappingCreateSchema,
  mappingPatchSchema,
  currencyCreateSchema,
  currencyPatchSchema,
  customerCreateSchema,
  customerPatchSchema,
  vendorCreateSchema,
  vendorPatchSchema,
  transactionPatchSchema,
  transactionCreateSchema,
  ledgerEntrySchema,
  hardDeleteSchema,
}
