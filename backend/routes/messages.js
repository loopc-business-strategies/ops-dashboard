const express = require('express')
const { protect } = require('../middleware/auth')
const Message = require('../models/Message')

const router = express.Router()

const normalize = (value = '') => String(value).trim().toLowerCase()
const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const canSeeEverything = (user) => user?.role === 'super_admin' || user?.role === 'management'

const buildMessageScope = (user) => {
  if (canSeeEverything(user)) return {}

  const dept = normalize(user?.department)
  const or = [
    { senderId: user._id },
    { recipientIds: user._id },
    { recipientNames: new RegExp(`^${escapeRegex(user.name)}$`, 'i') },
    { room: 'All Departments' },
  ]

  if (dept) {
    or.push({ department: new RegExp(`^${escapeRegex(dept)}$`, 'i') })
  }

  return { $or: or }
}

router.get('/latest', protect, async (req, res) => {
  try {
    const { type = 'all', limit = 20 } = req.query
    const query = buildMessageScope(req.user)

    if (type !== 'all') {
      query.type = String(type)
    }

    const messages = await Message.find(query).sort({ createdAt: -1 }).limit(Number(limit) || 20)

    res.json({ success: true, count: messages.length, messages })
  } catch {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.post('/', protect, async (req, res) => {
  try {
    const { type = 'group', room = '', text = '', department = '', recipientIds = [], recipientNames = [] } = req.body

    if (!text || !String(text).trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required.' })
    }

    const safeType = ['group', 'dm'].includes(String(type)) ? String(type) : 'group'

    const resolvedDepartment = safeType === 'group'
      ? (canSeeEverything(req.user) ? normalize(department || req.user.department || 'management') : normalize(req.user.department))
      : normalize(department || req.user.department)

    const parsedRecipientIds = Array.isArray(recipientIds) ? recipientIds.filter(Boolean) : []
    const parsedRecipientNames = Array.isArray(recipientNames) ? recipientNames.filter(Boolean).map(String) : []

    const message = await Message.create({
      type: safeType,
      room: String(room || (safeType === 'group' ? `${resolvedDepartment || 'general'} updates` : 'Direct Message')).trim(),
      department: resolvedDepartment,
      senderId: req.user._id,
      senderName: req.user.name,
      recipientIds: parsedRecipientIds,
      recipientNames: parsedRecipientNames,
      text: String(text).trim(),
    })

    res.status(201).json({ success: true, message })
  } catch {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

module.exports = router
