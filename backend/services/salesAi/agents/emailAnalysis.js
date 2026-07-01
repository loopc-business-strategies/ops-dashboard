const SALES_KEYWORDS = /\b(quote|order|invoice|inquiry|enquiry|payment|shipment|proposal|contract|rfq|purchase|pricing)\b/i

function extractSenderDomain(from = '') {
  const emailMatch = String(from).match(/<([^>]+)>/) || String(from).match(/([\w.-]+@[\w.-]+)/)
  const email = (emailMatch?.[1] || '').toLowerCase()
  const domain = email.split('@')[1] || ''
  return domain || String(from).slice(0, 40)
}

function buildEmailAnalysis(messages = [], { query = '' } = {}) {
  const list = Array.isArray(messages) ? messages : []
  const senderCounts = new Map()
  const salesRelated = []

  list.forEach((m) => {
    const domain = extractSenderDomain(m.from)
    senderCounts.set(domain, (senderCounts.get(domain) || 0) + 1)
    const text = `${m.subject || ''} ${m.snippet || ''}`
    if (SALES_KEYWORDS.test(text)) {
      salesRelated.push(m)
    }
  })

  const topSenders = [...senderCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain, count]) => ({ domain, count }))

  return {
    total: list.length,
    query,
    topSenders,
    salesRelatedCount: salesRelated.length,
    salesRelated: salesRelated.slice(0, 8),
  }
}

function formatEmailAnalysisSummary(analysis, inboxEmail = '') {
  if (!analysis) return 'No inbox data available.'
  const lines = []
  if (inboxEmail) lines.push(`Reviewing **${inboxEmail}** (last 30 days, up to ${analysis.total} messages shown).`)
  else lines.push(`Found **${analysis.total}** message(s) in the selected window.`)

  if (analysis.topSenders.length) {
    lines.push('', '**Top senders:**')
    analysis.topSenders.forEach((s) => {
      lines.push(`- ${s.domain} (${s.count} message${s.count === 1 ? '' : 's'})`)
    })
  }

  if (analysis.salesRelatedCount > 0) {
    lines.push('', `**Sales-related (${analysis.salesRelatedCount}):**`)
    analysis.salesRelated.forEach((m) => {
      lines.push(`- **${m.subject || '(no subject)'}** — ${m.from}`)
    })
  } else if (analysis.total > 0) {
    lines.push('', 'No obvious sales keywords (quote, order, invoice, inquiry) in subjects/snippets — see full list below.')
  } else {
    lines.push('', 'No messages matched this query.')
  }

  return lines.join('\n')
}

module.exports = {
  buildEmailAnalysis,
  formatEmailAnalysisSummary,
  extractSenderDomain,
  SALES_KEYWORDS,
}
