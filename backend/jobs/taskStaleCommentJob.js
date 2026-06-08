const Task = require('../models/Task')
const { publishRealtimeEvent } = require('../utils/realtimeBus')
const { emitTaskWebhook } = require('../utils/taskWebhooks')
const { forEachConfiguredTenantTaskDb } = require('./tenantTaskSweep')

const DEFAULT_STALE_MS = 7 * 24 * 60 * 60 * 1000
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000

function staleCommentText() {
  return String(process.env.TASK_STALE_COMMENT_TEXT || '').trim() || 'Marked stale by system — no recent activity on this task.'
}

function staleThresholdMs() {
  const n = Number(process.env.TASK_STALE_MS)
  return Number.isFinite(n) && n > 60_000 ? n : DEFAULT_STALE_MS
}

function lastActivityMs(task) {
  let last = task.updatedAt ? new Date(task.updatedAt).getTime() : 0
  const comments = Array.isArray(task.comments) ? task.comments : []
  for (const c of comments) {
    const t = c?.createdAt ? new Date(c.createdAt).getTime() : 0
    if (t > last) last = t
  }
  return last
}

function isTaskStale(task, thresholdMs) {
  const st = String(task.status || '').toLowerCase()
  if (st === 'done' || st === 'cancelled') return false
  if (task.archivedAt || task.isDeleted) return false
  const last = lastActivityMs(task)
  if (!last) return false
  return Date.now() - last > thresholdMs
}

async function sweepStaleCommentsForTenant(tenantKey) {
  const msg = staleCommentText()
  const thresholdMs = staleThresholdMs()

  const tasks = await Task.find({
    isDeleted: { $ne: true },
    archivedAt: null,
    status: { $nin: ['done', 'cancelled'] },
  })
    .limit(80)
    .lean()

  for (const row of tasks) {
    if (!isTaskStale(row, thresholdMs)) continue
    const comments = Array.isArray(row.comments) ? row.comments : []
    const last = comments[comments.length - 1]
    if (last && String(last.text || '').trim() === msg) continue

    const doc = await Task.findById(row._id)
    if (!doc) continue
    if (!isTaskStale(doc, thresholdMs)) continue
    const tail = doc.comments && doc.comments.length ? doc.comments[doc.comments.length - 1] : null
    if (tail && String(tail.text || '').trim() === msg) continue

    doc.comments.push({ author: 'System', text: msg })
    await doc.save()

    publishRealtimeEvent({
      type: 'task.updated',
      tenant: tenantKey,
      data: { id: doc._id, title: doc.title, staleComment: true },
    })
    emitTaskWebhook('task.stale_marked', {
      taskId: String(doc._id),
      title: doc.title,
      department: doc.department,
    })
  }
}

/**
 * Appends a single system comment on tasks with no recent activity (same rule as Ops UI stale badge).
 * Enable with TASK_STALE_COMMENT_JOB=true. Interval TASK_STALE_COMMENT_INTERVAL_MS (default 24h).
 */
async function sweepStaleCommentsOnce() {
  await forEachConfiguredTenantTaskDb((tenantKey) => sweepStaleCommentsForTenant(tenantKey))
}

function startTaskStaleCommentJob() {
  if (String(process.env.TASK_STALE_COMMENT_JOB || '').trim().toLowerCase() !== 'true') return () => {}
  const interval = Math.max(3_600_000, Number(process.env.TASK_STALE_COMMENT_INTERVAL_MS) || DEFAULT_INTERVAL_MS)
  const id = setInterval(() => {
    sweepStaleCommentsOnce().catch((e) => console.warn('[taskStaleCommentJob]', e.message))
  }, interval)
  return () => clearInterval(id)
}

module.exports = { startTaskStaleCommentJob, sweepStaleCommentsOnce }
