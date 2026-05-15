// FILE: backend/routes/tasks.js
// ROUTES:
//   GET    /api/tasks       — list all tasks
//   POST   /api/tasks       — create task
//   PUT    /api/tasks/:id   — update task
//   DELETE /api/tasks/:id   — delete task

const express = require('express')
const Task    = require('../models/Task')
const Message = require('../models/Message')
const { protect } = require('../middleware/auth')
const { Joi, validateBody, validateParams, validateQuery } = require('../middleware/validate')
const { publishRealtimeEvent } = require('../utils/realtimeBus')
const { softDeleteById } = require('../utils/softDelete')

const router = express.Router()

const taskIdParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
})

const listTasksQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
})

const createTaskSchema = Joi.object({
  title: Joi.string().trim().min(2).max(200).required(),
  description: Joi.string().allow('').max(4000).optional(),
  assignedTo: Joi.string().allow('').max(120).optional(),
  assignedToId: Joi.string().hex().length(24).allow('', null).optional(),
  department: Joi.string().allow('').max(80).optional(),
  module: Joi.string().allow('').max(80).optional(),
  linkedRecord: Joi.string().allow('').max(120).optional(),
  status: Joi.string().valid('todo', 'in-progress', 'blocked', 'under-review', 'done', 'cancelled').optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
  dueDate: Joi.date().iso().allow(null, '').optional(),
  reminderAt: Joi.date().iso().allow(null, '').optional(),
  notifyText: Joi.string().allow('').max(1000).optional(),
  alsoNotifyIds: Joi.array().items(Joi.string().hex().length(24)).max(50).optional(),
  alsoNotifyNames: Joi.array().items(Joi.string().trim().max(120)).max(50).optional(),
})

const updateTaskSchema = Joi.object({
  title: Joi.string().trim().min(2).max(200).optional(),
  description: Joi.string().allow('').max(4000).optional(),
  assignedTo: Joi.string().allow('').max(120).optional(),
  assignedToId: Joi.string().hex().length(24).allow('', null).optional(),
  department: Joi.string().allow('').max(80).optional(),
  module: Joi.string().allow('').max(80).optional(),
  linkedRecord: Joi.string().allow('').max(120).optional(),
  status: Joi.string().valid('todo', 'in-progress', 'blocked', 'under-review', 'done', 'cancelled').optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
  dueDate: Joi.date().iso().allow(null, '').optional(),
  reminderAt: Joi.date().iso().allow(null, '').optional(),
  archivedAt: Joi.date().iso().allow(null, '').optional(),
  notifyText: Joi.string().allow('').max(1000).optional(),
  alsoNotifyIds: Joi.array().items(Joi.string().hex().length(24)).max(50).optional(),
  alsoNotifyNames: Joi.array().items(Joi.string().trim().max(120)).max(50).optional(),
}).min(1)

const commentSchema = Joi.object({
  text: Joi.string().trim().min(1).max(2000).required(),
})

const normalize = (value = '') => String(value).trim().toLowerCase()
const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const isReadOnlyRole = (role) => role === 'management' || role === 'external'

const canCreateTask = (user) => user && !isReadOnlyRole(user.role)

const isTaskCreator = (user, task) => {
  if (!user || !task) return false
  const byId = task.createdById && task.createdById.toString() === user._id.toString()
  const byName = normalize(task.createdBy) === normalize(user.name)
  return Boolean(byId || byName)
}

const canMutateTask = (user, task) => {
  if (!user || !task) return false
  if (user.role === 'super_admin') return true
  if (isReadOnlyRole(user.role)) return false
  if (user.role === 'department_head') return normalize(user.department) === normalize(task.department)
  if (user.role === 'department_user') {
    const mineById = task.assignedToId && task.assignedToId.toString() === user._id.toString()
    const mineByName = normalize(task.assignedTo) === normalize(user.name)
    return Boolean(mineById || mineByName || isTaskCreator(user, task))
  }
  return false
}

