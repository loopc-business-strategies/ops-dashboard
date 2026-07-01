const { formatErpCustomersForPrompt } = require('../salesAiPrompts')

function runErpInsightAgent(erpSnapshot) {
  if (!erpSnapshot || erpSnapshot.accessLevel === 'none') {
    return {
      agent: 'customerRisk',
      title: 'Customer exposure',
      content: 'ERP customer data is not available for your role.',
      sources: [],
    }
  }
  return {
    agent: 'customerRisk',
    title: 'Customer exposure',
    content: formatErpCustomersForPrompt(erpSnapshot),
    sources: [],
  }
}

module.exports = {
  runErpInsightAgent,
}
