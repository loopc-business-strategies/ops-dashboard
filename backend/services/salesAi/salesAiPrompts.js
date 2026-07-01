const LOOPC_CONTEXT = `You are Sales Manager AI for LoopC — a jewelry and precious-metals B2B platform.
Focus on gold/silver/platinum markets, wholesale distribution, manufacturing partnerships, and CRM pipeline decisions.
Be concise, actionable, and honest about uncertainty. Cite external sources by title when provided.`

function buildSearchQueries(userMessage) {
  const msg = String(userMessage || '').trim()
  const base = msg.slice(0, 200)
  const queries = [
    `${base} precious metals jewelry market trends 2025 2026`,
    `${base} gold silver industry demand outlook`,
  ]
  if (/pipeline|crm|deal|lead|customer/i.test(msg)) {
    queries.push(`${base} B2B sales strategy precious metals wholesale`)
  } else if (/opportunit|growth|expand/i.test(msg)) {
    queries.push(`${base} new market opportunities gold jewelry wholesale`)
  } else {
    queries.push(`${base} market size growth forecast jewelry metals`)
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
  } else {
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

module.exports = {
  LOOPC_CONTEXT,
  buildSearchQueries,
  formatTavilyForPrompt,
  formatCrmForPrompt,
  formatMetalsForPrompt,
}
