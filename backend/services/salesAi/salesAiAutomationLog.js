const SalesAiAutomationLog = require('../../models/SalesAiAutomationLog')

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

async function listAutomationLog(tenant, { limit = 30, since } = {}) {
  const filter = { tenant }
  if (since) filter.createdAt = { $gte: since }
  return SalesAiAutomationLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()
}

async function countAutomationToday(tenant) {
  return SalesAiAutomationLog.countDocuments({
    tenant,
    tier: 'auto',
    status: 'completed',
    createdAt: { $gte: startOfToday() },
  })
}

async function getAutomationSummary(tenant) {
  const [todayCount, recent] = await Promise.all([
    countAutomationToday(tenant),
    listAutomationLog(tenant, { limit: 8, since: startOfToday() }),
  ])
  return {
    todayCount,
    recent: recent.map((r) => ({
      id: String(r._id),
      actionType: r.actionType,
      tier: r.tier,
      status: r.status,
      title: r.title,
      detail: r.detail,
      source: r.source,
      createdAt: r.createdAt,
    })),
  }
}

module.exports = {
  listAutomationLog,
  countAutomationToday,
  getAutomationSummary,
  startOfToday,
}
