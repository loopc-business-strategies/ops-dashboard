const LOOPC_CONTEXT = `You are Sales Manager AI for LoopC — a jewelry and precious-metals B2B platform.
Focus on gold/silver/platinum markets, wholesale distribution, manufacturing partnerships, and CRM pipeline decisions.
Be concise, actionable, and honest about uncertainty. Cite external sources by title when provided.
Always answer the user's specific question first before adding supporting context.`

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
  const constraints = String(options.constraints || '').trim()
  const regionSuffix = REGION_KEYWORDS[region] || (region ? `${region} gold jewelry market` : '')

  const queries = [
    `${base} precious metals jewelry market trends 2025 2026${regionSuffix ? ` ${regionSuffix}` : ''}`,
    `${base} gold silver industry demand outlook${regionSuffix ? ` ${regionSuffix}` : ''}`,
  ]

  if (/competitor|rival|versus|vs\b/i.test(msg)) {
    queries.push(`${base} precious metals jewelry competitor analysis${regionSuffix ? ` ${regionSuffix}` : ''}`)
  } else if (/regulat|compliance|sanction|import duty|hallmark/i.test(msg)) {
    queries.push(`${base} gold jewelry import regulations trade compliance${regionSuffix ? ` ${regionSuffix}` : ''}`)
  } else if (/pipeline|crm|deal|lead|customer/i.test(msg)) {
    queries.push(`${base} B2B sales strategy precious metals wholesale`)
  } else if (/opportunit|growth|expand|market entry/i.test(msg)) {
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

  if (constraints) {
    queries.push(`${base} ${constraints.slice(0, 120)} precious metals jewelry${regionSuffix ? ` ${regionSuffix}` : ''}`)
  } else if (regionSuffix && !queries.some((q) => q.includes(regionSuffix))) {
    queries.push(`${base} ${regionSuffix} wholesale bullion jewelry`)
  }

  return queries
}

function formatTavilyForPrompt(searchBatches) {
  const lines = []
  const sources = []
  const answers = []
  for (const batch of searchBatches || []) {
    if (batch.error) {
      lines.push(`Query "${batch.query}": ${batch.error}`)
      continue
    }
    lines.push(`\n### Search: ${batch.query}`)
    if (batch.answer) {
      lines.push(`Summary: ${batch.answer}`)
      answers.push(String(batch.answer))
    }
    for (const r of batch.results || []) {
      lines.push(`- **${r.title}** (${r.url})\n  ${r.content}`)
      sources.push({ title: r.title, url: r.url })
    }
  }
  return { text: lines.join('\n'), sources, answers }
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
    `Total contacts: ${s.totalContacts ?? 0}`,
  ]
  if (crmSnapshot.accessLevel === 'full' && crmSnapshot.detail) {
    const deals = crmSnapshot.detail.topOpenDeals || []
    const leads = crmSnapshot.detail.recentLeads || []
    if (deals.length) {
      lines.push('\nTop open deals:')
      deals.forEach((d) => lines.push(`- ${d.title} | ${d.stage} | $${d.valueUSD || 0}`))
    }
    if (leads.length) {
      lines.push('\nRecent leads:')
      leads.forEach((l) => lines.push(`- ${l.title} | ${l.temperature || ''} | ${l.companyName || ''}`))
    }
  } else if (crmSnapshot.accessLevel === 'aggregate') {
    lines.push('\n(Detailed deal/lead names hidden — user does not have Sales CRM access.)')
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
  if (inputs.constraints) lines.push(`User constraints: ${inputs.constraints}`)
  return lines.join('\n')
}

function classifyQuestion(userMessage) {
  const msg = String(userMessage || '').toLowerCase()
  const pipeline = /pipeline|crm|deal|lead|follow.?up|win rate|customer/i.test(msg)
  const market = /market|trend|demand|uzbekistan|uae|gcc|turkey|india|china|competitor|regulat|opportunit|growth|wholesale|bullion|jewelry|gold|silver/i.test(msg)
  const metals = /gold price|silver price|metal rate|spot|fixing/i.test(msg)
  if (pipeline && !market) return 'pipeline'
  if (market && !pipeline) return 'market'
  if (metals && !pipeline && !market) return 'metals'
  return 'mixed'
}

module.exports = {
  LOOPC_CONTEXT,
  REGION_KEYWORDS,
  buildSearchQueries,
  formatTavilyForPrompt,
  formatCrmForPrompt,
  formatMetalsForPrompt,
  formatChatInputsForPrompt,
  classifyQuestion,
}
