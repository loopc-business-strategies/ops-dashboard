const { formatCrmForPrompt } = require('../salesAiPrompts')

function runCrmInsightAgent(crmSnapshot) {
  const content = formatCrmForPrompt(crmSnapshot)
  return {
    agent: 'crmInsight',
    title: 'Your LoopC data',
    content,
    sources: [],
  }
}

module.exports = {
  runCrmInsightAgent,
}
