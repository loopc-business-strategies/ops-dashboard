// FILE: backend/routes/tasks.js
// ROUTES:
//   GET    /api/tasks       — list all tasks
//   POST   /api/tasks       — create task
//   PUT    /api/tasks/:id   — update task
//   DELETE /api/tasks/:id   — delete task

const express = require('express')
const Task    = require('../models/Task')
const { protect } = require('../middleware/auth')

const router = express.Router()

// GET all tasks
router.get('/', protect, async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 })
    res.json({ success: true, count: tasks.length, tasks })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// POST create task
router.post('/', protect, async (req, res) => {
  try {
    const { title, description, assignedTo, assignedToId, department, status, priority, dueDate } = req.body
    if (!title) return res.status(400).json({ success: false, message: 'Title is required.' })

    const task = await Task.create({ title, description, assignedTo, assignedToId, department, status, priority, dueDate })
    res.status(201).json({ success: true, task })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// PUT update task
router.put('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' })
    res.json({ success: true, task })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// POST add comment/note to a task
router.post('/:id/comments', protect, async (req, res) => {
  try {
    const { text } = req.body
    if (!text || !text.trim())
      return res.status(400).json({ success: false, message: 'Comment text is required.' })

    const task = await Task.findById(req.params.id)
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' })

    task.comments.push({ author: req.user.name, authorId: req.user._id, text: text.trim() })
    await task.save()

    res.json({ success: true, task })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// DELETE task
router.delete('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id)
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' })
    res.json({ success: true, message: 'Task deleted.' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

module.exports = router
