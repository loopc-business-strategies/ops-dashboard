const { formatMetalsForPrompt, formatErpCustomersForPrompt } = require('../salesAiPrompts')

function buildRecommendations(crmSnapshot, erpSnapshot, marketSection) {
  const s = crmSnapshot?.summary || {}
  const bullets = []
  const hot = Number(s.hotLeads) || 0
  const overdue = Number(s.overdueFollowups) || 0
  const dueWeek = Number(s.followupsDueThisWeek) || 0
  const stalled = Number(s.stalledDeals) || 0
  const pipeline = Number(s.pipelineValueUSD) || 0
  const winRate = Number(s.winRate) || 0
  const activeLeads = Number(s.activeLeads) || 0
  const atRisk = Number(erpSnapshot?.summary?.atRiskCount) || 0

  if (overdue > 0) {
    bullets.push(`Clear **${overdue} overdue follow-up(s)** before chasing new opportunities.`)
  }
  if (dueWeek > 0) {
    bullets.push(`**${dueWeek} follow-up(s) due this week** — block calendar time to complete them.`)
  }
  if (stalled > 0) {
    bullets.push(`**${stalled} deal(s) stalled 30+ days** — review stage blockers and next actions.`)
  }
  if (atRisk > 0 && erpSnapshot?.accessLevel === 'full') {
    bullets.push(`**${atRisk} ERP customer(s) at margin risk** — prioritize relationship and exposure review.`)
  }
  if (hot > 0) {
    bullets.push(`Prioritize **${hot} hot lead(s)** — schedule calls or demos this week.`)
  }
  if (pipeline > 0 && crmSnapshot?.accessLevel === 'full' && crmSnapshot?.detail?.topOpenDeals?.length) {
    const top = crmSnapshot.detail.topOpenDeals[0]
    bullets.push(`Focus on largest open deal: **${top.title}** (${top.stage}, $${top.valueUSD || 0}).`)
  } else if (pipeline > 0) {
    bullets.push(`Pipeline value is **$${pipeline.toLocaleString()}** — review highest-value open stages in Sales CRM.`)
  }
  if (activeLeads > 0 && hot === 0) {
    bullets.push(`**${activeLeads} active lead(s)** with no hot temperature — qualify and update lead scores.`)
  }
  if (winRate > 0 && winRate < 30) {
    bullets.push(`Win rate is **${winRate}%** — review lost deals and tighten qualification criteria.`)
  }
  if ((marketSection?.sources || []).length > 0) {
    bullets.push('Review cited market sources below before pricing or inventory decisions.')
  }
  if (!bullets.length) {
    bullets.push('Log new leads and deals in CRM so future briefings can surface priorities.')
  }
  return bullets.slice(0, 5)
}

function buildRisks(crmSnapshot, erpSnapshot, marketSection) {
  const s = crmSnapshot?.summary || {}
  const risks = []
  if ((Number(s.overdueFollowups) || 0) > 0) {
    risks.push('Overdue CRM follow-ups may stall pipeline momentum.')
  }
  if ((Number(s.stalledDeals) || 0) > 0) {
    risks.push('Stalled deals may indicate pricing, qualification, or delivery blockers.')
  }
  if ((erpSnapshot?.summary?.atRiskCount || 0) > 0) {
    risks.push('Customer margin exposure may limit new order capacity.')
  }
  if (!(marketSection?.sources || []).length) {
    risks.push('No external web sources were retrieved — market section may be incomplete.')
  }
  if (crmSnapshot?.accessLevel !== 'full') {
    risks.push('Deal-level detail is limited for your role — sales heads see fuller pipeline names.')
  }
  return risks
}

function formatMarketForReply(marketSection) {
  const sources = marketSection?.sources || []
  if (!sources.length) {
    return String(marketSection?.content || 'No web research results available.')
  }
  const lines = sources.slice(0, 8).map((src) => `- [${src.title}](${src.url})`)
  const content = String(marketSection?.content || '')
  const excerpt = content.split('\n').filter((l) => l.trim() && !l.startsWith('###')).slice(0, 6).join('\n')
  return [excerpt, '', '**Sources:**', ...lines].filter(Boolean).join('\n')
}

