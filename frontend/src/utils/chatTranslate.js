export const CHAT_TRANSLATE_LANGS = [
  { code: 'en', labelKey: 'chatTranslateLangEn' },
  { code: 'ar', labelKey: 'chatTranslateLangAr' },
  { code: 'uz', labelKey: 'chatTranslateLangUz' },
  { code: 'ru', labelKey: 'chatTranslateLangRu' },
]

export function isRtlChatLang(lang) {
  return String(lang || '').trim().toLowerCase() === 'ar'
}

export function clearChatTranslateState(setters = {}) {
  const {
    setTranslatePreview,
    setTranslateOriginal,
    setTranslateLoading,
    setTranslateTargetLang,
  } = setters
  setTranslatePreview?.('')
  setTranslateOriginal?.('')
  setTranslateLoading?.(false)
  setTranslateTargetLang?.('en')
}
