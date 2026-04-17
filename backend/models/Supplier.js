const mongoose = require('mongoose')

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
    },
    country: {
      type: String,
      trim: true,
      default: '',
    },
    contact: {
      type: String,
      trim: true,
      default: '',
    },
    productType: {
      type: String,
      trim: true,
      default: '',
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },
    paymentTerms: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Supplier', supplierSchema)
