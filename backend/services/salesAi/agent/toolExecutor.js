const { buildCrmSnapshot } = require('../crmSnapshot')
const { buildMetalRatesSnapshot } = require('../metalRatesSnapshot')
const { runTavilySearches } = require('../tavilySearch')
const { runEmailInboxAgent } = require('../agents/emailInboxAgent')
const { getMaxTavilySearches } = require('../salesAiConfig')
const { buildSearchQueries } = require('../salesAiPrompts')

async function executeReadTools({
  user,
  userMessage,
  tenantKey,
  intent,
  chatInputs = {},
  searchDepth = 'basic',
}) {
  const maxTavily = getMaxTavilySearches()
  const tools = intent?.tools || []

  const emailPromise = tools.includes('email')
    ? runEmailInboxAgent(user, userMessage, tenantKey)
    : Promise.resolve(null)
  const crmPromise = tools.includes('crm')
    ? buildCrmSnapshot(user).then((snapshot) => ({ snapshot }))
    : Promise.resolve(null)
  const metalsPromise = tools.includes('metals')
    ? buildMetalRatesSnapshot()
    : Promise.resolve(null)

  let searchPromise = Promise.resolve([])
  if (tools.includes('tavily') && !intent?.skipTavily) {
    const queries = buildSearchQueries(userMessage, chatInputs).slice(0, maxTavily)
    searchPromise = runTavilySearches(queries, { searchDepth })
  }

  const [emailSection, crmResult, metalRates, searchBatches] = await Promise.all([
    emailPromise,
    crmPromise,
    metalsPromise,
    searchPromise,
  ])

  return {
    emailSection,
    crmSnapshot: crmResult?.snapshot || null,
    metalRates: metalRates || null,
    searchBatches: searchBatches || [],
  }
}

module.exports = { executeReadTools }
