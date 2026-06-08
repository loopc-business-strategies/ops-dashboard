const fs = require('fs')
const path = require('path')
const express = require('express')
const { protect } = require('../middleware/auth')
const Message = require('../models/Message')
const ChatGroup = require('../models/ChatGroup')
const User = require('../models/User')
const { Joi, validateBody, validateQuery } = require('../middleware/validate')
const { publishRealtimeEvent } = require('../utils/realtimeBus')
const {
  normalize,
  buildMessageScopeForUser,
  isSuperAdmin,
  isDepartmentHead,
} = require('../services/permissions/moduleAccessPolicy')
const { chatUpload, chatUploadDir, buildAttachmentPayload } = require('../services/chat/uploadMiddleware')

const router = express.Router()

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const latestQuerySchema = Joi.object({
  type: Joi.string().valid('all', 'group', 'dm').optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
})

/** Multipart sends JSON arrays as strings; JSON bodies send real arrays — accept both. */
function jsonOrArrayOf(schemaItem, max = 100) {
  return Joi.alternatives().try(
    Joi.array().items(schemaItem).max(max),
    Joi.string().custom((value, helpers) => {
      try {
        const parsed = JSON.parse(String(value || '[]'))
        if (!Array.isArray(parsed)) return helpers.error('any.invalid')
        const { error, value: coerced } = Joi.array().items(schemaItem).max(max).validate(parsed)
        if (error) return helpers.error('any.invalid')
        return coerced
      } catch {
        return helpers.error('any.invalid')
      }
    }),
  ).optional()
}

const createMessageSchema = Joi.object({
  type: Joi.string().valid('group', 'dm').optional(),
  room: Joi.string().allow('').max(120).optional(),
  text: Joi.string().trim().max(4000).allow('').optional(),
  department: Joi.string().allow('').max(80).optional(),
  groupId: Joi.string().hex().length(24).optional(),
  recipientIds: jsonOrArrayOf(Joi.string().hex().length(24)),
  recipientNames: jsonOrArrayOf(Joi.string().trim().max(120)),
  mentionedUserIds: jsonOrArrayOf(Joi.string().hex().length(24)),
  mentionedNames: jsonOrArrayOf(Joi.string().trim().max(120)),
})

const createGroupSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  department: Joi.string().allow('').max(80).optional(),
  description: Joi.string().allow('').max(250).optional(),
  memberIds: Joi.array().items(Joi.string().hex().length(24)).max(200).optional(),
})

const updateGroupSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).optional(),
  department: Joi.string().allow('').max(80).optional(),
  description: Joi.string().allow('').max(250).optional(),
  memberIds: Joi.array().items(Joi.string().hex().length(24)).max(200).optional(),
  isActive: Joi.boolean().optional(),
})

const extractMentionNames = (text) => Array.from(new Set(
  Array.from(String(text || '').matchAll(/@([A-Za-z0-9._-]+)/g))
    .map((match) => String(match[1] || '').trim())
    .filter(Boolean)
))

function slugifyRoom(name) {
  const base = String(name || 'group')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'group'
  return `${base}-${Date.now().toString(36)}`
}

function canManageGroups(user) {
  return isSuperAdmin(user) || isDepartmentHead(user)
}

/** Groups the user belongs to or created (same rules for every role). */
function buildGroupScope(user) {
  return {
    isActive: true,
    $or: [{ memberIds: user._id }, { createdBy: user._id }],
  }
}

async function resolveMemberGroupIds(user) {
  return ChatGroup.distinct('_id', buildGroupScope(user))
}

async function resolveUsers({ ids = [], names = [] }) {
  const requestedIds = Array.from(new Set(
    ids.map((id) => String(id || '').trim()).filter((id) => /^[a-f\d]{24}$/i.test(id))
  ))
  const requestedNames = Array.from(new Set(
    names.map((name) => String(name || '').replace(/^@/, '').trim()).filter(Boolean)
  ))

  const or = []
  if (requestedIds.length) or.push({ _id: { $in: requestedIds } })
  requestedNames.forEach((name) => {
    const exact = new RegExp(`^${escapeRegex(name)}$`, 'i')
    const loose = new RegExp(`^${escapeRegex(name).replace(/[-_.]+/g, '[\\s._-]*')}$`, 'i')
    or.push({ name: exact }, { fullName: exact }, { employeeCode: exact }, { email: exact })
    if (loose.source !== exact.source) or.push({ name: loose }, { fullName: loose }, { employeeCode: loose })
  })
  if (!or.length) return []

  return User.find({ isDeleted: { $ne: true }, isActive: { $ne: false }, $or: or })
    .select('_id name fullName email role department title employeeCode')
    .limit(100)
}

