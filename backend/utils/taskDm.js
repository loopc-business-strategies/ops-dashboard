// Shared helpers for task-related DM notifications (used by routes/tasks and background jobs).

const Message = require('../models/Message')
const { normalize } = require('../services/permissions/moduleAccessPolicy')

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

const createTaskMessage = async (user, task, text, recipients) => {
  if (!text || !String(text).trim()) return
  if (!recipients.recipientIds.length && !recipients.recipientNames.length) return
  if (!user?._id) return

  await Message.create({
    type: 'dm',
    room: `Task: ${task.title}`,
    department: normalize(task.department),
    senderId: user._id,
    senderName: user.name || 'System',
    recipientIds: recipients.recipientIds,
    recipientNames: recipients.recipientNames,
    text: String(text).trim(),
  })
}

module.exports = { taskMessageRecipients, createTaskMessage }
