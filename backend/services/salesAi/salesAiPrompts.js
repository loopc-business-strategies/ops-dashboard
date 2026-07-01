const LOOPC_CONTEXT = `You are Sales Manager AI for LoopC — a jewelry and precious-metals B2B platform.
Focus on gold/silver/platinum markets, wholesale distribution, manufacturing partnerships, and CRM pipeline decisions.
Be concise, actionable, and honest about uncertainty. Cite external sources by title when provided.`

const REGION_KEYWORDS = {
  uzbekistan: 'Uzbekistan Central Asia',
  uae: 'UAE Dubai gold market',
  gcc: 'GCC Gulf gold jewelry',
  turkey: 'Turkey jewelry export',
  india: 'India gold jewelry demand',
  china: 'China gold demand',
}

function buildSearchQueries(userMessage, options = {}) {
  const msg = String(userMessage || '').trim()
  const base = msg.slice(0, 200)
  const region = String(options.region || '').trim().toLowerCase()
  const competitors = Array.isArray(options.competitors) ? options.competitors.filter(Boolean) : []
  const regionSuffix = REGION_KEYWORDS[region] || (region ? `${region} gold jewelry market` : '')

  const queries = [
    `${base} precious metals jewelry market trends 2025 2026${regionSuffix ? ` ${regionSuffix}` : ''}`,
    `${base} gold silver industry demand outlook${regionSuffix ? ` ${regionSuffix}` : ''}`,
  ]

  if (/competitor|rival|versus|vs\b/i.test(msg) || competitors.length) {
    const names = competitors.slice(0, 2).join(' ')
    queries.push(`${base} ${names} precious metals jewelry competitor analysis`)
  } else if (/regulat|compliance|sanction|import duty|hallmark/i.test(msg)) {
    queries.push(`${base} gold jewelry import regulations trade compliance${regionSuffix ? ` ${regionSuffix}` : ''}`)
  } else if (/pipeline|crm|deal|lead|customer/i.test(msg)) {
    queries.push(`${base} B2B sales strategy precious metals wholesale`)
  } else if (/opportunit|growth|expand/i.test(msg)) {
    queries.push(`${base} new market opportunities gold jewelry wholesale${regionSuffix ? ` ${regionSuffix}` : ''}`)
  } else if (/fx|currency|dollar|central bank|hedg/i.test(msg)) {
    queries.push(`${base} gold FX currency central bank buying outlook${regionSuffix ? ` ${regionSuffix}` : ''}`)
  } else if (/retail|wholesale|consumer|bullion/i.test(msg)) {
    queries.push(`${base} retail vs wholesale jewelry bullion demand trends`)
  } else if (/manufactur|casting|production/i.test(msg)) {
    queries.push(`${base} jewelry manufacturing trends labor costs${regionSuffix ? ` ${regionSuffix}` : ''}`)
  } else if (/esg|recycl|sustain/i.test(msg)) {
    queries.push(`${base} recycled gold conflict-free sourcing jewelry ESG`)
  } else {
    queries.push(`${base} market size growth forecast jewelry metals${regionSuffix ? ` ${regionSuffix}` : ''}`)
  }

  if (regionSuffix && !queries.some((q) => q.includes(regionSuffix))) {
    queries.push(`${base} ${regionSuffix} wholesale bullion jewelry`)
  }

  return queries
}

function formatTavilyForPrompt(searchBatches) {
  const lines = []
  const sources = []
  for (const batch of searchBatches || []) {
    if (batch.error) {
      lines.push(`Query "${batch.query}": ${batch.error}`)
      continue
    }
    lines.push(`\n### Search: ${batch.query}`)
    if (batch.answer) {
      lines.push(`Summary: ${batch.answer}`)
    }
    for (const r of batch.results || []) {
      lines.push(`- **${r.title}** (${r.url})\n  ${r.content}`)
      sources.push({ title: r.title, url: r.url })
    }
  }
  return { text: lines.join('\n'), sources }
}

