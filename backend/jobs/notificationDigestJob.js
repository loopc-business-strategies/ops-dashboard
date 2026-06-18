const Task = require('../models/Task')
const User = require('../models/User')
const Vendor = require('../models/Vendor')
const { forEachConfiguredTenantTaskDb } = require('./tenantTaskSweep')
const { notifyUsers, notifyErpUsers } = require('../services/notificationDispatch')
const { buildReportDigestText } = require('../services/reportDigestService')
const { mergeNotificationPreferences } = require('../services/notificationPreferences')

const HOURLY_MS = 60 * 60 * 1000
const _DAILY_MS = 24 * 60 * 60 * 1000

const sentDailyKeys = new Set()

function dayKey(tenant, category) {
  const d = new Date()
  return `${tenant}:${category}:${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function markSentOnce(key) {
  if (sentDailyKeys.has(key)) return false
  sentDailyKeys.add(key)
  if (sentDailyKeys.size > 5000) sentDailyKeys.clear()
  return true
}

async function sweepTaskDueOverdue(tenantKey) {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  const dueToday = await Task.find({
    isDeleted: { $ne: true },
    archivedAt: null,
    dueDate: { $gte: start, $lte: end },
    status: { $nin: ['done', 'completed', 'cancelled'] },
  }).select('_id title assignedToId assignedToIds').limit(100).lean()

  for (const task of dueToday) {
    const key = dayKey(tenantKey, `task_due:${task._id}`)
    if (!markSentOnce(key)) continue
    const recipients = [
      task.assignedToId,
      ...(task.assignedToIds || []),
    ].map((id) => String(id)).filter(Boolean)
    await notifyUsers(tenantKey, recipients, 'task_due', {
      taskId: String(task._id),
      title: task.title,
      message: `Task due today: ${task.title}`,
    })
  }

  const overdue = await Task.find({
    isDeleted: { $ne: true },
    archivedAt: null,
    dueDate: { $lt: start },
    status: { $nin: ['done', 'completed', 'cancelled'] },
  }).select('_id title assignedToId assignedToIds').limit(100).lean()

  for (const task of overdue) {
    const key = dayKey(tenantKey, `task_overdue:${task._id}`)
    if (!markSentOnce(key)) continue
    const recipients = [
      task.assignedToId,
      ...(task.assignedToIds || []),
    ].map((id) => String(id)).filter(Boolean)
    await notifyUsers(tenantKey, recipients, 'task_overdue', {
      taskId: String(task._id),
      title: task.title,
      message: `Task overdue: ${task.title}`,
    })
  }
}

async function sweepVendorDueOverdue(tenantKey) {
  const vendors = await Vendor.find({ deletedAt: null, isActive: { $ne: false } })
    .select('name paymentDueDate alertLevel')
    .limit(200)
    .lean()

  const now = new Date()
  for (const vendor of vendors) {
    if (!vendor.paymentDueDate) continue
    const due = new Date(vendor.paymentDueDate)
    const days = Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    const level = String(vendor.alertLevel || '').toLowerCase()
    let type = null
    if (level === 'overdue' || days < 0) type = 'vendor_overdue'
    else if (level === 'due_soon' || (days >= 0 && days <= 7)) type = 'vendor_due'
    if (!type) continue

    const key = dayKey(tenantKey, `${type}:${vendor._id}`)
    if (!markSentOnce(key)) continue
    await notifyErpUsers(tenantKey, type, {
      vendorName: vendor.name,
      dueDate: vendor.paymentDueDate,
      message: type === 'vendor_overdue'
        ? `Vendor overdue: ${vendor.name}`
        : `Vendor payment due soon: ${vendor.name}`,
    })
  }
}

function localHourMinute(timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || 'Africa/Johannesburg',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date())
    const hour = parts.find((p) => p.type === 'hour')?.value || '00'
    const minute = parts.find((p) => p.type === 'minute')?.value || '00'
    return `${hour}:${minute}`
  } catch {
    return null
  }
}

async function sweepScheduledReportDigests(tenantKey) {
  const TenantUser = await User.getTenantModel(tenantKey)
  const users = await TenantUser.find({ isDeleted: { $ne: true }, isActive: { $ne: false } })
    .select('_id timezone notificationPreferences')
    .lean()

  for (const user of users) {
    const prefs = mergeNotificationPreferences(user.notificationPreferences)
    if (!prefs.reportDigest.enabled) continue
    const want = String(prefs.reportDigest.timeLocal || '08:00').slice(0, 5)
    const nowLocal = localHourMinute(user.timezone)
    if (!nowLocal || nowLocal !== want) continue

    const key = dayKey(tenantKey, `report_digest:${user._id}`)
    if (!markSentOnce(key)) continue

    const text = await buildReportDigestText(tenantKey, prefs)
    await notifyUsers(tenantKey, [String(user._id)], 'report_digest', {
      message: text,
      title: 'MG Ops daily report',
    })
  }
}

async function sweepTenantNotifications(tenantKey) {
  await sweepTaskDueOverdue(tenantKey)
  await sweepVendorDueOverdue(tenantKey)
  await sweepScheduledReportDigests(tenantKey)
}

async function runNotificationDigestSweep() {
  try {
    await forEachConfiguredTenantTaskDb((tenantKey) => sweepTenantNotifications(tenantKey))
  } catch (e) {
    console.warn('[notificationDigestJob]', e.message)
  }
}

function startNotificationDigestJob() {
  if (String(process.env.NOTIFICATION_DIGEST_JOB || 'true').toLowerCase() === 'false') return () => {}
  const id = setInterval(runNotificationDigestSweep, HOURLY_MS)
  setTimeout(runNotificationDigestSweep, 15_000)
  return () => clearInterval(id)
}

module.exports = { startNotificationDigestJob, runNotificationDigestSweep }