function formatCrmForReply(crmSnapshot) {
  const s = crmSnapshot?.summary || {}
  const lines = [
    `- Pipeline value: **$${(s.pipelineValueUSD ?? 0).toLocaleString()}**`,
    `- Active leads: **${s.activeLeads ?? 0}** | Hot leads: **${s.hotLeads ?? 0}**`,
    `- Win rate: **${s.winRate ?? 0}%** | Revenue this month: **$${(s.revenueThisMonthUSD ?? 0).toLocaleString()}**`,
    `- Overdue follow-ups: **${s.overdueFollowups ?? 0}** | Due this week: **${s.followupsDueThisWeek ?? 0}**`,
    `- Stalled deals (30+ days): **${s.stalledDeals ?? 0}** | Contacts: **${s.totalContacts ?? 0}**`,
  ]
  if (crmSnapshot?.funnel?.length) {
    lines.push('', '**Lead funnel:**')
    crmSnapshot.funnel.slice(0, 6).forEach((f) => lines.push(`- ${f.stage}: ${f.count}`))
  }
  if (crmSnapshot?.accessLevel === 'full' && crmSnapshot?.detail) {
    const deals = crmSnapshot.detail.topOpenDeals || []
    const leads = crmSnapshot.detail.recentLeads || []
    const followups = crmSnapshot.detail.upcomingFollowups || []
    if (deals.length) {
      lines.push('', '**Top open deals:**')
      deals.forEach((d) => lines.push(`- ${d.title} — ${d.stage}, $${d.valueUSD || 0}${d.daysInStage != null ? ` (${d.daysInStage}d)` : ''}`))
    }
    if (leads.length) {
      lines.push('', '**Recent leads:**')
      leads.forEach((l) => lines.push(`- ${l.title} — ${l.temperature || 'n/a'}, ${l.companyName || ''}`))
    }
    if (followups.length) {
      lines.push('', '**Upcoming follow-ups:**')
      followups.forEach((f) => lines.push(`- ${f.subject} — due ${f.dueDate || 'n/a'}`))
    }
  }
  return lines.join('\n')
}

function formatErpForReply(erpSnapshot) {
  if (!erpSnapshot || erpSnapshot.accessLevel === 'none') {
    return '_ERP customer exposure not available for your role._'
  }
  return formatErpCustomersForPrompt(erpSnapshot)
}

function runTemplateStrategyAgent({
  userMessage,
  marketSection,
  crmSnapshot,
  erpSnapshot,
  businessProfileText,
  metalRates,
  fallbackReason = 'unavailable',
}) {
  const recommendations = buildRecommendations(crmSnapshot, erpSnapshot, marketSection)
  const risks = buildRisks(crmSnapshot, erpSnapshot, marketSection)
  const metalsText = formatMetalsForPrompt(metalRates)
  const s = crmSnapshot?.summary || {}
  const sourceCount = (marketSection?.sources || []).length

  const summaryParts = []
  if (sourceCount) summaryParts.push(`${sourceCount} external source(s) found`)
  if (s.pipelineValueUSD) summaryParts.push(`pipeline at $${Number(s.pipelineValueUSD).toLocaleString()}`)
  if (s.hotLeads) summaryParts.push(`${s.hotLeads} hot lead(s)`)
  if (erpSnapshot?.summary?.atRiskCount) summaryParts.push(`${erpSnapshot.summary.atRiskCount} customer(s) at risk`)
  const execSummary = summaryParts.length
    ? `Briefing for: "${String(userMessage || '').slice(0, 120)}". ${summaryParts.join('; ')}.`
    : `Briefing for: "${String(userMessage || '').slice(0, 120)}".`

  const modeNote = fallbackReason === 'disabled'
    ? '_Template mode — OpenAI synthesis is off._'
    : '_Template mode — full AI synthesis unavailable (add OpenAI credits for richer briefings)._'

  const profileBlock = businessProfileText
    ? ['## Business profile', businessProfileText, '']
    : []

  const reply = [
    modeNote,
    '',
    '## Executive summary',
    execSummary,
    '',
    '## Market & industry',
    formatMarketForReply(marketSection),
    '',
    ...profileBlock,
    '## LoopC CRM',
    formatCrmForReply(crmSnapshot),
    '',
    '## Customer exposure (ERP)',
    formatErpForReply(erpSnapshot),
    '',
    '## Live metal rates',
    metalsText,
    '',
    '## Recommendations',
    ...recommendations.map((b) => `- ${b}`),
    '',
    risks.length ? '## Risks / watchouts' : '',
    ...risks.map((r) => `- ${r}`),
  ].filter((block) => block !== '').join('\n')

  return {
    agent: 'strategy',
    title: 'Recommendations',
    reply,
    sections: [],
    meta: { model: 'template', synthesisMode: 'template', fallbackReason },
  }
}

function isOpenAiQuotaError(err) {
  const msg = String(err?.message || err || '')
  return /429|insufficient_quota|quota|billing/i.test(msg)
}

module.exports = {
  runTemplateStrategyAgent,
  buildRecommendations,
  isOpenAiQuotaError,
}
