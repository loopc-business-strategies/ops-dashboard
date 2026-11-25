const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const favoriteEntrySchema = new mongoose.Schema(
  {
    navItemId: { type: String, required: true, trim: true, maxlength: 60 },
    order: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

const recentEntrySchema = new mongoose.Schema(
  {
    navItemId: { type: String, required: true, trim: true, maxlength: 60 },
    visitedAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

const userNavShortcutsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    favorites: {
      type: [favoriteEntrySchema],
      default: [],
    },
    recent: {
      type: [recentEntrySchema],
      default: [],
    },
  },
  { timestamps: true },
)

module.exports = createTenantModel('UserNavShortcuts', userNavShortcutsSchema)
