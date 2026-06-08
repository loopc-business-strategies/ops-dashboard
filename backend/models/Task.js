// FILE: backend/models/Task.js

const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    assignedTo: {
      type: String,   // stores user name for display
      trim: true,
      default: '',
    },
    assignedToId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    /** All assignees (equal edit rights for department_user when listed). Legacy single field: assignedToId = first. */
    assignedToIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    createdBy: {
      type: String,
      trim: true,
      default: '',
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    department: {
      type: String,
      trim: true,
      default: '',
    },
    module: {
      type: String,
      trim: true,
      default: '',
    },
    linkedRecord: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['todo', 'in-progress', 'blocked', 'under-review', 'done', 'cancelled'],
      default: 'todo',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    dueDate: {
      type: Date,
      default: null,
    },
    startDate: {
      type: Date,
      default: null,
    },
    reminderAt: {
      type: Date,
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    /** When set, background job sets `archivedAt` after status → done/cancelled (see TASK_RULE_AUTO_ARCHIVE_MS). */
    autoArchiveAt: {
      type: Date,
      default: null,
    },
    /** Last `dueDate` value for which we sent the “due soon” notification (dedupe per due). */
    dueProximityNotifiedForDue: {
      type: Date,
      default: null,
    },

    /** Persisted for reminder / update notifications (same shape as API body). */
    alsoNotifyIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    alsoNotifyNames: {
      type: [{ type: String, trim: true, maxlength: 120 }],
      default: [],
    },

    tags: {
      type: [{ type: String, trim: true, maxlength: 40 }],
      default: [],
    },
    checklist: {
      type: [
        {
          title: { type: String, trim: true, maxlength: 200 },
          done: { type: Boolean, default: false },
          order: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
    blockedReason: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    blockedByTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    dependsOn: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
      default: [],
    },
    estimateHours: {
      type: Number,
      default: null,
      min: 0,
      max: 100000,
    },
    loggedHours: {
      type: Number,
      default: null,
      min: 0,
      max: 100000,
    },
    attachments: {
      type: [
        {
          fileName: { type: String, trim: true, required: true },
          originalName: { type: String, trim: true, default: '' },
          mimeType: { type: String, trim: true, default: 'application/octet-stream' },
          size: { type: Number, default: 0 },
          url: { type: String, trim: true, default: '' },
          uploadedBy: { type: String, trim: true, default: '' },
          uploadedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },

    // Notes/doubts added by the assigned user
    comments: [
      {
        author:    { type: String, required: true },
        authorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        text:      { type: String, required: true, trim: true },
        createdAt: { type: Date, default: Date.now },
      }
    ],
  },
  { timestamps: true }
)

module.exports = createTenantModel('Task', taskSchema)
