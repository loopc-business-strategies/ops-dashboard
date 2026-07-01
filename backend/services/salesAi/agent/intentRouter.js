const { classifyEmailIntent, isEmailOnlyQuestion } = require('../salesAiPrompts')

function routeIntent(userMessage, pageContext = {}) {
  const msg = String(userMessage || '').trim()
  const lower = msg.toLowerCase()

  const wantsEmail = classifyEmailIntent(msg)
  const emailOnly = isEmailOnlyQuestion(msg)
  const wantsCrm = /\b(pipeline|crm|deal|deals|lead|leads|follow[- ]?up|overdue|win rate|contact)\b/i.test(msg)
    || pageContext.tab === 'crm'
  const wantsMetals = /\b(gold|silver|platinum|metal|bullion|spot price|xau|xag)\b/i.test(msg)
  const wantsMarket = !emailOnly && (
    /\b(market|trend|demand|opportunit|industry|competitor|growth|strategy|forecast)\b/i.test(msg)
    || (!wantsCrm && !wantsEmail)
  )

  const tools = []
  if (wantsEmail) tools.push('email')
  if (wantsCrm || !emailOnly) tools.push('crm')
  if (wantsMetals) tools.push('metals')
  if (wantsMarket && !emailOnly) tools.push('tavily')

  if (!tools.length) {
    tools.push('crm', 'metals', 'tavily')
  }

  return {
    tools: [...new Set(tools)],
    wantsEmail,
    emailOnly,
    wantsCrm,
    wantsMetals,
    wantsMarket,
    skipTavily: emailOnly || (wantsEmail && !/\b(market|trend|pipeline|crm|deal|lead)\b/i.test(lower)),
  }
}

module.exports = { routeIntent }