function formatCrmForPrompt(crmSnapshot) {
  if (!crmSnapshot) return 'CRM data unavailable.'
  const s = crmSnapshot.summary || {}
  const lines = [
    `Pipeline value (USD): ${s.pipelineValueUSD ?? 0}`,
    `Active leads: ${s.activeLeads ?? 0}`,
    `Hot leads: ${s.hotLeads ?? 0}`,
    `Win rate: ${s.winRate ?? 0}%`,
    `Revenue this month (USD): ${s.revenueThisMonthUSD ?? 0}`,
    `Overdue follow-ups: ${s.overdueFollowups ?? 0}`,
    `Follow-ups due this week: ${s.followupsDueThisWeek ?? 0}`,
    `Stalled deals (30+ days): ${s.stalledDeals ?? 0}`,
    `Total contacts: ${s.totalContacts ?? 0}`,
  ]
  if (crmSnapshot.funnel?.length) {
    lines.push('\nLead funnel by stage:')
    crmSnapshot.funnel.forEach((f) => lines.push(`- ${f.stage}: ${f.count}`))
  }
  if (crmSnapshot.accessLevel === 'full' && crmSnapshot.detail) {
    const deals = crmSnapshot.detail.topOpenDeals || []
    const leads = crmSnapshot.detail.recentLeads || []
    const followups = crmSnapshot.detail.upcomingFollowups || []
    if (deals.length) {
      lines.push('\nTop open deals:')
      deals.forEach((d) => lines.push(`- ${d.title} | ${d.stage} | $${d.valueUSD || 0}${d.daysInStage != null ? ` | ${d.daysInStage}d in stage` : ''}`))
    }
    if (leads.length) {
      lines.push('\nRecent leads:')
      leads.forEach((l) => lines.push(`- ${l.title} | ${l.temperature || ''} | ${l.companyName || ''}`))
    }
    if (followups.length) {
      lines.push('\nUpcoming follow-ups:')
      followups.forEach((f) => lines.push(`- ${f.subject} | due ${f.dueDate || 'n/a'} | ${f.assignedTo || ''}`))
    }
  } else if (crmSnapshot.accessLevel === 'aggregate') {
    lines.push('\n(Detailed deal/lead names hidden — user does not have Sales CRM access.)')
  }
  return lines.join('\n')
}

function formatErpCustomersForPrompt(erpSnapshot) {
  if (!erpSnapshot || erpSnapshot.accessLevel === 'none') {
    return 'ERP customer exposure not available for your role.'
  }
  const s = erpSnapshot.summary || {}
  const lines = [
    `Active ERP customers sampled: ${s.activeCustomers ?? 0}`,
    `Accounts at margin risk: ${s.atRiskCount ?? 0}`,
  ]
  if (s.metalRates) {
    lines.push(`Rates used: Gold ${s.metalRates.goldPrice} / Silver ${s.metalRates.silverPrice}`)
  }
  const top = erpSnapshot.topCustomers || []
  if (top.length) {
    lines.push('\nTop exposure customers:')
    top.forEach((c) => {
      lines.push(`- ${c.name} | outstanding $${c.outstandingUSD} | margin ${c.marginStatus} (${c.marginPercent}%) | Au ${c.goldPosition}g Ag ${c.silverPosition}g`)
    })
  }
  return lines.join('\n')
}

function formatMetalsForPrompt(metals) {
  if (!metals) return 'Live metal rates unavailable.'
  return [
    `Gold: ${metals.goldPrice} ${metals.priceCurrency}/${metals.priceUnit}`,
    `Silver: ${metals.silverPrice} ${metals.priceCurrency}/${metals.priceUnit}`,
    metals.platinumPrice ? `Platinum: ${metals.platinumPrice} ${metals.priceCurrency}/${metals.priceUnit}` : null,
    `Source: ${metals.source}`,
    metals.updatedAt ? `Updated: ${new Date(metals.updatedAt).toISOString()}` : null,
  ].filter(Boolean).join('\n')
}

function formatChatInputsForPrompt(inputs = {}) {
  const lines = []
  if (inputs.region) lines.push(`Focus region: ${inputs.region}`)
  if (inputs.horizon) lines.push(`Time horizon: ${inputs.horizon}`)
  if (inputs.priority) lines.push(`Priority: ${inputs.priority}`)
  if (inputs.constraints) lines.push(`Constraints: ${inputs.constraints}`)
  if (inputs.customerId || inputs.dealId) {
    lines.push(`Scope: customer=${inputs.customerId || 'n/a'} deal=${inputs.dealId || 'n/a'}`)
  }
  return lines.join('\n')
}

module.exports = {
  LOOPC_CONTEXT,
  buildSearchQueries,
  formatTavilyForPrompt,
  formatCrmForPrompt,
  formatErpCustomersForPrompt,
  formatMetalsForPrompt,
  formatChatInputsForPrompt,
  REGION_KEYWORDS,
}
