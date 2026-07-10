export const CHAT_TRANSLATE_LANGS = [
  { code: 'en', labelKey: 'chatTranslateLangEn' },
  { code: 'ar', labelKey: 'chatTranslateLangAr' },
  { code: 'uz', labelKey: 'chatTranslateLangUz' },
  { code: 'ru', labelKey: 'chatTranslateLangRu' },
]

export const CHAT_TRANSLATE_SOURCE_LANGS = [
  { code: 'auto', labelKey: 'chatTranslateSourceAuto' },
  ...CHAT_TRANSLATE_LANGS,
]

export function isRtlChatLang(lang) {
  return String(lang || '').trim().toLowerCase() === 'ar'
}

export function detectTextDirection(text) {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(String(text || '')) ? 'rtl' : 'ltr'
}

export function isSameTranslation(original, translated) {
  const left = String(original || '').trim().replace(/\s+/g, ' ')
  const right = String(translated || '').trim().replace(/\s+/g, ' ')
  return Boolean(left) && left === right
}

export function clearChatTranslateState(setters = {}) {
  const {
    setTranslatePreview,
    setTranslateOriginal,
    setTranslateLoading,
    setTranslateTargetLang,
    setTranslateSourceLang,
  } = setters
  setTranslatePreview?.('')
  setTranslateOriginal?.('')
  setTranslateLoading?.(false)
  setTranslateTargetLang?.('en')
  setTranslateSourceLang?.('auto')
}
