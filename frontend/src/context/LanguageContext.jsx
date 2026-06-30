// FILE: src/context/LanguageContext.jsx
// Provides language switching (English, Arabic, Uzbek, Russian) across the whole app.
// Arabic uses RTL layout; others are LTR.

import { createContext, useContext, useEffect, useState } from 'react'
import en from '../locales/en.json'
import ar from '../locales/ar.json'
import uz from '../locales/uz.json'
import ru from '../locales/ru.json'

const translations = { en, ar, uz, ru }

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
  const [langCode, setLangCode] = useState(() => {
    return localStorage.getItem('app_language') || 'en'
  })

  const langMeta = LANGUAGES.find(l => l.code === langCode) || LANGUAGES[0]
  const isRTL    = langMeta.dir === 'rtl'

  useEffect(() => {
    document.documentElement.dir  = langMeta.dir
    document.documentElement.lang = langCode
    document.body.dir             = langMeta.dir
  }, [langCode, langMeta.dir])

  const switchLanguage = (code) => {
    localStorage.setItem('app_language', code)
    setLangCode(code)
  }

  const t = (key) => {
    const dict = translations[langCode] || translations.en
    return dict[key] ?? translations.en[key] ?? key
  }

  return (
    <LanguageContext.Provider value={{ langCode, langMeta, isRTL, switchLanguage, t, LANGUAGES }}>
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