const canDeleteTask = (user, task) => {
  if (!user || !task) return false
  if (user.role === 'super_admin') return true
  if (user.role === 'department_head') return normalize(user.department) === normalize(task.department)
  if (user.role === 'department_user') return isTaskCreator(user, task)
  return false
}

const taskMessageRecipients = ({ assignedToId, assignedTo, alsoNotifyIds = [], alsoNotifyNames = [] }) => {
  const ids = Array.isArray(alsoNotifyIds) ? [...alsoNotifyIds] : []
  const names = Array.isArray(alsoNotifyNames) ? [...alsoNotifyNames] : []

  if (assignedToId) ids.push(assignedToId)
  if (assignedTo) names.push(assignedTo)

  return {
    recipientIds: Array.from(new Set(ids.filter(Boolean).map(String))),
    recipientNames: Array.from(new Set(names.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))),
  }
}

const createTaskMessage = async (user, task, text, recipients) => {
  if (!text || !String(text).trim()) return
  if (!recipients.recipientIds.length && !recipients.recipientNames.length) return

  await Message.create({
    type: 'dm',
    room: `Task: ${task.title}`,
    department: normalize(task.department),
    senderId: user._id,
    senderName: user.name,
    recipientIds: recipients.recipientIds,
    recipientNames: recipients.recipientNames,
    text: String(text).trim(),
  })
}

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
  const allowedFields = ['status', 'description', 'priority', 'dueDate', 'module', 'linkedRecord', 'reminderAt', 'archivedAt']
  return Object.fromEntries(Object.entries(payload).filter(([key]) => allowedFields.includes(key)))
}

