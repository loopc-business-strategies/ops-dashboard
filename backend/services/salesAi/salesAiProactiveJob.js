const User = require('../models/User')
const { getAllowedTenants } = require('./salesAiAccess')
const { isAutoEnabledForTenant, isProactiveJobEnabled, loadTenantAutoSettings } = require('./salesAiConfig')
const { gatherAutomationFacts, buildRulesFromFacts } = require('./agent/rulesEngine')
const { executeAutoActions } = require('./agent/autoExecutor')
const { upsertProposals } = require('./agent/actionProposals')
const { buildMetalRatesSnapshot } = require('./metalRatesSnapshot')
const { buildSalesAiBriefing } = require('./salesAiBriefing')
const { notifyUsers } = require('../notificationDispatch')
const { listSalesUserIds } = require('./agent/autoExecutor')
const { fetchRecentInbox, getConnectionStatus } = require('../email/emailInboxService')
const { forEachConfiguredTenantTaskDb } = require('../jobs/tenantTaskSweep')
const { setOnce } = require('../utils/sharedCoordination')

const lastMetalByTenant = new Map()

function dayKey(tenant, category) {
  const d = new Date()
  return `sales-ai:${tenant}:${category}:${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

async function resolveSystemUser(tenant) {
  const TenantUser = await User.getTenantModel(tenant)
  const admin = await TenantUser.findOne({ role: 'super_admin', isDeleted: { $ne: true } }).select('_id name').lean()
  if (admin) return admin
  return TenantUser.findOne({ isDeleted: { $ne: true } }).select('_id name').lean()
}

async function pollTenantInbox(tenant) {
  const systemUser = await resolveSystemUser(tenant)
  if (!systemUser) return { messages: [], connected: false }

  const status = await getConnectionStatus({ _id: systemUser._id, company: tenant, role: 'super_admin' }, tenant)
  if (!status.connected) return { messages: [], connected: false }

  try {
    const inbox = await fetchRecentInbox(
      { _id: systemUser._id, company: tenant, role: 'super_admin' },
      { tenantKey: tenant, query: 'newer_than:7d', maxResults: 30, userMessage: 'proactive scan' },
    )
    return { messages: inbox.messages || [], connected: true, email: inbox.email }
  } catch (err) {
    if (err.statusCode === 429) return { messages: [], connected: true, rateLimited: true }
    console.warn(`[salesAiProactive] inbox ${tenant}:`, err.message)
    return { messages: [], connected: false }
  }
}

async function runAutomationSweepForTenant(tenantKey, options = {}) {
  if (!getAllowedTenants().includes(tenantKey)) return { skipped: true, reason: 'not_allowed' }
  await loadTenantAutoSettings(tenantKey)
  if (!isAutoEnabledForTenant(tenantKey)) return { skipped: true, reason: 'auto_disabled' }

  const systemUser = await resolveSystemUser(tenantKey)
  const inbox = await pollTenantInbox(tenantKey)
  const metalRates = await buildMetalRatesSnapshot()
  const prevMetal = lastMetalByTenant.get(tenantKey)
  lastMetalByTenant.set(tenantKey, metalRates)

  const facts = await gatherAutomationFacts({
    emailMessages: inbox.messages,
    metalRates,
    previousMetalRates: prevMetal,
  })

  const { tier1, tier2 } = buildRulesFromFacts(facts)

  const autoResults = await executeAutoActions(tenantKey, tier1, {
    source: options.source || 'proactive',
    systemUserId: systemUser?._id,
  })

  const proposals = await upsertProposals(tenantKey, tier2, { source: options.source || 'proactive' })

  return {
    tenant: tenantKey,
    autoResults,
    proposalCount: proposals.length,
    facts: {
      overdue: facts.overdueActivities.length,
      staleDeals: facts.staleDeals.length,
      salesInbox: facts.salesInboxMessages.length,
      hotLeads: facts.hotLeads.length,
    },
  }
}

async function sendMorningDigestForTenant(tenantKey) {
  const key = dayKey(tenantKey, 'morning_digest')
  if (!(await setOnce(key, 25 * 60 * 60 * 1000))) return { sent: false, reason: 'already_sent' }

  const systemUser = await resolveSystemUser(tenantKey)
  if (!systemUser) return { sent: false, reason: 'no_user' }

  const briefing = await buildSalesAiBriefing({ _id: systemUser._id, company: tenantKey, name: systemUser.name })
  const summary = briefing.crm?.summary || {}
  const lines = [
    'Sales Manager AI — morning digest',
    `Pipeline: $${summary.pipelineValueUSD || 0} | Overdue follow-ups: ${summary.overdueFollowups || 0}`,
    `Hot leads: ${summary.hotLeads || 0} | Gold: $${briefing.metals?.goldPrice || '—'}`,
  ]
  if (briefing.suggestions?.length) {
    lines.push(`Top suggestion: ${briefing.suggestions[0]}`)
  }

  const userIds = await listSalesUserIds(tenantKey)
  const result = await notifyUsers(tenantKey, userIds, 'sales_ai_alert', {
    title: 'Morning sales digest',
    message: lines.join('\n'),
    digest: true,
  })
  return { sent: result.sent > 0, notify: result }
}

async function runProactiveSweep() {
  const results = []
  await forEachConfiguredTenantTaskDb(async (tenantKey) => {
    if (!getAllowedTenants().includes(tenantKey)) return
    try {
      const sweep = await runAutomationSweepForTenant(tenantKey)
      results.push(sweep)

      const hour = new Date().getHours()
      if (hour >= 7 && hour <= 9) {
        await sendMorningDigestForTenant(tenantKey)
      }
    } catch (err) {
      console.warn(`[salesAiProactive] sweep ${tenantKey}:`, err.message)
      results.push({ tenant: tenantKey, error: err.message })
    }
  })
  return results
}

function startSalesAiProactiveJob() {
  if (!isProactiveJobEnabled()) return () => {}
  const intervalMs = Number(process.env.SALES_AI_PROACTIVE_INTERVAL_MS || 900_000)

  const tick = () => {
    runProactiveSweep().catch((err) => {
      console.warn('[salesAiProactive] sweep failed:', err.message)
    })
  }

  const id = setInterval(tick, intervalMs)
  setTimeout(tick, 30_000)
  console.log(`[salesAiProactive] started (interval ${intervalMs}ms)`)
  return () => clearInterval(id)
}

module.exports = {
  startSalesAiProactiveJob,
  runProactiveSweep,
  runAutomationSweepForTenant,
  sendMorningDigestForTenant,
}
