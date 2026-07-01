const SalesAiAutomationLog = require('../../../models/SalesAiAutomationLog')
const CrmActivity = require('../../../models/CrmActivity')
const User = require('../../../models/User')
const { notifyUsers } = require('../../notificationDispatch')
const { canViewCrm } = require('../../permissions/moduleAccessPolicy')
const { dueTomorrow } = require('./rulesEngine')

async function listSalesUserIds(tenant) {
  const TenantUser = await User.getTenantModel(tenant)
  const rows = await TenantUser.find({ isDeleted: { $ne: true }, isActive: { $ne: false } })
    .select('_id role department modulePermissions')
    .lean()
  return rows.filter(canViewCrm).map((u) => String(u._id))
}

async function logAutomation(entry) {
  try {
    if (entry.dedupeKey) {
      const existing = await SalesAiAutomationLog.findOne({
        tenant: entry.tenant,
        dedupeKey: entry.dedupeKey,
      }).lean()
      if (existing) {
        return { logged: false, skipped: true, existing }
      }
    }
    const doc = await SalesAiAutomationLog.create(entry)
    return { logged: true, doc }
  } catch (err) {
    if (err?.code === 11000) return { logged: false, skipped: true }
    throw err
  }
}

async function createCrmFollowup(tenant, action, systemUserId) {
  const p = action.payload || {}
  const activity = await CrmActivity.create({
    type: 'Task',
    contactName: p.contactName || '',
    dealId: p.dealId || undefined,
    dealName: p.dealName || '',
    subject: p.subject || action.title,
    notes: p.notes || action.detail,
    outcome: 'Follow-up needed',
    nextAction: {
      description: p.subject || action.title,
      dueDate: dueTomorrow(),
      assignedTo: 'Sales team',
      isDone: false,
    },
    createdBy: systemUserId || undefined,
    createdByName: 'Sales Manager AI',
  })
  return activity
}

async function runNotifyUsers(tenant, action) {
  const userIds = await listSalesUserIds(tenant)
  const message = action.payload?.message || action.title
  return notifyUsers(tenant, userIds, 'sales_ai_alert', {
    message,
    title: action.title,
    detail: action.detail,
    source: 'sales_ai',
  })
}

async function executeAutoAction(tenant, action, options = {}) {
  const baseLog = {
    tenant,
    actionType: action.actionType,
    tier: 'auto',
    title: action.title,
    detail: action.detail,
    source: options.source || 'proactive',
    dedupeKey: action.dedupeKey || '',
    meta: action.payload || {},
  }

  try {
    let result = null
    if (action.actionType === 'crm_create_followup') {
      result = await createCrmFollowup(tenant, action, options.systemUserId)
      const logResult = await logAutomation({ ...baseLog, status: 'completed', meta: { ...baseLog.meta, activityId: String(result._id) } })
      if (logResult.skipped) return { executed: false, skipped: true, reason: 'dedupe' }
      return { executed: true, activityId: String(result._id) }
    }

    if (action.actionType === 'notify_users') {
      result = await runNotifyUsers(tenant, action)
      const logResult = await logAutomation({ ...baseLog, status: 'completed', meta: { ...baseLog.meta, notify: result } })
      if (logResult.skipped) return { executed: false, skipped: true, reason: 'dedupe' }
      return { executed: true, notify: result }
    }

    await logAutomation({ ...baseLog, status: 'skipped', detail: 'Unknown action type' })
    return { executed: false, skipped: true, reason: 'unknown_action' }
  } catch (err) {
    await logAutomation({ ...baseLog, status: 'failed', detail: err.message })
    return { executed: false, error: err.message }
  }
}

async function executeAutoActions(tenant, actions = [], options = {}) {
  const results = []
  for (const action of actions) {
    results.push({ action: action.actionType, ...(await executeAutoAction(tenant, action, options)) })
  }
  return results
}

module.exports = {
  executeAutoAction,
  executeAutoActions,
  logAutomation,
  listSalesUserIds,
}
