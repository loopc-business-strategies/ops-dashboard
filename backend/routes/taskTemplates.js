const express = require('express')
const TaskTemplate = require('../models/TaskTemplate')
const Task = require('../models/Task')
const { protect } = require('../middleware/auth')
const { Joi, validateBody, validateParams } = require('../middleware/validate')
const { publishRealtimeEvent } = require('../utils/realtimeBus')
const { normalize, canCreateTask, canDeleteTask } = require('../services/permissions/moduleAccessPolicy')
const { taskMessageRecipients, createTaskMessage } = require('../utils/taskDm')
const { emitTaskWebhook } = require('../utils/taskWebhooks')
const {
  extendedFieldsFromBody,
  parseAlsoNotifyForDb,
  assertRelatedTasksSameDepartment,
  extractNormalizedAssignees,
  MAX_TASK_ASSIGNEES,
} = require('../utils/taskBodyHelpers')

const router = express.Router()

const OPS_DEPT = 'operations'
const OPS_MODULE = 'operations-projects'

const templateIdParam = Joi.object({
  id: Joi.string().hex().length(24).required(),
})

const createTemplateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  department: Joi.string().allow('').max(80).optional(),
  module: Joi.string().allow('').max(80).optional(),
  defaults: Joi.object({
    title: Joi.string().allow('').max(200).optional(),
    description: Joi.string().allow('').max(4000).optional(),
    linkedRecord: Joi.string().allow('').max(120).optional(),
    module: Joi.string().allow('').max(80).optional(),
    status: Joi.string().valid('todo', 'in-progress', 'blocked', 'under-review', 'done', 'cancelled').optional(),
    priority: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
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
  }).default({}),
})

const instantiateSchema = Joi.object({
  title: Joi.string().trim().min(2).max(200).optional(),
  description: Joi.string().allow('').max(4000).optional(),
  assignedTo: Joi.string().allow('').max(500).optional(),
  assignedToId: Joi.string().hex().length(24).allow('', null).optional(),
  assignedToIds: Joi.array().items(Joi.string().hex().length(24)).max(MAX_TASK_ASSIGNEES).optional(),
  linkedRecord: Joi.string().allow('').max(120).optional(),
  module: Joi.string().allow('').max(80).optional(),
  status: Joi.string().valid('todo', 'in-progress', 'blocked', 'under-review', 'done', 'cancelled').optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
  dueDate: Joi.date().iso().allow(null, '').optional(),
  startDate: Joi.date().iso().allow(null, '').optional(),
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
}).default({})

function templateDefaultsToBody(tpl) {
  const d = tpl.defaults || {}
  return {
    title: d.title || '',
    description: d.description || '',
    linkedRecord: d.linkedRecord || '',
    module: d.module || tpl.module || '',
    status: d.status || 'todo',
    priority: d.priority || 'medium',
    tags: Array.isArray(d.tags) ? d.tags : [],
    checklist: Array.isArray(d.checklist) ? d.checklist : [],
  }
}

router.get('/', protect, async (req, res) => {
  try {
    const list = await TaskTemplate.find().sort({ updatedAt: -1 }).limit(100).lean()
    res.json({ success: true, templates: list })
  } catch (e) {
    console.error('List task templates error:', e)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.post('/', protect, validateBody(createTemplateSchema), async (req, res) => {
  try {
    if (!canCreateTask(req.user)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to create templates.' })
    }
    const { name, department, module, defaults } = req.body
    const doc = await TaskTemplate.create({
      name,
      department: department != null ? normalize(department) : '',
      module: module || '',
      defaults,
      createdBy: req.user.name,
      createdById: req.user._id,
    })
    res.status(201).json({ success: true, template: doc })
  } catch (e) {
    console.error('Create task template error:', e)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.delete('/:id', protect, validateParams(templateIdParam), async (req, res) => {
  try {
    const tpl = await TaskTemplate.findById(req.params.id)
    if (!tpl) return res.status(404).json({ success: false, message: 'Template not found.' })
    const pseudoTask = { createdById: tpl.createdById, createdBy: tpl.createdBy }
    if (!canDeleteTask(req.user, pseudoTask) && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this template.' })
    }
    await TaskTemplate.deleteOne({ _id: req.params.id })
    res.json({ success: true })
  } catch (e) {
    console.error('Delete task template error:', e)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.post('/:id/instantiate', protect, validateParams(templateIdParam), validateBody(instantiateSchema), async (req, res) => {
  try {
    if (!canCreateTask(req.user)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to create tasks.' })
    }
    const tpl = await TaskTemplate.findById(req.params.id)
    if (!tpl) return res.status(404).json({ success: false, message: 'Template not found.' })

    const merged = { ...templateDefaultsToBody(tpl), ...req.body }
    if (!merged.title || !String(merged.title).trim()) {
      return res.status(400).json({ success: false, message: 'Title is required (set in template or request body).' })
    }

    const alsoNotifyDb = parseAlsoNotifyForDb(merged)
    const ext = extendedFieldsFromBody(merged)

    const payload = {
      title: String(merged.title).trim(),
      description: (merged.description || '').trim(),
      assignedTo: (merged.assignedTo || '').trim() || undefined,
      assignedToId: merged.assignedToId ? String(merged.assignedToId).trim() : undefined,
      department: OPS_DEPT,
      module: merged.module || OPS_MODULE,
      linkedRecord: String(merged.linkedRecord || '').trim().slice(0, 120),
      status: merged.status || 'todo',
      priority: merged.priority || 'medium',
      dueDate: merged.dueDate || undefined,
      startDate: merged.startDate || undefined,
      reminderAt: merged.reminderAt ? new Date(merged.reminderAt) : undefined,
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
      payload.assignedToIds = [req.user._id]
    } else {
      const ex = extractNormalizedAssignees(merged)
      if (ex) {
        payload.assignedToIds = ex.assignedToIds
        payload.assignedToId = ex.assignedToId
        payload.assignedTo = ex.assignedTo
      } else if (payload.assignedToId) {
        const ex2 = extractNormalizedAssignees({
          assignedToIds: [String(payload.assignedToId)],
          assignedTo: payload.assignedTo || '',
        })
        payload.assignedToIds = ex2.assignedToIds
        payload.assignedToId = ex2.assignedToId
        payload.assignedTo = ex2.assignedTo
      } else {
        payload.assignedToIds = []
        payload.assignedToId = null
      }
    }

    const refErr = await assertRelatedTasksSameDepartment(Task, payload.department, {
      blockedByTaskId: payload.blockedByTaskId,
      dependsOn: payload.dependsOn || [],
    })
    if (refErr) return res.status(400).json({ success: false, message: refErr })

    const task = await Task.create(payload)

    const recipients = taskMessageRecipients({
      assignedToId: payload.assignedToId,
      assignedToIds: payload.assignedToIds,
      assignedTo: payload.assignedTo,
      alsoNotifyIds: (alsoNotifyDb.alsoNotifyIds || []).map(String),
      alsoNotifyNames: alsoNotifyDb.alsoNotifyNames,
    })
    await createTaskMessage(req.user, task, merged.notifyText || `New task from template "${tpl.name}": ${task.title}`, recipients)

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
      source: 'template',
      templateId: String(tpl._id),
    })

    res.status(201).json({ success: true, project: task })
  } catch (e) {
    console.error('Instantiate task template error:', e)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

module.exports = router
