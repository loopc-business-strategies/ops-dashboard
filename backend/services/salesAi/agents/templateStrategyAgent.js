const {
  formatMetalsForPrompt,
  classifyQuestion,
  classifyEmailIntent,
  isEmailOnlyQuestion,
  REGION_KEYWORDS,
} = require('../salesAiPrompts')

function extractResearchSnippets(marketSection) {
  const answers = marketSection?.answers || []
  if (answers.length) return answers.map((a) => String(a).trim()).filter(Boolean)

  const content = String(marketSection?.content || '')
  const snippets = []
  content.split('\n').forEach((line) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('Summary:')) {
      snippets.push(trimmed.replace(/^Summary:\s*/, ''))
    } else if (trimmed.startsWith('- **') && trimmed.includes('http')) {
      const text = trimmed.split('\n  ')[1] || trimmed
      if (text.length > 40) snippets.push(text.slice(0, 400))
    }
  })
  return snippets.slice(0, 4)
}

function buildDirectAnswer(userMessage, marketSection, crmSnapshot, metalRates, chatInputs = {}, emailSection = null) {
  const question = String(userMessage || '').trim()
  const kind = classifyQuestion(question)
  const s = crmSnapshot?.summary || {}
  const snippets = extractResearchSnippets(marketSection)
  const sourceCount = (marketSection?.sources || []).length
  const paragraphs = []

  const regionLabel = chatInputs.region
    ? (REGION_KEYWORDS[chatInputs.region] || chatInputs.region)
    : ''
  if (regionLabel) {
    paragraphs.push(`Research focus: **${regionLabel}**.`)
  }
  if (chatInputs.constraints) {
    paragraphs.push(`Constraints noted: ${chatInputs.constraints}`)
  }

  if (kind === 'email' || (classifyEmailIntent(question) && emailSection)) {
    if (emailSection?.connectRequired) {
      paragraphs.push('Connect Gmail to check your inbox from Sales Manager AI.')
    } else if (emailSection?.summary) {
      paragraphs.push(emailSection.summary)
    } else if (emailSection?.messages?.length) {
      paragraphs.push(`Found **${emailSection.messages.length}** recent message(s) in your inbox.`)
      emailSection.messages.slice(0, 3).forEach((m) => {
        paragraphs.push(`- **${m.subject || '(no subject)'}** — ${m.from}`)
      })
    } else if (emailSection?.content) {
      paragraphs.push('No matching messages found in your inbox for this query.')
    }
  }

  if (kind === 'pipeline' || kind === 'mixed') {
    const pipeline = Number(s.pipelineValueUSD) || 0
    const parts = []
    if (pipeline) parts.push(`pipeline value is **$${pipeline.toLocaleString()}**`)
    if (s.hotLeads) parts.push(`**${s.hotLeads} hot lead(s)**`)
    if (s.overdueFollowups) parts.push(`**${s.overdueFollowups} overdue follow-up(s)**`)
    if (parts.length) {
      paragraphs.push(`On your CRM: ${parts.join(', ')}.`)
    }
    if (crmSnapshot?.accessLevel === 'full' && crmSnapshot?.detail?.topOpenDeals?.length) {
      const top = crmSnapshot.detail.topOpenDeals[0]
      const dealName = top.title || 'Untitled deal'
      paragraphs.push(`Largest open deal: **${dealName}** (${top.stage}, $${top.valueUSD || 0}).`)
    }
  }

  if (kind === 'market' || kind === 'mixed') {
    if (snippets.length) {
      paragraphs.push(snippets[0])
      if (snippets[1]) paragraphs.push(snippets[1])
    } else if (sourceCount) {
      paragraphs.push(`Found **${sourceCount} external source(s)** relevant to your question. See market research below for details and links.`)
    } else {
      paragraphs.push('Limited external web results were found — try a more specific region or rephrase your question.')
    }
  }

  if (kind === 'metals' || /gold|silver|metal|rate|price/i.test(question)) {
    if (metalRates?.goldPrice) {
      paragraphs.push(`Live rates: gold **${metalRates.goldPrice}** / silver **${metalRates.silverPrice}** ${metalRates.priceCurrency || 'USD'}/${metalRates.priceUnit || 'G'} (${metalRates.source || 'feed'}).`)
    }
  }

  if (!paragraphs.length) {
    paragraphs.push(`Regarding "${question.slice(0, 120)}": combine the market research and LoopC data sections below for a full picture.`)
  }

  return paragraphs.join('\n\n')
}

