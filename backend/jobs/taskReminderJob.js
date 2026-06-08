const Task = require('../models/Task')
const User = require('../models/User')
const { publishRealtimeEvent } = require('../utils/realtimeBus')
const { taskMessageRecipients, createTaskMessage } = require('../utils/taskDm')
const { emitTaskWebhook } = require('../utils/taskWebhooks')
const { forEachConfiguredTenantTaskDb } = require('./tenantTaskSweep')

const INTERVAL_MS = 60_000

async function resolveReminderSender(task) {
  if (task.createdById) {
    const u = await User.findById(task.createdById).select('name').lean()
    if (u) return u
  }
  if (task.assignedToId) {
    const u = await User.findById(task.assignedToId).select('name').lean()
    if (u) return u
  }
  const admin = await User.findOne({ role: 'super_admin' }).select('name').lean()
  if (admin) return admin
  return User.findOne().select('name').lean()
}

async function sweepDueRemindersForTenant(tenantKey) {
  const now = new Date()
  const due = await Task.find({
    isDeleted: { $ne: true },
    archivedAt: null,
    reminderAt: { $lte: now, $ne: null },
  }).limit(50)

  for (const task of due) {
    const res = await Task.updateOne({ _id: task._id, reminderAt: task.reminderAt }, { $set: { reminderAt: null } })
    if (!res.modifiedCount) continue

    const sender = await resolveReminderSender(task)

    if (sender?._id) {
      const recipients = taskMessageRecipients({
        assignedToId: task.assignedToId,
        assignedToIds: task.assignedToIds,
        assignedTo: task.assignedTo,
        alsoNotifyIds: (task.alsoNotifyIds || []).map((id) => String(id)),
        alsoNotifyNames: task.alsoNotifyNames || [],
      })
      await createTaskMessage(
        { _id: sender._id, name: sender.name || 'System' },
        task,
        `Reminder: ${task.title}`,
        recipients
      )
    }

    publishRealtimeEvent({
      type: 'task.reminder_due',
      tenant: tenantKey,
      data: { id: task._id, title: task.title },
    })

    emitTaskWebhook('task.reminder_due', {
      taskId: String(task._id),
      title: task.title,
      department: task.department,
    })
  }
}

/**
 * When reminderAt is due: clears reminderAt (conditional update avoids double-send),
 * notifies assignee via the same DM path as task create/update, and emits realtime.
 * Runs once per configured tenant database.
 */
async function sweepDueReminders() {
  try {
    await forEachConfiguredTenantTaskDb((tenantKey) => sweepDueRemindersForTenant(tenantKey))
  } catch (e) {
    console.warn('[taskReminderJob]', e.message)
  }
}

function startTaskReminderJob() {
  if (String(process.env.TASK_REMINDER_JOB || 'true').toLowerCase() === 'false') return () => {}
  const id = setInterval(sweepDueReminders, INTERVAL_MS)
  return () => clearInterval(id)
}

module.exports = { startTaskReminderJob, sweepDueReminders }
