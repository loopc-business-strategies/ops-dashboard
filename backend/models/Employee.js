// ==========================================
// FILE: backend/models/Employee.js
// WHAT THIS DOES:
//   Defines the shape of every employee record stored in MongoDB.
// ==========================================

const mongoose = require('mongoose')

const employeeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },

    idNumber: {
      type: String,
      required: [true, 'ID number is required'],
      trim: true,
    },

    employeeCode: {
      type: String,
      required: [true, 'Employee code is required'],
      trim: true,
      unique: true,
    },

    address: {
      type: String,
      trim: true,
      default: '',
    },

    phoneNumber: {
      type: String,
      trim: true,
      default: '',
    },

    department: {
      type: String,
      trim: true,
      default: '',
    },

    // Rating 1–5
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },
  },
  {
    timestamps: true,
  }
)

module.exports = mongoose.model('Employee', employeeSchema)
