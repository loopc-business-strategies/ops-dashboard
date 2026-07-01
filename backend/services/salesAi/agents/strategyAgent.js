const {
  LOOPC_CONTEXT,
  formatMetalsForPrompt,
  formatChatInputsForPrompt,
} = require('../salesAiPrompts')
const { chatCompletion, getModel } = require('../openAiClient')

async function runStrategyAgent({
  userMessage,
  marketSection,
  crmSection,
  metalRates,
  pageContext,
  history,
}) {
  const metalsText = formatMetalsForPrompt(metalRates)
  const tab = pageContext?.tab ? `Current dashboard tab: ${pageContext.tab}` : ''
  const inputsText = formatChatInputsForPrompt(pageContext?.chatInputs || {})

  const system = `${LOOPC_CONTEXT}

Respond in JSON only with this shape:
{
  "reply": "markdown string — full answer for the user with headings",
  "sections": [
    { "title": "string", "agent": "marketResearch|crmInsight|strategy", "body": "markdown snippet" }
  ]
}

Structure the reply with:
1. **Answer** — directly address the user's question first (2-4 paragraphs)
2. **Market research** (from web research — cite sources inline as [title](url) when available)
3. **Your LoopC data** (pipeline, metals, CRM stats — when relevant)
4. **Suggested next steps** (3-5 bullet actions)

Do not invent CRM numbers. Do not invent web facts not present in the research section.`

  const researchBlock = marketSection?.content || 'No web research.'
  const crmBlock = crmSection?.content || 'No CRM data.'
  const sourceLines = (marketSection?.sources || [])
    .map((s) => `- ${s.title}: ${s.url}`)
    .join('\n')

  const userContent = [
    `User question: ${userMessage}`,
    tab,
    inputsText,
    '',
    '--- External research (Tavily) ---',
    researchBlock,
    sourceLines ? `\nSources:\n${sourceLines}` : '',
    '',
    '--- LoopC CRM snapshot ---',
    crmBlock,
    '',
    '--- Live metal rates ---',
    metalsText,
  ].filter(Boolean).join('\n')

  const messages = [
    { role: 'system', content: system },
    ...(history || []).slice(-6).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 4000),
    })),
    { role: 'user', content: userContent },
  ]

  const { content, model } = await chatCompletion(messages, { jsonMode: true })

  let parsed
  try {
    parsed = JSON.parse(content)
  } catch {
    parsed = {
      reply: content || 'Unable to generate a structured response.',
      sections: [],
    }
  }

  const reply = String(parsed.reply || '').trim()
  const sections = Array.isArray(parsed.sections) ? parsed.sections.map((s) => ({
    title: String(s.title || 'Insight'),
    agent: String(s.agent || 'strategy'),
    body: String(s.body || ''),
  })) : []

  return {
    agent: 'strategy',
    title: 'Recommendations',
    reply,
    sections,
    meta: { model },
  }
}

module.exports = {
  runStrategyAgent,
  getModel,
}
