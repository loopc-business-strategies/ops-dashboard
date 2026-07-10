import { describe, expect, it } from 'vitest'
import { CHAT_TRANSLATE_LANGS, isRtlChatLang } from './chatTranslate'

describe('chatTranslate', () => {
  it('lists supported translation languages', () => {
    expect(CHAT_TRANSLATE_LANGS.map((item) => item.code)).toEqual(['en', 'ar', 'uz', 'ru'])
  })

  it('detects RTL for Arabic only', () => {
    expect(isRtlChatLang('ar')).toBe(true)
    expect(isRtlChatLang('en')).toBe(false)
    expect(isRtlChatLang('uz')).toBe(false)
    expect(isRtlChatLang('ru')).toBe(false)
  })
})
