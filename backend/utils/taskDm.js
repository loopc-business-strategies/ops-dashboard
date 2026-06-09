// Shared helpers for task-related DM notifications (used by routes/tasks and background jobs).

const Message = require('../models/Message')
const { normalize } = require('../services/permissions/moduleAccessPolicy')
const { publishRealtimeEvent } = require('./realtimeBus')

const taskMessageRecipients = ({ assignedToId, assignedToIds, assignedTo, alsoNotifyIds = [], alsoNotifyNames = [] }) => {
  const ids = Array.isArray(alsoNotifyIds) ? [...alsoNotifyIds] : []
  const names = Array.isArray(alsoNotifyNames) ? [...alsoNotifyNames] : []

  const assigneeIds = Array.isArray(assignedToIds) && assignedToIds.length
    ? assignedToIds
    : assignedToId
      ? [assignedToId]
      : []
  for (const id of assigneeIds) {
    if (id) ids.push(id)
  }
  if (assignedTo) names.push(assignedTo)

  return {
    recipientIds: Array.from(new Set(ids.filter(Boolean).map(String))),
    recipientNames: Array.from(new Set(names.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))),
  }
}

/**
 * @param {string} [tenantKey] – mg / cg / loopc (or `default`); drives SSE `message.created` for Chat
 */
const createTaskMessage = async (user, task, text, recipients, tenantKey = 'default') => {
  if (!text || !String(text).trim()) return
  if (!recipients.recipientIds.length && !recipients.recipientNames.length) return
  if (!user?._id) return

  const message = await Message.create({
    type: 'dm',
    room: `Task: ${task.title}`,
    department: normalize(task.department),
    senderId: user._id,
    senderName: user.name || 'System',
    recipientIds: recipients.recipientIds,
    recipientNames: recipients.recipientNames,
    text: String(text).trim(),
  })

  const tenant = String(tenantKey || 'default').trim().toLowerCase() || 'default'
  publishRealtimeEvent({
    type: 'message.created',
    tenant,
    data: {
      id: message._id,
      room: message.room,
      type: message.type,
      senderName: message.senderName,
      createdAt: message.createdAt,
      recipientIds: (message.recipientIds || []).map(String),
    },
  })
}

module.exports = { taskMessageRecipients, createTaskMessage }
