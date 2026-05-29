const { detectBuiltinIntent, matchFixPlaybooks, runBuiltinAgent } = require('../services/builtinAgentService')
const { resolveOpenAiModel, resolveProvider, getAiAgentConfig } = require('../services/aiAgentService')

describe('builtinAgentService', () => {
  test('detectBuiltinIntent classifies fix and market prompts', () => {
    expect(detectBuiltinIntent('Fix my MT4 prices')).toBe('fix')
    expect(detectBuiltinIntent('What is the gold price today?')).toBe('market')
  })

  test('matchFixPlaybooks finds MT4 playbook from prompt text', () => {
    const hits = matchFixPlaybooks('top bar waiting MT4 no prices', null)
    expect(hits.some((h) => h.id === 'mt4-prices')).toBe(true)
  })

  test('runBuiltinAgent returns fix plan for permission prompt', () => {
    const result = runBuiltinAgent({
      message: 'I get 403 forbidden when saving voucher',
      context: { user: { name: 'Nan' }, tenant: 'mg', metals: {}, tasks: {}, pageContext: { tab: 'erp' } },
    })
    expect(result.mode).toBe('builtin')
    expect(result.reply).toMatch(/Fix plan|403|permission/i)
  })
})

describe('aiAgentService config', () => {
  test('defaults to builtin provider', () => {
    expect(resolveProvider(null)).toBe('builtin')
    expect(resolveProvider('openai')).toBe('builtin')
  })

  test('resolveOpenAiModel allowlists ChatGPT models', () => {
    expect(resolveOpenAiModel('gpt-4o-mini')).toBe('gpt-4o-mini')
    expect(resolveOpenAiModel('unknown')).toBe('gpt-4o')
  })

  test('getAiAgentConfig exposes builtin as default', () => {
    const cfg = getAiAgentConfig()
    expect(cfg.provider).toBe('builtin')
    expect(cfg.providers[0].id).toBe('builtin')
    expect(cfg.providers[0].available).toBe(true)
  })
})