function buildRecommendations(crmSnapshot, marketSection) {
  const s = crmSnapshot?.summary || {}
  const bullets = []
  const hot = Number(s.hotLeads) || 0
  const overdue = Number(s.overdueFollowups) || 0
  const pipeline = Number(s.pipelineValueUSD) || 0
  const winRate = Number(s.winRate) || 0
  const activeLeads = Number(s.activeLeads) || 0

  if (overdue > 0) {
    bullets.push(`Clear **${overdue} overdue follow-up(s)** before chasing new opportunities.`)
  }
  if (hot > 0) {
    bullets.push(`Prioritize **${hot} hot lead(s)** — schedule calls or demos this week.`)
  }
  if (pipeline > 0 && crmSnapshot?.accessLevel === 'full' && crmSnapshot?.detail?.topOpenDeals?.length) {
    const top = crmSnapshot.detail.topOpenDeals[0]
    const dealName = top.title || 'Untitled deal'
    bullets.push(`Focus on largest open deal: **${dealName}** (${top.stage}, $${top.valueUSD || 0}).`)
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

function formatMarketForReply(marketSection) {
  const sources = marketSection?.sources || []
  const answers = marketSection?.answers || []
  const lines = []
  if (answers.length) {
    lines.push('**Web summaries:**')
    answers.forEach((a) => lines.push(`- ${a}`))
    lines.push('')
  }
  if (!sources.length && !answers.length) {
    return String(marketSection?.content || 'No web research results available.')
  }
  const content = String(marketSection?.content || '')
  const excerpt = content.split('\n').filter((l) => l.trim() && !l.startsWith('###')).slice(0, 8).join('\n')
  if (excerpt) lines.push(excerpt)
  if (sources.length) {
    lines.push('', '**Sources:**')
    sources.slice(0, 8).forEach((src) => lines.push(`- [${src.title}](${src.url})`))
  }
  return lines.join('\n')
}

function formatCrmForReply(crmSnapshot) {
  const s = crmSnapshot?.summary || {}
  const lines = [
    `- Pipeline value: **$${(s.pipelineValueUSD ?? 0).toLocaleString()}**`,
    `- Active leads: **${s.activeLeads ?? 0}** | Hot leads: **${s.hotLeads ?? 0}**`,
    `- Win rate: **${s.winRate ?? 0}%** | Revenue this month: **$${(s.revenueThisMonthUSD ?? 0).toLocaleString()}**`,
    `- Overdue follow-ups: **${s.overdueFollowups ?? 0}** | Contacts: **${s.totalContacts ?? 0}**`,
  ]
  if (crmSnapshot?.accessLevel === 'full' && crmSnapshot?.detail) {
    const deals = crmSnapshot.detail.topOpenDeals || []
    const leads = crmSnapshot.detail.recentLeads || []
    if (deals.length) {
      lines.push('', '**Top open deals:**')
      deals.forEach((d) => lines.push(`- ${d.title || 'Untitled deal'} — ${d.stage}, $${d.valueUSD || 0}`))
    }
    if (leads.length) {
      lines.push('', '**Recent leads:**')
      leads.forEach((l) => lines.push(`- ${l.title || 'Untitled lead'} — ${l.temperature || 'n/a'}, ${l.companyName || ''}`))
    }
  }
  return lines.join('\n')
}

function formatEmailForReply(emailSection) {
  if (!emailSection || emailSection.connectRequired) {
    return 'Gmail is not connected. Use **Connect Gmail** in the widget to enable inbox checks.'
  }
  return String(emailSection.content || 'No inbox messages.')
}

function shouldShowCrmSection(userMessage) {
  const kind = classifyQuestion(userMessage)
  return kind === 'pipeline' || kind === 'mixed' || kind === 'metals'
}

function shouldShowEmailSection(userMessage, emailSection) {
  return Boolean(emailSection && (classifyEmailIntent(userMessage) || classifyQuestion(userMessage) === 'email'))
}

function runTemplateStrategyAgent({
  userMessage,
  marketSection,
  crmSnapshot,
  metalRates,
  emailSection = null,
  chatInputs = {},
  fallbackReason = 'unavailable',
}) {
  const emailOnly = isEmailOnlyQuestion(userMessage)
  const directAnswer = buildDirectAnswer(userMessage, marketSection, crmSnapshot, metalRates, chatInputs, emailSection)
  const recommendations = emailOnly ? [] : buildRecommendations(crmSnapshot, marketSection)
  const metalsText = formatMetalsForPrompt(metalRates)
  const showCrm = !emailOnly && shouldShowCrmSection(userMessage)
  const showEmail = shouldShowEmailSection(userMessage, emailSection)
  const showMarket = !emailOnly

  const modeNote = emailOnly
    ? ''
    : (fallbackReason === 'disabled'
      ? '_Template mode — OpenAI synthesis is off._'
      : '_Template mode — full AI synthesis unavailable (add OpenAI credits for richer briefings)._')

  const replyParts = [
    modeNote,
    modeNote ? '' : null,
    '## Answer',
    directAnswer,
    '',
    showEmail ? '## Inbox' : null,
    showEmail ? formatEmailForReply(emailSection) : null,
    showEmail ? '' : null,
    showMarket ? '## Market research' : null,
    showMarket ? formatMarketForReply(marketSection) : null,
    showMarket ? '' : null,
    showCrm ? '## Your LoopC data' : null,
    showCrm ? formatCrmForReply(crmSnapshot) : null,
    showCrm ? '' : null,
    showCrm && metalRates ? '## Live metal rates' : null,
    showCrm && metalRates ? metalsText : null,
    showCrm && metalRates ? '' : null,
    recommendations.length ? '## Suggested next steps' : null,
    ...(recommendations.length ? recommendations.map((b) => `- ${b}`) : []),
  ].filter((block) => block !== null && block !== '')

  const reply = replyParts.join('\n')

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
  buildDirectAnswer,
  isOpenAiQuotaError,
  isEmailOnlyQuestion,
}
