// FILE: src/context/LanguageContext.jsx
// Provides language switching (English, Arabic, Uzbek, Russian) across the whole app.
// Arabic uses RTL layout; others are LTR.
// English is eager; other locales are lazy-loaded.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import en from '../locales/en.json'

const localeLoaders = {
  ar: () => import('../locales/ar.json'),
  uz: () => import('../locales/uz.json'),
  ru: () => import('../locales/ru.json'),
}

const translationsCache = { en }

async function ensureLocaleLoaded(code) {
  if (code === 'en' || translationsCache[code]) return translationsCache[code] || en
  const loader = localeLoaders[code]
  if (!loader) return en
  const mod = await loader()
  const dict = mod?.default || mod
  translationsCache[code] = dict
  return dict
}

function readStoredLang() {
  try {
    return localStorage.getItem('app_language') || 'en'
  } catch {
    return 'en'
  }
}

// ── Language metadata ─────────────────────────────────────────────────────────
export const LANGUAGES = [
  { code: 'en', label: 'English',  nativeLabel: 'English',  flag: '🇬🇧', regionCode: 'GB', dir: 'ltr' },
  { code: 'ar', label: 'Arabic',   nativeLabel: 'عربي',      flag: '🇸🇦', regionCode: 'SA', dir: 'rtl' },
  { code: 'uz', label: 'Uzbek',    nativeLabel: "O'zbek",   flag: '🇺🇿', regionCode: 'UZ', dir: 'ltr' },
  { code: 'ru', label: 'Russian',  nativeLabel: 'Русский',  flag: '🇷🇺', regionCode: 'RU', dir: 'ltr' },
]

// ── Context ───────────────────────────────────────────────────────────────────
const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const initialCode = readStoredLang()
  const [langCode, setLangCode] = useState(initialCode)
  const [localeReady, setLocaleReady] = useState(initialCode === 'en' || Boolean(translationsCache[initialCode]))

  const langMeta = LANGUAGES.find((l) => l.code === langCode) || LANGUAGES[0]
  const isRTL = langMeta.dir === 'rtl'

  useEffect(() => {
    let cancelled = false
    if (langCode === 'en') {
      setLocaleReady(true)
      return undefined
    }
    setLocaleReady(Boolean(translationsCache[langCode]))
    ensureLocaleLoaded(langCode).then(() => {
      if (!cancelled) setLocaleReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [langCode])

  useEffect(() => {
    document.documentElement.dir = langMeta.dir
    document.documentElement.lang = langCode
    document.body.dir = langMeta.dir
  }, [langCode, langMeta.dir])

  const switchLanguage = useCallback(async (code) => {
    localStorage.setItem('app_language', code)
    if (code !== 'en') await ensureLocaleLoaded(code)
    setLangCode(code)
  }, [])

  const t = useCallback((key) => {
    const dict = translationsCache[langCode] || translationsCache.en
    return dict[key] ?? translationsCache.en[key] ?? key
  }, [langCode])

  const value = useMemo(
    () => ({ langCode, langMeta, isRTL, switchLanguage, t, LANGUAGES, localeReady }),
    [langCode, langMeta, isRTL, switchLanguage, t, localeReady],
  )

  // Gate first paint for stored non-en locale to avoid English flash
  if (!localeReady && langCode !== 'en') {
    return null
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>')
  return ctx
}

export default LanguageContext
