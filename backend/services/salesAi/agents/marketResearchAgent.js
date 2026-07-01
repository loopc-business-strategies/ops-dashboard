const { formatTavilyForPrompt } = require('../salesAiPrompts')

function runMarketResearchAgent(searchBatches) {
  const { text, sources } = formatTavilyForPrompt(searchBatches)
  const hasResults = sources.length > 0
  return {
    agent: 'marketResearch',
    title: 'Market signals',
    content: hasResults
      ? text
      : 'No external web results were retrieved. Check TAVILY_API_KEY or try rephrasing your question.',
    sources: sources.slice(0, 12),
  }
}

module.exports = {
  runMarketResearchAgent,
}
