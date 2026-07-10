const {
  isChatTranslationEnabledForTenant,
  assertChatTranslationAccess,
} = require('../services/chatTranslationAccess')
const {
  detectSourceLang,
  normalizeLang,
  translateWithMyMemory,
} = require('../services/translators/myMemoryTranslator')

describe('chatTranslationAccess', () => {
  const original = process.env.CHAT_TRANSLATION_ALLOWED_TENANTS

  afterEach(() => {
    if (original === undefined) delete process.env.CHAT_TRANSLATION_ALLOWED_TENANTS
    else process.env.CHAT_TRANSLATION_ALLOWED_TENANTS = original
  })

  test('allows loopc by default', () => {
    delete process.env.CHAT_TRANSLATION_ALLOWED_TENANTS
    expect(isChatTranslationEnabledForTenant('loopc')).toBe(true)
    expect(isChatTranslationEnabledForTenant('mg')).toBe(false)
  })

  test('assertChatTranslationAccess rejects disabled tenant', () => {
    process.env.CHAT_TRANSLATION_ALLOWED_TENANTS = 'loopc'
    expect(() => assertChatTranslationAccess({ user: { company: 'mg' } })).toThrow(/not enabled/)
  })
})

describe('myMemoryTranslator', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  test('detectSourceLang infers Arabic and Russian scripts', () => {
    expect(detectSourceLang('مرحبا')).toBe('ar')
    expect(detectSourceLang('Привет')).toBe('ru')
    expect(detectSourceLang('Hello team')).toBe('en')
  })

  test('normalizeLang accepts supported codes only', () => {
    expect(normalizeLang('EN')).toBe('en')
    expect(normalizeLang('xx')).toBe('')
  })

  test('translateWithMyMemory returns provider text', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        responseStatus: 200,
        responseData: { translatedText: 'Salom jamoa' },
        matches: [{ match: 0.98 }],
      }),
    })

    const result = await translateWithMyMemory({
      text: 'Hello team',
      targetLang: 'uz',
      sourceLang: 'en',
    })

    expect(result.translatedText).toBe('Salom jamoa')
    expect(result.provider).toBe('mymemory')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.mymemory.translated.net/get'),
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
  })

  test('translateWithMyMemory protects mentions and acronyms', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        responseStatus: 200,
        responseData: { translatedText: '__TOK0__ uchun hisobot __TOK1__' },
        matches: [{ match: 0.9 }],
      }),
    })

    const result = await translateWithMyMemory({
      text: 'Report for @Ali in ERP',
      targetLang: 'uz',
      sourceLang: 'en',
    })

    expect(result.translatedText).toContain('@Ali')
    expect(result.translatedText).toContain('ERP')
  })
})
