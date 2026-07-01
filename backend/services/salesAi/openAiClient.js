function getModel() {
  return String(process.env.OPENAI_SALES_AI_MODEL || 'gpt-4o-mini').trim()
}

function isOpenAiConfigured() {
  return Boolean(String(process.env.OPENAI_API_KEY || '').trim())
}

async function chatCompletion(messages, options = {}) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim()
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured on the server.')
  }

  const model = options.model || getModel()
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 2500,
      response_format: options.jsonMode ? { type: 'json_object' } : undefined,
    }),
  })

  const raw = await res.text()
  if (!res.ok) {
    throw new Error(`OpenAI HTTP ${res.status}: ${raw.slice(0, 300)}`)
  }

  const data = JSON.parse(raw)
  const content = data?.choices?.[0]?.message?.content || ''
  return { content, model, usage: data.usage }
}

module.exports = {
  getModel,
  isOpenAiConfigured,
  chatCompletion,
}