function emitUserNotifications(req, users, type, data) {
  const realtimeServer = req.app.get('realtimeServer')
  if (!realtimeServer || typeof realtimeServer.sendUserNotification !== 'function') return
  users.forEach((target) => {
    const targetId = String(target?._id || '')
    if (!targetId || targetId === String(req.user._id)) return
    realtimeServer.sendUserNotification(targetId, type, data)
  })
}

function parseMaybeJsonArray(value) {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function maybeUpload(req, res, next) {
  const contentType = String(req.headers['content-type'] || '')
  if (!contentType.includes('multipart/form-data')) return next()
  return chatUpload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message || 'Upload failed.' })
    return next()
  })
}

async function createMessageRecord(req, res) {
  const body = req.body || {}
  const text = String(body.text || '').trim()
  const attachment = buildAttachmentPayload(req.file)

  if (!text && !attachment) {
    return res.status(400).json({ success: false, message: 'Message text or attachment is required.' })
  }

  const {
    type = 'group',
    room = '',
    department = '',
    groupId = '',
    recipientIds = [],
    recipientNames = [],
    mentionedUserIds = [],
    mentionedNames = [],
  } = body

  const parsedRecipientIds = parseMaybeJsonArray(recipientIds)
  const parsedRecipientNames = parseMaybeJsonArray(recipientNames)
  const parsedMentionedIds = parseMaybeJsonArray(mentionedUserIds)
  const parsedMentionedNames = parseMaybeJsonArray(mentionedNames)

  const safeType = ['group', 'dm'].includes(String(type)) ? String(type) : 'group'

  let resolvedGroup = null
  if (groupId && /^[a-f\d]{24}$/i.test(String(groupId))) {
    resolvedGroup = await ChatGroup.findOne({ _id: groupId, isActive: true })
    if (!resolvedGroup) {
      return res.status(404).json({ success: false, message: 'Chat group not found.' })
    }
  }

  const resolvedDepartment = safeType === 'group'
    ? normalize(resolvedGroup?.department || req.user.department || 'management')
    : normalize(department || req.user.department)

  const recipientUsers = await resolveUsers({
    ids: parsedRecipientIds,
    names: parsedRecipientNames,
  })
  const mentionedUsers = await resolveUsers({
    ids: parsedMentionedIds,
    names: [...extractMentionNames(text), ...parsedMentionedNames],
  })

  const recipientIdSet = new Set(parsedRecipientIds.map(String))
  recipientUsers.forEach((recipientUser) => recipientIdSet.add(String(recipientUser._id)))
  mentionedUsers.forEach((mentionedUser) => recipientIdSet.add(String(mentionedUser._id)))
  if (resolvedGroup) {
    ;(resolvedGroup.memberIds || []).forEach((memberId) => recipientIdSet.add(String(memberId)))
  }

  const recipientNameSet = new Set(parsedRecipientNames.map(String))
  recipientUsers.forEach((recipientUser) => {
    if (recipientUser.name) recipientNameSet.add(String(recipientUser.name))
  })
  mentionedUsers.forEach((mentionedUser) => {
    if (mentionedUser.name) recipientNameSet.add(String(mentionedUser.name))
  })

  const resolvedRoom = String(
    resolvedGroup?.room
    || room
    || (safeType === 'group' ? `${resolvedDepartment || 'general'} updates` : 'Direct Message')
  ).trim()

  const message = await Message.create({
    type: safeType,
    room: resolvedRoom,
    department: resolvedDepartment,
    senderId: req.user._id,
    senderName: req.user.name,
    recipientIds: Array.from(recipientIdSet),
    recipientNames: Array.from(recipientNameSet),
    text,
    attachments: attachment ? [attachment] : [],
    groupId: resolvedGroup?._id || null,
  })

  publishRealtimeEvent({
    type: 'message.created',
    tenant: String(req.tenant || 'default').trim().toLowerCase(),
    data: {
      id: message._id,
      room: message.room,
      type: message.type,
      senderName: message.senderName,
      createdAt: message.createdAt,
      recipientIds: message.recipientIds.map(String),
    },
  })

  const mentionedOnly = mentionedUsers.filter((mentionedUser) => String(mentionedUser._id) !== String(req.user._id))
  if (mentionedOnly.length) {
    emitUserNotifications(req, mentionedOnly, 'chat_mention', {
      messageId: String(message._id),
      message: message.text || attachment?.originalName || 'Attachment',
      room: message.room,
      senderId: String(req.user._id),
      senderName: String(req.user.name || ''),
      createdAt: message.createdAt,
    })
  }

  return res.status(201).json({
    success: true,
    message,
    deliveredTo: Array.from(new Map([...recipientUsers, ...mentionedUsers].map((target) => [String(target._id), target])).values()).map((target) => ({
      _id: target._id,
      name: target.name,
      email: target.email,
    })),
  })
}

