const SUPPORTED_LANGS = new Set(['en', 'ar', 'uz', 'ru'])

function normalizeLang(code) {
  const key = String(code || '').trim().toLowerCase()
  return SUPPORTED_LANGS.has(key) ? key : ''
}

function detectSourceLang(text) {
  const sample = String(text || '')
  if (/[\u0600-\u06FF]/.test(sample)) return 'ar'
  if (/[\u0400-\u04FF]/.test(sample)) return 'ru'
  return 'en'
}

function protectTokens(text) {
  const placeholders = []
  let index = 0
  const protectedText = String(text || '').replace(
    /(@[A-Za-z0-9._-]+)|\b(MG|JV|P&L|ERP)\b/gi,
    (match) => {
      const key = `__TOK${index}__`
      placeholders.push({ key, match })
      index += 1
      return key
    },
  )
  return { protectedText, placeholders }
}

function restoreTokens(text, placeholders) {
  let restored = String(text || '')
  placeholders.forEach(({ key, match }) => {
    restored = restored.split(key).join(match)
  })
  return restored
}

function decodeHtmlEntities(text) {
  const raw = String(text || '')
  if (!raw.includes('&')) return raw

  return raw
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

async function fetchMyMemoryTranslation(text, sourceLang, targetLang) {
  const params = new URLSearchParams({
    q: text,
    langpair: `${sourceLang}|${targetLang}`,
  })
  const email = String(process.env.MYMEMORY_EMAIL || '').trim()
  if (email) params.set('de', email)

  const url = `https://api.mymemory.translated.net/get?${params.toString()}`
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) {
    const err = new Error(`Translation provider error (${response.status})`)
    err.statusCode = 502
    throw err
  }

  const payload = await response.json()
  const status = Number(payload?.responseStatus)
  const translated = decodeHtmlEntities(String(payload?.responseData?.translatedText || '').trim())
  const match = String(payload?.matches?.[0]?.match || '').trim().toLowerCase()

  if (status === 429 || /MYMEMORY WARNING|QUOTA/i.test(translated)) {
    const err = new Error('Translation quota exceeded. Try again later.')
    err.statusCode = 429
    throw err
  }

  if (!translated) {
    const err = new Error('Translation provider returned an empty result.')
    err.statusCode = 502
    throw err
  }

  return {
    translatedText: translated,
    detectedSourceLang: normalizeLang(match) || sourceLang,
  }
}

async function translateWithMyMemory({ text, targetLang, sourceLang = 'auto' }) {
  const normalizedTarget = normalizeLang(targetLang)
  if (!normalizedTarget) {
    const err = new Error('Unsupported target language.')
    err.statusCode = 400
    throw err
  }

  const rawText = String(text || '').trim()
  if (!rawText) {
    const err = new Error('Message text is required.')
    err.statusCode = 400
    throw err
  }

  let resolvedSource = sourceLang === 'auto' ? '' : normalizeLang(sourceLang)
  if (!resolvedSource) resolvedSource = detectSourceLang(rawText)
  if (resolvedSource === normalizedTarget) {
    return {
      translatedText: rawText,
      detectedSourceLang: resolvedSource,
      provider: 'mymemory',
      sameLanguage: true,
    }
  }

  const { protectedText, placeholders } = protectTokens(rawText)
  const result = await fetchMyMemoryTranslation(protectedText, resolvedSource, normalizedTarget)
  const restored = decodeHtmlEntities(restoreTokens(result.translatedText, placeholders).trim())
  if (!restored) {
    const err = new Error('Translation provider returned an empty result.')
    err.statusCode = 502
    throw err
  }

  return {
    translatedText: restored,
    detectedSourceLang: result.detectedSourceLang || resolvedSource,
    provider: 'mymemory',
    sameLanguage: false,
  }
}

module.exports = {
  translateWithMyMemory,
  detectSourceLang,
  normalizeLang,
  decodeHtmlEntities,
  SUPPORTED_LANGS,
}
