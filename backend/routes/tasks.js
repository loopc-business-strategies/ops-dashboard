// FILE: backend/routes/tasks.js
// ROUTES:
//   GET    /api/projects   — list all projects (Mongo `tasks` collection)
//   POST   /api/projects   — create project
//   PUT    /api/projects/:id   — update project
//   DELETE /api/projects/:id   — delete project

const express = require('express')
const path = require('path')
const fs = require('fs')
const mongoose = require('mongoose')
const multer = require('multer')
const Task    = require('../models/Task')
const { protect } = require('../middleware/auth')
const { Joi, validateBody, validateParams, validateQuery } = require('../middleware/validate')
const { publishRealtimeEvent } = require('../utils/realtimeBus')
const { softDeleteById } = require('../utils/softDelete')
const {
  normalize,
  escapeRegex,
  canCreateTask,
  isTaskCreator,
  canMutateTask,
  canDeleteTask,
  canViewTask,
  buildTaskReadFilter,
  isReadOnlyRole,
} = require('../services/permissions/moduleAccessPolicy')
const { dependsOnReachesTask } = require('../utils/taskDependencyValidation')
const { emitTaskWebhook } = require('../utils/taskWebhooks')
const { taskMessageRecipients, createTaskMessage } = require('../utils/taskDm')
const { extendedFieldsFromBody, parseAlsoNotifyForDb, assertRelatedTasksSameDepartment } = require('../utils/taskBodyHelpers')
const { applyAutomationDerivedFields } = require('../utils/taskRulesHelpers')

const router = express.Router()

function uploadRoot() {
  return process.env.UPLOAD_STORAGE_ROOT || path.join(__dirname, '..', 'uploads')
}

function taskAttachmentsDir() {
  const dir = path.join(uploadRoot(), 'task-attachments')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

const taskAttachStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, taskAttachmentsDir()),
  filename: (req, file, cb) => {
    const base = `${req.params.id}-${Date.now()}-${String(file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)}`
    cb(null, base)
  },
})
const taskAttachmentUpload = multer({
  storage: taskAttachStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
})

const taskIdParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
})

const taskAttachmentParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
  fileName: Joi.string().trim().min(1).max(300).required(),
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
  tags: Joi.array().items(Joi.string().trim().max(40)).max(20).optional(),
  checklist: Joi.array()
    .items(
      Joi.object({
        title: Joi.string().trim().max(200).required(),
        done: Joi.boolean().optional(),
        order: Joi.number().integer().min(0).optional(),
      })
    )
    .max(40)
    .optional(),
  blockedReason: Joi.string().allow('').max(500).optional(),
  blockedByTaskId: Joi.string().hex().length(24).allow('', null).optional(),
  dependsOn: Joi.array().items(Joi.string().hex().length(24)).max(20).optional(),
  estimateHours: Joi.number().min(0).max(100000).allow(null).optional(),
  loggedHours: Joi.number().min(0).max(100000).allow(null).optional(),
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
  tags: Joi.array().items(Joi.string().trim().max(40)).max(20).optional(),
  checklist: Joi.array()
    .items(
      Joi.object({
        title: Joi.string().trim().max(200).required(),
        done: Joi.boolean().optional(),
        order: Joi.number().integer().min(0).optional(),
      })
    )
    .max(40)
    .optional(),
  blockedReason: Joi.string().allow('').max(500).optional(),
  blockedByTaskId: Joi.string().hex().length(24).allow('', null).optional(),
  dependsOn: Joi.array().items(Joi.string().hex().length(24)).max(20).optional(),
  estimateHours: Joi.number().min(0).max(100000).allow(null).optional(),
  loggedHours: Joi.number().min(0).max(100000).allow(null).optional(),
}).min(1)

const commentSchema = Joi.object({
  text: Joi.string().trim().min(1).max(2000).required(),
})

const sanitizeDepartmentUserTaskUpdate = (payload = {}) => {
  const allowedFields = [
    'status',
    'description',
    'priority',
    'dueDate',
    'module',
    'linkedRecord',
    'reminderAt',
    'archivedAt',
    'tags',
    'checklist',
    'blockedReason',
    'blockedByTaskId',
    'dependsOn',
    'estimateHours',
    'loggedHours',
  ]
  return Object.fromEntries(Object.entries(payload).filter(([key]) => allowedFields.includes(key)))
}