router.get('/participants', protect, async (_req, res) => {
  try {
    const users = await User.find({ isDeleted: { $ne: true }, isActive: { $ne: false } })
      .select('_id name fullName email role department title employeeCode')
      .sort({ name: 1 })
      .limit(500)
      .lean()
    res.json({ success: true, users })
  } catch {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.get('/groups', protect, async (req, res) => {
  try {
    const groups = await ChatGroup.find(buildGroupScope(req.user))
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean()
    res.json({ success: true, groups })
  } catch {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.post('/groups', protect, validateBody(createGroupSchema), async (req, res) => {
  try {
    if (!canManageGroups(req.user)) {
      return res.status(403).json({ success: false, message: 'Only admins and department heads can create groups.' })
    }

    const memberIds = Array.from(new Set([
      String(req.user._id),
      ...(Array.isArray(req.body.memberIds) ? req.body.memberIds.map(String) : []),
    ].filter((id) => /^[a-f\d]{24}$/i.test(id))))

    const group = await ChatGroup.create({
      name: String(req.body.name).trim(),
      room: slugifyRoom(req.body.name),
      department: normalize(req.body.department || req.user.department || 'management'),
      description: String(req.body.description || '').trim(),
      memberIds,
      createdBy: req.user._id,
      isActive: true,
    })

    res.status(201).json({ success: true, group })
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: 'A group with a similar room already exists.' })
    }
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.put('/groups/:id', protect, validateBody(updateGroupSchema), async (req, res) => {
  try {
    if (!canManageGroups(req.user)) {
      return res.status(403).json({ success: false, message: 'Only admins and department heads can update groups.' })
    }

    const group = await ChatGroup.findById(req.params.id)
    if (!group || !group.isActive) {
      return res.status(404).json({ success: false, message: 'Chat group not found.' })
    }

    if (req.body.name) group.name = String(req.body.name).trim()
    if (req.body.department !== undefined) group.department = normalize(req.body.department || group.department)
    if (req.body.description !== undefined) group.description = String(req.body.description || '').trim()
    if (Array.isArray(req.body.memberIds)) {
      group.memberIds = Array.from(new Set([
        String(group.createdBy),
        ...req.body.memberIds.map(String),
      ].filter((id) => /^[a-f\d]{24}$/i.test(id))))
    }
    if (typeof req.body.isActive === 'boolean') group.isActive = req.body.isActive

    await group.save()
    res.json({ success: true, group })
  } catch {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.delete('/groups/:id', protect, async (req, res) => {
  try {
    if (!canManageGroups(req.user)) {
      return res.status(403).json({ success: false, message: 'Only admins and department heads can delete groups.' })
    }

    const group = await ChatGroup.findById(req.params.id)
    if (!group || !group.isActive) {
      return res.status(404).json({ success: false, message: 'Chat group not found.' })
    }

    group.isActive = false
    await group.save()
    res.json({ success: true, message: 'Group archived.' })
  } catch {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.get('/latest', protect, validateQuery(latestQuerySchema), async (req, res) => {
  try {
    const { type = 'all' } = req.query
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
    const memberGroupIds = await resolveMemberGroupIds(req.user)
    const query = { ...buildMessageScopeForUser(req.user, memberGroupIds) }

    if (type !== 'all') {
      query.type = String(type)
    }

    const messages = await Message.find(query).sort({ createdAt: -1 }).limit(limit)

    res.json({ success: true, count: messages.length, messages })
  } catch {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.get('/attachments/:filename', protect, async (req, res) => {
  try {
    const { filename } = req.params
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ success: false, message: 'Invalid filename' })
    }

    const memberGroupIds = await resolveMemberGroupIds(req.user)
    const message = await Message.findOne({
      ...buildMessageScopeForUser(req.user, memberGroupIds),
      'attachments.fileName': filename,
    })
    if (!message) {
      return res.status(404).json({ success: false, message: 'Attachment not found.' })
    }

    const attachment = (message.attachments || []).find((entry) => String(entry.fileName) === filename)
    const filePath = path.resolve(chatUploadDir, filename)
    if (!filePath.startsWith(chatUploadDir) || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found.' })
    }

    if (attachment?.mimeType) res.setHeader('Content-Type', attachment.mimeType)
    if (attachment?.originalName) {
      res.setHeader('Content-Disposition', `inline; filename="${attachment.originalName.replace(/"/g, '')}"`)
    }
    return res.sendFile(filePath)
  } catch {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.post('/', protect, maybeUpload, validateBody(createMessageSchema), async (req, res) => {
  try {
    return await createMessageRecord(req, res)
  } catch {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

module.exports = router
