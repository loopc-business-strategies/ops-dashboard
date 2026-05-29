const express = require('express')
const { protect } = require('../middleware/auth')
const Message = require('../models/Message')
const User = require('../models/User')
const { Joi, validateBody, validateQuery } = require('../middleware/validate')
const { publishRealtimeEvent } = require('../utils/realtimeBus')
const {
  normalize,
  canSeeAllMessages,
  buildMessageScope,
} = require('../services/permissions/moduleAccessPolicy')

const router = express.Router()

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const latestQuerySchema = Joi.object({
  type: Joi.string().valid('all', 'group', 'dm').optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
})

const createMessageSchema = Joi.object({
  type: Joi.string().valid('group', 'dm').optional(),
  room: Joi.string().allow('').max(120).optional(),
  text: Joi.string().trim().min(1).max(4000).required(),
  department: Joi.string().allow('').max(80).optional(),
  recipientIds: Joi.array().items(Joi.string().hex().length(24)).max(100).optional(),
  recipientNames: Joi.array().items(Joi.string().trim().max(120)).max(100).optional(),
  mentionedUserIds: Joi.array().items(Joi.string().hex().length(24)).max(100).optional(),
  mentionedNames: Joi.array().items(Joi.string().trim().max(120)).max(100).optional(),
})

const extractMentionNames = (text) => Array.from(new Set(
  Array.from(String(text || '').matchAll(/@([A-Za-z0-9._-]+)/g))
    .map((match) => String(match[1] || '').trim())
    .filter(Boolean)
))

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

router.get('/latest', protect, validateQuery(latestQuerySchema), async (req, res) => {
  try {
    const { type = 'all' } = req.query
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
    const query = buildMessageScope(req.user)

    if (type !== 'all') {
      query.type = String(type)
    }

    const messages = await Message.find(query).sort({ createdAt: -1 }).limit(limit)

    res.json({ success: true, count: messages.length, messages })
  } catch {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.post('/', protect, validateBody(createMessageSchema), async (req, res) => {
  try {
    const {
      type = 'group',
      room = '',
      text = '',
      department = '',
      recipientIds = [],
      recipientNames = [],
      mentionedUserIds = [],
      mentionedNames = [],
    } = req.body

    if (!text || !String(text).trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required.' })
    }

    const safeType = ['group', 'dm'].includes(String(type)) ? String(type) : 'group'

    const resolvedDepartment = safeType === 'group'
      ? (canSeeAllMessages(req.user) ? normalize(department || req.user.department || 'management') : normalize(req.user.department))
      : normalize(department || req.user.department)

    const parsedRecipientIds = Array.isArray(recipientIds) ? recipientIds.filter(Boolean) : []
    const parsedRecipientNames = Array.isArray(recipientNames) ? recipientNames.filter(Boolean).map(String) : []
    const recipientUsers = await resolveUsers({
      ids: parsedRecipientIds,
      names: parsedRecipientNames,
    })
    const mentionedUsers = await resolveUsers({
      ids: Array.isArray(mentionedUserIds) ? mentionedUserIds : [],
      names: [...extractMentionNames(text), ...(Array.isArray(mentionedNames) ? mentionedNames : [])],
    })
    const recipientIdSet = new Set(parsedRecipientIds.map(String))
    recipientUsers.forEach((recipientUser) => recipientIdSet.add(String(recipientUser._id)))
    mentionedUsers.forEach((mentionedUser) => recipientIdSet.add(String(mentionedUser._id)))
    const recipientNameSet = new Set(parsedRecipientNames)
    recipientUsers.forEach((recipientUser) => {
      if (recipientUser.name) recipientNameSet.add(String(recipientUser.name))
    })
    mentionedUsers.forEach((mentionedUser) => {
      if (mentionedUser.name) recipientNameSet.add(String(mentionedUser.name))
    })

    const message = await Message.create({
      type: safeType,
      room: String(room || (safeType === 'group' ? `${resolvedDepartment || 'general'} updates` : 'Direct Message')).trim(),
      department: resolvedDepartment,
      senderId: req.user._id,
      senderName: req.user.name,
      recipientIds: Array.from(recipientIdSet),
      recipientNames: Array.from(recipientNameSet),
      text: String(text).trim(),
    })

    publishRealtimeEvent({
      type: 'message.created',
      tenant: req.tenant?.key,
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
        message: message.text,
        room: message.room,
        senderId: String(req.user._id),
        senderName: String(req.user.name || ''),
        createdAt: message.createdAt,
      })
    }

    res.status(201).json({
      success: true,
      message,
      deliveredTo: Array.from(new Map([...recipientUsers, ...mentionedUsers].map((target) => [String(target._id), target])).values()).map((target) => ({
        _id: target._id,
        name: target.name,
        email: target.email,
      })),
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

module.exports = router