function coerceDbUpdatePayload(patch) {
  const out = { ...patch }
  delete out.autoArchiveAt
  delete out.dueProximityNotifiedForDue
  if (out.dependsOn !== undefined) {
    out.dependsOn = [...new Set((out.dependsOn || []).filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id)))]
  }
  if (out.blockedByTaskId !== undefined) {
    out.blockedByTaskId =
      out.blockedByTaskId && mongoose.Types.ObjectId.isValid(out.blockedByTaskId)
        ? new mongoose.Types.ObjectId(out.blockedByTaskId)
        : null
  }
  if (out.alsoNotifyIds !== undefined) {
    out.alsoNotifyIds = [...new Set((out.alsoNotifyIds || []).filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id)))].slice(
      0,
      50
    )
  }
  if (out.alsoNotifyNames !== undefined) {
    out.alsoNotifyNames = [...new Set((out.alsoNotifyNames || []).map((n) => String(n).trim()).filter(Boolean))].slice(0, 50).map((n) => n.slice(0, 120))
  }
  return out
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

    res.json({ success: true, count: tasks.length, total, page, limit, projects: tasks })
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

    const {
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
      notifyText,
    } = req.body
    if (!title) return res.status(400).json({ success: false, message: 'Title is required.' })

    const ext = extendedFieldsFromBody(req.body)
    const alsoNotifyDb = parseAlsoNotifyForDb(req.body)

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
      ...ext,
      ...alsoNotifyDb,
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

    const refErr = await assertRelatedTasksSameDepartment(Task, payload.department, {
      blockedByTaskId: payload.blockedByTaskId,
      dependsOn: payload.dependsOn || [],
    })
    if (refErr) return res.status(400).json({ success: false, message: refErr })

    const task = await Task.create(payload)

    const recipients = taskMessageRecipients({
      assignedToId: payload.assignedToId,
      assignedTo: payload.assignedTo,
      alsoNotifyIds: (alsoNotifyDb.alsoNotifyIds || []).map(String),
      alsoNotifyNames: alsoNotifyDb.alsoNotifyNames,
    })
    await createTaskMessage(req.user, task, notifyText || `New task assigned: ${task.title}`, recipients)

    publishRealtimeEvent({
      type: 'task.created',
      tenant: String(req.tenant || 'default').trim().toLowerCase(),
      data: { id: task._id, title: task.title, status: task.status, assignedTo: task.assignedTo },
    })

    emitTaskWebhook('task.created', {
      taskId: String(task._id),
      title: task.title,
      status: task.status,
      department: task.department,
    })

    res.status(201).json({ success: true, project: task })
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

    const { notifyText, alsoNotifyIds, alsoNotifyNames, ...dbUpdatePayloadRaw } = updatePayload
    let dbUpdatePayload = coerceDbUpdatePayload(dbUpdatePayloadRaw)
    dbUpdatePayload = applyAutomationDerivedFields(dbUpdatePayload, task)

    if (dbUpdatePayload.dependsOn !== undefined && dbUpdatePayload.dependsOn.length) {
      if (await dependsOnReachesTask(Task, dbUpdatePayload.dependsOn, task._id)) {
        return res.status(400).json({ success: false, message: 'Circular task dependency.' })
      }
    }

    if (dbUpdatePayload.blockedByTaskId && String(dbUpdatePayload.blockedByTaskId) === String(task._id)) {
      return res.status(400).json({ success: false, message: 'Task cannot block itself.' })
    }

    const mergedDept = dbUpdatePayload.department !== undefined ? dbUpdatePayload.department : task.department
    const mergedBlocked = dbUpdatePayload.blockedByTaskId !== undefined ? dbUpdatePayload.blockedByTaskId : task.blockedByTaskId
    const mergedDepends = dbUpdatePayload.dependsOn !== undefined ? dbUpdatePayload.dependsOn : task.dependsOn
    const refErr = await assertRelatedTasksSameDepartment(Task, mergedDept, {
      blockedByTaskId: mergedBlocked,
      dependsOn: mergedDepends || [],
    })
    if (refErr) return res.status(400).json({ success: false, message: refErr })

    const updatedTask = await Task.findByIdAndUpdate(req.params.id, dbUpdatePayload, { returnDocument: 'after', runValidators: true })

    const assigneeChanged = (updatedTask.assignedTo || '') !== (prevAssignedTo || '') || String(updatedTask.assignedToId || '') !== prevAssignedToId
    const statusChanged = updatedTask.status !== prevStatus
    const priorityChanged = updatedTask.priority !== prevPriority
    const prevNotifySig = `${[...(task.alsoNotifyIds || []).map(String)].sort().join(',')}|${(task.alsoNotifyNames || []).join('\x1e')}`
    const nextNotifySig = `${[...(updatedTask.alsoNotifyIds || []).map(String)].sort().join(',')}|${(updatedTask.alsoNotifyNames || []).join('\x1e')}`
    const alsoNotifyChanged = prevNotifySig !== nextNotifySig

    if (assigneeChanged || statusChanged || priorityChanged || alsoNotifyChanged || notifyText) {
      const notifyIds = Array.isArray(alsoNotifyIds) ? alsoNotifyIds : (updatedTask.alsoNotifyIds || []).map((id) => String(id))
      const notifyNames = Array.isArray(alsoNotifyNames) ? alsoNotifyNames : updatedTask.alsoNotifyNames || []
      const recipients = taskMessageRecipients({
        assignedToId: updatedTask.assignedToId,
        assignedTo: updatedTask.assignedTo,
        alsoNotifyIds: notifyIds,
        alsoNotifyNames: notifyNames,
      })
      const parts = []
      if (statusChanged) parts.push(`status changed to ${updatedTask.status}`)
      if (priorityChanged) parts.push(`priority changed to ${updatedTask.priority}`)
      if (assigneeChanged) parts.push(`assignee changed to ${updatedTask.assignedTo || 'unassigned'}`)
      if (alsoNotifyChanged && !assigneeChanged && !statusChanged && !priorityChanged && !notifyText) {
        parts.push('also-notify list updated')
      }
      await createTaskMessage(req.user, updatedTask, notifyText || `Task updated: ${updatedTask.title}${parts.length ? ` (${parts.join(', ')})` : ''}`, recipients)
    }

    publishRealtimeEvent({
      type: 'task.updated',
      tenant: String(req.tenant || 'default').trim().toLowerCase(),
      data: { id: updatedTask._id, title: updatedTask.title, status: updatedTask.status, assignedTo: updatedTask.assignedTo },
    })

    emitTaskWebhook('task.updated', {
      taskId: String(updatedTask._id),
      title: updatedTask.title,
      status: updatedTask.status,
      department: updatedTask.department,
    })

    res.json({ success: true, project: updatedTask })
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

    const recipients = taskMessageRecipients({
      assignedToId: task.assignedToId,
      assignedTo: task.assignedTo,
      alsoNotifyIds: (task.alsoNotifyIds || []).map((id) => String(id)),
      alsoNotifyNames: task.alsoNotifyNames || [],
    })
    await createTaskMessage(req.user, task, `${req.user.name} commented on task: ${task.title}`, recipients)

    publishRealtimeEvent({
      type: 'task.commented',
      tenant: String(req.tenant || 'default').trim().toLowerCase(),
      data: { id: task._id, title: task.title, commentBy: req.user.name },
    })

    emitTaskWebhook('task.commented', {
      taskId: String(task._id),
      title: task.title,
      commentBy: req.user.name,
    })

    res.json({ success: true, project: task })
  } catch (err) {
    console.error('Task comment error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.post(
  '/:id/attachments',
  protect,
  validateParams(taskIdParamSchema),
  taskAttachmentUpload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' })
      const task = await Task.findById(req.params.id)
      if (!task) return res.status(404).json({ success: false, message: 'Task not found.' })
      if (!canViewTask(req.user, task) || !canMutateTask(req.user, task)) {
        return res.status(403).json({ success: false, message: 'You do not have permission to attach files.' })
      }
      const rel = `/api/projects/${req.params.id}/attachments/download/${encodeURIComponent(req.file.filename)}`
      task.attachments = task.attachments || []
      task.attachments.push({
        fileName: req.file.filename,
        originalName: req.file.originalname || req.file.filename,
        mimeType: req.file.mimetype || 'application/octet-stream',
        size: req.file.size || 0,
        url: rel,
        uploadedBy: req.user.name,
        uploadedById: req.user._id,
        uploadedAt: new Date(),
      })
      await task.save()
      emitTaskWebhook('task.attachment_added', { taskId: String(task._id), title: task.title, fileName: req.file.filename })
      res.json({ success: true, project: task })
    } catch (err) {
      console.error('Task attachment upload error:', err)
      res.status(500).json({ success: false, message: 'Server error.' })
    }
  }
)

