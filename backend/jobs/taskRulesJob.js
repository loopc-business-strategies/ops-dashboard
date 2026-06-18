const Task = require('../models/Task')
const User = require('../models/User')
const { publishRealtimeEvent } = require('../utils/realtimeBus')
const { emitTaskWebhook } = require('../utils/taskWebhooks')
const { taskMessageRecipients, createTaskMessage } = require('../utils/taskDm')
const { forEachConfiguredTenantTaskDb } = require('./tenantTaskSweep')

const DEFAULT_INTERVAL_MS = 600_000

async function resolveMessageSender(task) {
  if (task.createdById) {
    const u = await User.findById(task.createdById).select('name').lean()
    if (u) return { _id: task.createdById, name: u.name }
  }
  if (task.assignedToId) {
    const u = await User.findById(task.assignedToId).select('name').lean()
    if (u) return { _id: task.assignedToId, name: u.name }
  }
  const admin = await User.findOne({ role: 'super_admin' }).select('name').lean()
  if (admin) return admin
  return User.findOne().select('name').lean()
}

async function sweepScheduledAutoArchiveForTenant(tenantKey) {
  const now = new Date()
  const tasks = await Task.find({
    autoArchiveAt: { $lte: now, $ne: null },
    archivedAt: null,
    isDeleted: { $ne: true },
    status: { $in: ['done', 'cancelled'] },
  })
    .limit(40)
    .lean()

  for (const row of tasks) {
    const res = await Task.updateOne(
      { _id: row._id, autoArchiveAt: row.autoArchiveAt, archivedAt: null },
      { $set: { archivedAt: now, autoArchiveAt: null } }
    )
    if (!res.modifiedCount) continue

    emitTaskWebhook('task.auto_archived', {
      taskId: String(row._id),
      title: row.title,
      department: row.department,
    })
    publishRealtimeEvent({
      type: 'task.updated',
      tenant: tenantKey,
      data: { id: row._id, title: row.title, autoArchived: true },
    })
  }
}

async function sweepDueProximityForTenant(tenantKey) {
  const hours = Math.min(168, Math.max(1, Number(process.env.TASK_DUE_PROXIMITY_HOURS) || 48))
  const ms = hours * 3600_000
  const now = Date.now()
  const horizon = new Date(now + ms)

  const tasks = await Task.find({
    dueDate: { $gt: new Date(now), $lte: horizon },
    archivedAt: null,
    isDeleted: { $ne: true },
    status: { $nin: ['done', 'cancelled'] },
  })
    .limit(50)
    .lean()

  for (const row of tasks) {
    if (!row.dueDate) continue

    const updated = await Task.findOneAndUpdate(
      {
        _id: row._id,
        dueDate: row.dueDate,
        archivedAt: null,
        isDeleted: { $ne: true },
        status: { $nin: ['done', 'cancelled'] },
        $expr: {
          $or: [
            { $eq: [{ $ifNull: ['$dueProximityNotifiedForDue', null] }, null] },
            { $ne: ['$dueProximityNotifiedForDue', '$dueDate'] },
          ],
        },
      },
      { $set: { dueProximityNotifiedForDue: row.dueDate } },
      { returnDocument: 'after' }
    )

    if (!updated) continue

    const sender = await resolveMessageSender(updated)
    if (sender?._id) {
      const recipients = taskMessageRecipients({
        assignedToId: updated.assignedToId,
        assignedToIds: updated.assignedToIds,
        assignedTo: updated.assignedTo,
        alsoNotifyIds: (updated.alsoNotifyIds || []).map(String),
        alsoNotifyNames: updated.alsoNotifyNames || [],
      })
      const dueStr = updated.dueDate ? new Date(updated.dueDate).toISOString().slice(0, 16).replace('T', ' ') : '—'
      await createTaskMessage(
        sender,
        updated,
        `Due soon (within ${hours}h): "${updated.title}" — due ${dueStr}`,
        recipients,
        tenantKey,
      )
    }

    emitTaskWebhook('task.due_proximity', {
      taskId: String(updated._id),
      title: updated.title,
      department: updated.department,
      dueDate: updated.dueDate ? updated.dueDate.toISOString() : null,
      dueProximityHours: hours,
    })
    publishRealtimeEvent({
      type: 'task.updated',
      tenant: tenantKey,
      data: { id: updated._id, title: updated.title, dueProximity: true },
    })
  }
}

async function sweepTaskRulesOnce() {
  await forEachConfiguredTenantTaskDb(async (tenantKey) => {
    await sweepScheduledAutoArchiveForTenant(tenantKey)
    await sweepDueProximityForTenant(tenantKey)
  })
}

function startTaskRulesJob() {
  if (String(process.env.TASK_RULES_JOB || 'false').trim().toLowerCase() !== 'true') return () => {}
  const interval = Math.max(60_000, Number(process.env.TASK_RULES_INTERVAL_MS) || DEFAULT_INTERVAL_MS)
  const id = setInterval(() => {
    sweepTaskRulesOnce().catch((e) => console.warn('[taskRulesJob]', e.message))
  }, interval)
  sweepTaskRulesOnce().catch((e) => console.warn('[taskRulesJob] initial:', e.message))
  return () => clearInterval(id)
}

module.exports = { startTaskRulesJob, sweepTaskRulesOnce }
