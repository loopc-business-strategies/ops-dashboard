const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const { createTenantModel } = require('../db/tenantModelProxy')

const factoryDepartmentCredentialSchema = new mongoose.Schema(
  {
    departmentKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 64,
    },
    label: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)

factoryDepartmentCredentialSchema.index({ departmentKey: 1 }, { unique: true })

factoryDepartmentCredentialSchema.methods.comparePassword = async function comparePassword(candidate) {
  return bcrypt.compare(String(candidate || ''), this.passwordHash)
}

factoryDepartmentCredentialSchema.statics.hashPassword = async function hashPassword(plain) {
  return bcrypt.hash(String(plain), 12)
}

module.exports = createTenantModel('FactoryDepartmentCredential', factoryDepartmentCredentialSchema)