router.get(
  '/:id/attachments/download/:fileName',
  protect,
  validateParams(taskAttachmentParamSchema),
  async (req, res) => {
    try {
      const task = await Task.findById(req.params.id)
      if (!task) return res.status(404).json({ success: false, message: 'Task not found.' })
      if (!canViewTask(req.user, task)) {
        return res.status(403).json({ success: false, message: 'Access denied.' })
      }
      const { fileName } = req.params
      const entry = (task.attachments || []).find((a) => a.fileName === fileName)
      if (!entry) return res.status(404).json({ success: false, message: 'Attachment not found.' })
      const diskPath = path.join(taskAttachmentsDir(), entry.fileName)
      if (!fs.existsSync(diskPath)) return res.status(404).json({ success: false, message: 'File missing.' })
      res.setHeader('Content-Type', entry.mimeType || 'application/octet-stream')
      if (entry.originalName) {
        res.setHeader('Content-Disposition', `inline; filename="${String(entry.originalName).replace(/"/g, '')}"`)
      }
      return res.sendFile(path.resolve(diskPath))
    } catch (err) {
      console.error('Task attachment download error:', err)
      res.status(500).json({ success: false, message: 'Server error.' })
    }
  }
)

router.delete(
  '/:id/attachments/:fileName',
  protect,
  validateParams(taskAttachmentParamSchema),
  async (req, res) => {
    try {
      const task = await Task.findById(req.params.id)
      if (!task) return res.status(404).json({ success: false, message: 'Task not found.' })
      if (!canMutateTask(req.user, task)) {
        return res.status(403).json({ success: false, message: 'You do not have permission to delete this attachment.' })
      }
      const { fileName } = req.params
      const idx = (task.attachments || []).findIndex((a) => a.fileName === fileName)
      if (idx < 0) return res.status(404).json({ success: false, message: 'Attachment not found.' })
      const diskPath = path.join(taskAttachmentsDir(), fileName)
      task.attachments.splice(idx, 1)
      await task.save()
      try {
        fs.unlinkSync(diskPath)
      } catch {
        /* ignore missing file */
      }
      res.json({ success: true, project: task })
    } catch (err) {
      console.error('Task attachment delete error:', err)
      res.status(500).json({ success: false, message: 'Server error.' })
    }
  }
)

// DELETE task
router.delete('/:id', protect, validateParams(taskIdParamSchema), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' })

    if (!canDeleteTask(req.user, task)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this task.' })
    }

    await softDeleteById(Task, req.params.id, req, req.body?.reason || 'Task removed')

    const recipients = taskMessageRecipients({
      assignedToId: task.assignedToId,
      assignedTo: task.assignedTo,
      alsoNotifyIds: (task.alsoNotifyIds || []).map((id) => String(id)),
      alsoNotifyNames: task.alsoNotifyNames || [],
    })
    await createTaskMessage(req.user, task, `Task removed: ${task.title}`, recipients)

    publishRealtimeEvent({
      type: 'task.deleted',
      tenant: String(req.tenant || 'default').trim().toLowerCase(),
      data: { id: task._id, title: task.title },
    })

    res.json({ success: true, message: 'Task deleted.' })
  } catch (err) {
    console.error('Delete task error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

module.exports = router
