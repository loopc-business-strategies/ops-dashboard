const MAX_RESULTS = 5

async function tavilySearch(query, options = {}) {
  const apiKey = String(process.env.TAVILY_API_KEY || '').trim()
  if (!apiKey) {
    return { query, results: [], error: 'TAVILY_API_KEY is not configured on the server.' }
  }

  const maxResults = Math.min(Number(options.maxResults) || MAX_RESULTS, 10)
  const searchDepth = options.searchDepth === 'advanced' ? 'advanced' : 'basic'

  const includeAnswer = options.includeAnswer !== false
    && String(process.env.SALES_AI_TAVILY_INCLUDE_ANSWER || 'true').trim().toLowerCase() !== 'false'

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: String(query || '').trim().slice(0, 400),
        search_depth: searchDepth,
        include_answer: includeAnswer,
        max_results: maxResults,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return { query, results: [], error: `Tavily HTTP ${res.status}: ${text.slice(0, 200)}` }
    }

    const data = await res.json()
    const results = (data.results || []).map((item) => ({
      title: String(item.title || '').trim(),
      url: String(item.url || '').trim(),
      content: String(item.content || '').trim().slice(0, 1200),
    })).filter((item) => item.url)

    return { query, results, answer: data.answer || null }
  } catch (err) {
    return { query, results: [], error: err?.message || 'Tavily search failed' }
  }
}

async function runTavilySearches(queries = []) {
  const cap = Math.max(1, Math.min(Number(process.env.SALES_AI_MAX_TAVILY_SEARCHES) || 3, 5))
  const unique = [...new Set(queries.map((q) => String(q || '').trim()).filter(Boolean))].slice(0, cap)
  const batches = await Promise.all(unique.map((query) => tavilySearch(query)))
  return batches
}

module.exports = {
  tavilySearch,
  runTavilySearches,
}