// GET all tasks
router.get('/', protect, validateQuery(listTasksQuerySchema), async (req, res) => {
  try {
    const filter = buildTaskReadFilter(req.user)
    if (filter === null) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }

    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50))
    const skip = (page - 1) * limit

    const activeFilter = { $and: [filter, { isDeleted: { $ne: true } }] }
    const [tasks, total] = await Promise.all([
      Task.find(activeFilter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Task.countDocuments(activeFilter),
    ])

    res.json({ success: true, count: tasks.length, total, page, limit, tasks })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// POST create task
router.post('/', protect, validateBody(createTaskSchema), async (req, res) => {
  try {
    if (!canCreateTask(req.user)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to create tasks.' })
    }

    const { title, description, assignedTo, assignedToId, department, module, linkedRecord, status, priority, dueDate, reminderAt, notifyText, alsoNotifyIds, alsoNotifyNames } = req.body
    if (!title) return res.status(400).json({ success: false, message: 'Title is required.' })

    const payload = {
      title,
      description,
      assignedTo,
      assignedToId,
      department,
      module,
      linkedRecord,
      status,
      priority,
      dueDate,
      reminderAt,
      createdBy: req.user.name,
      createdById: req.user._id,
    }
    if (req.user.role === 'department_head') {
      if (!normalize(req.user.department)) {
        return res.status(400).json({ success: false, message: 'Department head account is missing department.' })
      }
      payload.department = normalize(req.user.department)
    }

    if (req.user.role === 'department_user') {
      const userDept = normalize(req.user.department)
      if (!userDept) {
        return res.status(400).json({ success: false, message: 'Department user account is missing department.' })
      }
      payload.department = userDept
      payload.assignedTo = req.user.name
      payload.assignedToId = req.user._id
    }

    const task = await Task.create(payload)

    const recipients = taskMessageRecipients({ assignedToId: payload.assignedToId, assignedTo: payload.assignedTo, alsoNotifyIds, alsoNotifyNames })
    await createTaskMessage(req.user, task, notifyText || `New task assigned: ${task.title}`, recipients)

    publishRealtimeEvent({
      type: 'task.created',
      tenant: req.tenant?.key,
      data: { id: task._id, title: task.title, status: task.status, assignedTo: task.assignedTo },
    })

    res.status(201).json({ success: true, task })
  } catch (err) {
    console.error('Create task error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// PUT update task
router.put('/:id', protect, validateParams(taskIdParamSchema), validateBody(updateTaskSchema), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' })

    if (!canViewTask(req.user, task)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to update this task.' })
    }

    if (!canMutateTask(req.user, task)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to update this task.' })
    }

    let updatePayload = req.body
    const prevAssignedTo = task.assignedTo
    const prevAssignedToId = task.assignedToId ? task.assignedToId.toString() : ''
    const prevStatus = task.status
    const prevPriority = task.priority

    if (req.user.role === 'department_user') {
      updatePayload = sanitizeDepartmentUserTaskUpdate(req.body)
      if (!Object.keys(updatePayload).length) {
        return res.status(400).json({ success: false, message: 'No updatable fields provided.' })
      }
    }

    if (req.user.role === 'department_head') {
      updatePayload = { ...req.body, department: normalize(req.user.department) }
    }

    const { notifyText, alsoNotifyIds, alsoNotifyNames, ...dbUpdatePayload } = updatePayload
    const updatedTask = await Task.findByIdAndUpdate(req.params.id, dbUpdatePayload, { returnDocument: 'after', runValidators: true })

    const assigneeChanged = (updatedTask.assignedTo || '') !== (prevAssignedTo || '') || String(updatedTask.assignedToId || '') !== prevAssignedToId
    const statusChanged = updatedTask.status !== prevStatus
    const priorityChanged = updatedTask.priority !== prevPriority

    if (assigneeChanged || statusChanged || priorityChanged || notifyText) {
      const recipients = taskMessageRecipients({
        assignedToId: updatedTask.assignedToId,
        assignedTo: updatedTask.assignedTo,
        alsoNotifyIds,
        alsoNotifyNames,
      })
      const parts = []
      if (statusChanged) parts.push(`status changed to ${updatedTask.status}`)
      if (priorityChanged) parts.push(`priority changed to ${updatedTask.priority}`)
      if (assigneeChanged) parts.push(`assignee changed to ${updatedTask.assignedTo || 'unassigned'}`)
      await createTaskMessage(req.user, updatedTask, notifyText || `Task updated: ${updatedTask.title}${parts.length ? ` (${parts.join(', ')})` : ''}`, recipients)
    }

    publishRealtimeEvent({
      type: 'task.updated',
      tenant: req.tenant?.key,
      data: { id: updatedTask._id, title: updatedTask.title, status: updatedTask.status, assignedTo: updatedTask.assignedTo },
    })

    res.json({ success: true, task: updatedTask })
  } catch (err) {
    console.error('Update task error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// POST add comment/note to a task
router.post('/:id/comments', protect, validateParams(taskIdParamSchema), validateBody(commentSchema), async (req, res) => {
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

    const recipients = taskMessageRecipients({ assignedToId: task.assignedToId, assignedTo: task.assignedTo })
    await createTaskMessage(req.user, task, `${req.user.name} commented on task: ${task.title}`, recipients)

    publishRealtimeEvent({
      type: 'task.commented',
      tenant: req.tenant?.key,
      data: { id: task._id, title: task.title, commentBy: req.user.name },
    })

    res.json({ success: true, task })
  } catch (err) {
    console.error('Task comment error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// DELETE task
router.delete('/:id', protect, validateParams(taskIdParamSchema), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' })

    if (!canDeleteTask(req.user, task)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this task.' })
    }

    await softDeleteById(Task, req.params.id, req, req.body?.reason || 'Task removed')

    const recipients = taskMessageRecipients({ assignedToId: task.assignedToId, assignedTo: task.assignedTo })
    await createTaskMessage(req.user, task, `Task removed: ${task.title}`, recipients)

    publishRealtimeEvent({
      type: 'task.deleted',
      tenant: req.tenant?.key,
      data: { id: task._id, title: task.title },
    })

    res.json({ success: true, message: 'Task deleted.' })
  } catch (err) {
    console.error('Delete task error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

module.exports = router
