const PLAYBOOKS = [
  {
    id: 'market-entry',
    label: 'New market entry',
    prompt: 'Assess market entry opportunities for our target regions. Cover demand, competition, regulatory risks, and recommended first steps.',
    agents: ['marketResearch', 'strategy'],
  },
  {
    id: 'qbr',
    label: 'Quarterly business review',
    prompt: 'Prepare a quarterly business review: pipeline health, revenue trends, metal market context, top risks, and priorities for next quarter.',
    agents: ['crmInsight', 'marketResearch', 'strategy'],
  },
  {
    id: 'key-account',
    label: 'Key account review',
    prompt: 'Review our top customer exposure and pipeline. Recommend account-level actions for retention and growth.',
    agents: ['customerRisk', 'crmInsight', 'strategy'],
  },
  {
    id: 'competitive-scan',
    label: 'Competitive scan',
    prompt: 'Scan competitors and market positioning for precious metals and jewelry wholesale in our focus regions.',
    agents: ['marketResearch', 'competitiveIntel', 'strategy'],
  },
]

function getPlaybooks() {
  return PLAYBOOKS
}

function getPlaybookById(id) {
  return PLAYBOOKS.find((p) => p.id === id) || null
}

module.exports = {
  getPlaybooks,
  getPlaybookById,
}
