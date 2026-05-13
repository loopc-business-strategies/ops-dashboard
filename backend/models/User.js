// ==========================================
// FILE: backend/models/User.js
// WHAT THIS DOES:
//   Defines the shape of every user stored in MongoDB.
//   Think of this as a form template — every user
//   must have these fields with these rules.
// ==========================================

const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')
const { createTenantModel } = require('../db/tenantModelProxy')

const userSchema = new mongoose.Schema(
  {
    // Full name — required, at least 2 characters
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
    },

    fullName: {
      type: String,
      trim: true,
      maxlength: [120, 'Full name must be at most 120 characters'],
      default: '',
    },

    // Email — must be unique, stored lowercase
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },

    // Password — stored as a hash (never plain text)
    // select: false means password is NOT returned in queries by default
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },

    // Role — controls what the user can see and do
    // super_admin  → full access + create/manage users
    // management   → read-only view of everything
    // department_head → full edit of own dept, read others
    // department_user → edit only assigned tasks
    // external     → restricted to selected modules only
    role: {
      type: String,
      enum: ['super_admin', 'management', 'department_head', 'department_user', 'external'],
      default: 'department_user',
    },

    // Which department this user belongs to
    department: {
      type: String,
      enum: ['', 'production', 'hr', 'finance', 'government', 'sales', 'operations', 'training', 'management'],
      default: '',
    },

    // For external users only — which dept modules they can see
    // Example: ['production', 'finance']
    allowedModules: {
      type: [String],
      default: [],
    },

    // Granular per-module permissions set by admin
    // Example: { hr: { on: true, view: true, edit: false }, erp: { on: true, subs: { dashboard: { view: true, edit: true } } } }
    modulePermissions: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // For department_user only — which task IDs they can edit
    assignedTasks: {
      type: [String],
      default: [],
    },

    title: {
      type: String,
      trim: true,
      maxlength: [80, 'Title must be at most 80 characters'],
      default: '',
    },

    phone: {
      type: String,
      trim: true,
      maxlength: [40, 'Phone must be at most 40 characters'],
      default: '',
    },

    location: {
      type: String,
      trim: true,
      maxlength: [120, 'Location must be at most 120 characters'],
      default: '',
    },

    timezone: {
      type: String,
      trim: true,
      maxlength: [80, 'Timezone must be at most 80 characters'],
      default: 'Africa/Johannesburg',
    },

    employeeCode: {
      type: String,
      trim: true,
      maxlength: [40, 'Employee code must be at most 40 characters'],
      default: '',
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [600, 'Notes must be at most 600 characters'],
      default: '',
    },

    // Whether the account is active or deactivated
    isActive: {
      type: Boolean,
      default: true,
    },

    lastLogin: Date,
  },
  {
    timestamps: true, // auto-adds createdAt and updatedAt
  }
)

userSchema.index({ name: 1 })
userSchema.index({ role: 1 })
userSchema.index({ isActive: 1 })

// -----------------------------------------------
// BEFORE SAVING: Hash the password automatically
// This runs every time a user is saved with a new password
// bcrypt turns "mypassword" into "$2a$12$xKj..." (unreadable)
// -----------------------------------------------
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return // only hash if changed
  this.password = await bcrypt.hash(this.password, 12)
})

// -----------------------------------------------
// METHOD: Check if entered password is correct
// Usage: const ok = await user.comparePassword('enteredPassword')
// -----------------------------------------------
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password)
}

const UserModel = createTenantModel('User', userSchema)

module.exports = UserModel
module.exports.userSchema = userSchema
module.exports.getTenantUserModel = UserModel.getTenantModel
