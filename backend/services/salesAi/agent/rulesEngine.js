const CrmActivity = require('../../../models/CrmActivity')
const CrmDeal = require('../../../models/CrmDeal')
const CrmLead = require('../../../models/CrmLead')
const { SALES_KEYWORDS } = require('../agents/emailAnalysis')
const { getStaleDealDays, getInboxFollowupHours } = require('../salesAiConfig')

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function hoursAgo(n) {
  const d = new Date()
  d.setHours(d.getHours() - n)
  return d
}

function dueTomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(17, 0, 0, 0)
  return d
}

async function findOverdueActivities() {
  const now = new Date()
  return CrmActivity.find({
    isDeleted: false,
    'nextAction.isDone': false,
    'nextAction.dueDate': { $lt: now },
  })
    .sort({ 'nextAction.dueDate': 1 })
    .limit(20)
    .lean()
}

async function findStaleDeals() {
  const cutoff = daysAgo(getStaleDealDays())
  return CrmDeal.find({
    isDeleted: false,
    stage: { $nin: ['Closed Won', 'Closed Lost'] },
    updatedAt: { $lt: cutoff },
    $or: [
      { 'nextAction.isDone': { $ne: true } },
      { 'nextAction.description': { $exists: false } },
      { 'nextAction.description': '' },
    ],
  })
    .sort({ updatedAt: 1 })
    .limit(15)
    .lean()
}

async function findHotLeads() {
  return CrmLead.find({
    isDeleted: false,
    temperature: { $in: ['Hot', 'Very Hot'] },
    stage: { $nin: ['Closed Won', 'Closed Lost'] },
  })
    .sort({ updatedAt: -1 })
    .limit(10)
    .lean()
}

function findSalesInboxMessages(messages = []) {
  const cutoff = hoursAgo(getInboxFollowupHours())
  return (messages || []).filter((m) => {
    const text = `${m.subject || ''} ${m.snippet || ''}`
    if (!SALES_KEYWORDS.test(text)) return false
    const date = m.date ? new Date(m.date) : null
    if (date && date > cutoff) return true
    return !m.isRead
  })
}

function buildRulesFromFacts(facts = {}) {
  const tier1 = []
  const tier2 = []

  for (const act of facts.overdueActivities || []) {
    tier1.push({
      actionType: 'crm_create_followup',
      dedupeKey: `overdue-activity:${act._id}`,
      title: `Follow up: ${act.subject || act.contactName || 'CRM activity'}`,
      detail: act.nextAction?.description || 'Overdue follow-up',
      payload: {
        trigger: 'overdue_activity',
        activityId: String(act._id),
        contactName: act.contactName,
        dealId: act.dealId ? String(act.dealId) : undefined,
        dealName: act.dealName,
        subject: `Follow up: ${act.subject || act.contactName || 'activity'}`,
        notes: `Sales AI auto: overdue follow-up from ${act.subject || 'activity'}.`,
      },
    })
  }

  for (const deal of facts.staleDeals || []) {
    tier1.push({
      actionType: 'crm_create_followup',
      dedupeKey: `stale-deal:${deal._id}`,
      title: `Re-engage stale deal: ${deal.name}`,
      detail: `No activity in ${getStaleDealDays()}+ days`,
      payload: {
        trigger: 'stale_deal',
        dealId: String(deal._id),
        dealName: deal.name,
        contactName: deal.contactName,
        subject: `Re-engage: ${deal.name}`,
        notes: `Sales AI auto: deal stale ${getStaleDealDays()}+ days at stage ${deal.stage}.`,
      },
    })
  }

  for (const msg of facts.salesInboxMessages || []) {
    const subject = msg.subject || '(no subject)'
    tier1.push({
      actionType: 'crm_create_followup',
      dedupeKey: `inbox-sales:${msg.id || msg.messageId || subject}`,
      title: `Reply needed: ${subject}`,
      detail: `From ${msg.from || 'unknown sender'}`,
      payload: {
        trigger: 'sales_inbox',
        messageId: msg.id || msg.messageId,
        from: msg.from,
        subject,
        notes: `Sales AI auto: sales-related inbox message needs reply.`,
      },
    })
    tier2.push({
      actionType: 'email_reply_draft',
      dedupeKey: `email-draft:${msg.id || msg.messageId || subject}`,
      title: `Draft reply: ${subject}`,
      summary: `Customer email from ${msg.from || 'sender'} — approve before sending.`,
      payload: {
        to: msg.from,
        subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
        body: `Hi,\n\nThank you for your message regarding "${subject}".\n\n[Review and edit before sending]\n\nBest regards,\nLoopC Sales Team`,
        mailto: true,
        originalSnippet: msg.snippet,
      },
    })
  }

  for (const lead of facts.hotLeads || []) {
    tier1.push({
      actionType: 'notify_users',
      dedupeKey: `hot-lead:${lead._id}`,
      title: `Hot lead: ${lead.companyName || lead.contactName || 'Lead'}`,
      detail: `Temperature: ${lead.temperature}`,
      payload: {
        trigger: 'hot_lead',
        leadId: String(lead._id),
        message: `Hot lead needs attention: ${lead.companyName || lead.contactName || 'Lead'} (${lead.temperature})`,
      },
    })
  }

  if (facts.metalAlert) {
    tier1.push({
      actionType: 'notify_users',
      dedupeKey: `metal-alert:${facts.metalAlert.dayKey}`,
      title: facts.metalAlert.title,
      detail: facts.metalAlert.detail,
      payload: {
        trigger: 'metal_alert',
        message: facts.metalAlert.message,
      },
    })
  }

  return { tier1, tier2 }
}

async function gatherAutomationFacts({ emailMessages = [], metalRates = null, previousMetalRates = null } = {}) {
  const [overdueActivities, staleDeals, hotLeads] = await Promise.all([
    findOverdueActivities(),
    findStaleDeals(),
    findHotLeads(),
  ])

  const salesInboxMessages = findSalesInboxMessages(emailMessages)

  let metalAlert = null
  if (metalRates?.goldPrice && previousMetalRates?.goldPrice) {
    const prev = Number(previousMetalRates.goldPrice)
    const curr = Number(metalRates.goldPrice)
    if (prev > 0) {
      const pct = ((curr - prev) / prev) * 100
      if (Math.abs(pct) >= 2) {
        const d = new Date()
        metalAlert = {
          dayKey: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`,
          title: `Gold price ${pct > 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(1)}%`,
          detail: `$${curr.toFixed(2)} vs $${prev.toFixed(2)}`,
          message: `Gold moved ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% — review pricing and pipeline.`,
        }
      }
    }
  }

  return {
    overdueActivities,
    staleDeals,
    hotLeads,
    salesInboxMessages,
    metalAlert,
  }
}

module.exports = {
  gatherAutomationFacts,
  buildRulesFromFacts,
  findOverdueActivities,
  findStaleDeals,
  dueTomorrow,
}
