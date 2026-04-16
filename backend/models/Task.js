// FILE: backend/models/Task.js

const mongoose = require('mongoose')

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
    department: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['todo', 'in-progress', 'done'],
      default: 'todo',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    dueDate: {
      type: Date,
      default: null,
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

module.exports = mongoose.model('Task', taskSchema)
