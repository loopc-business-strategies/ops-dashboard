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

const normalize = (value = '') => String(value).trim().toLowerCase()
const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const isReadOnlyRole = (role) => role === 'management' || role === 'external'

const canViewTask = (user, task) => {
  if (!user || !task) return false
  if (user.role === 'super_admin' || user.role === 'management') return true

  const taskDepartment = normalize(task.department)
  if (user.role === 'external') {
    const allowed = (user.allowedModules || []).map(normalize)
    return taskDepartment && allowed.includes(taskDepartment)
  }

  if (user.role === 'department_head') {
    return normalize(user.department) === taskDepartment
  }

  if (user.role === 'department_user') {
    const mineById = task.assignedToId && task.assignedToId.toString() === user._id.toString()
    const mineByName = normalize(task.assignedTo) === normalize(user.name)
    const mineByDepartment = normalize(user.department) && normalize(user.department) === taskDepartment
    return Boolean(mineById || mineByName || mineByDepartment)
  }

  return false
}

const buildTaskReadFilter = (user) => {
  if (!user) return null
  if (user.role === 'super_admin' || user.role === 'management') return {}

  if (user.role === 'external') {
    const allowed = (user.allowedModules || []).map(normalize).filter(Boolean)
    if (!allowed.length) return { _id: null }
    return { department: { $in: allowed.map((module) => new RegExp(`^${escapeRegex(module)}$`, 'i')) } }
  }

  if (user.role === 'department_head') {
    const dept = normalize(user.department)
    if (!dept) return { _id: null }
    return { department: new RegExp(`^${escapeRegex(dept)}$`, 'i') }
  }

  if (user.role === 'department_user') {
    const dept = normalize(user.department)
    const or = []

    if (dept) {
      or.push({ department: new RegExp(`^${escapeRegex(dept)}$`, 'i') })
    }

    or.push({ assignedToId: user._id })
    or.push({ assignedTo: new RegExp(`^${escapeRegex(normalize(user.name))}$`, 'i') })

    return { $or: or }
  }

  return null
}

const sanitizeDepartmentUserTaskUpdate = (payload = {}) => {
  const allowedFields = ['status', 'description', 'priority', 'dueDate']
  return Object.fromEntries(Object.entries(payload).filter(([key]) => allowedFields.includes(key)))
}

// GET all tasks
router.get('/', protect, async (req, res) => {
  try {
    const filter = buildTaskReadFilter(req.user)
    if (filter === null) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }

    const tasks = await Task.find(filter).sort({ createdAt: -1 })
    res.json({ success: true, count: tasks.length, tasks })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// POST create task
router.post('/', protect, async (req, res) => {
  try {
    if (isReadOnlyRole(req.user.role) || req.user.role === 'department_user') {
      return res.status(403).json({ success: false, message: 'You do not have permission to create tasks.' })
    }

    const { title, description, assignedTo, assignedToId, department, module, linkedRecord, status, priority, dueDate } = req.body
    if (!title) return res.status(400).json({ success: false, message: 'Title is required.' })

    const payload = { title, description, assignedTo, assignedToId, department, module, linkedRecord, status, priority, dueDate }
    if (req.user.role === 'department_head') {
      if (!normalize(req.user.department)) {
        return res.status(400).json({ success: false, message: 'Department head account is missing department.' })
      }
      payload.department = normalize(req.user.department)
    }

    const task = await Task.create(payload)
    res.status(201).json({ success: true, task })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// PUT update task
router.put('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' })

    if (!canViewTask(req.user, task)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to update this task.' })
    }

    if (isReadOnlyRole(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Read-only role cannot update tasks.' })
    }

    let updatePayload = req.body

    if (req.user.role === 'department_user') {
      const mineById = task.assignedToId && task.assignedToId.toString() === req.user._id.toString()
      const mineByName = normalize(task.assignedTo) === normalize(req.user.name)

      if (!mineById && !mineByName) {
        return res.status(403).json({ success: false, message: 'Department users can only update tasks assigned to them.' })
      }

      updatePayload = sanitizeDepartmentUserTaskUpdate(req.body)
      if (!Object.keys(updatePayload).length) {
        return res.status(400).json({ success: false, message: 'No updatable fields provided.' })
      }
    }

    if (req.user.role === 'department_head') {
      updatePayload = { ...req.body, department: normalize(req.user.department) }
    }

    const updatedTask = await Task.findByIdAndUpdate(req.params.id, updatePayload, { new: true, runValidators: true })
    res.json({ success: true, task: updatedTask })
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

    if (!canViewTask(req.user, task) || isReadOnlyRole(req.user.role)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to comment on this task.' })
    }

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
    const task = await Task.findById(req.params.id)
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' })

    if (req.user.role !== 'super_admin' && req.user.role !== 'department_head') {
      return res.status(403).json({ success: false, message: 'Only super admin or department head can delete tasks.' })
    }

    if (!canViewTask(req.user, task)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this task.' })
    }

    await Task.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Task deleted.' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

module.exports = router
