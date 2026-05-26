const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const DepartmentStateSchema = new mongoose.Schema(
  {
    module: {
      type: String,
      enum: ['finance', 'compliance', 'training', 'admin'],
      required: true,
      unique: true,
    },
    state: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    updatedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedByName: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
)

module.exports = createTenantModel('DepartmentState', DepartmentStateSchema)
