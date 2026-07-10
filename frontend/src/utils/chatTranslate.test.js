import { describe, expect, it } from 'vitest'
import {
  CHAT_TRANSLATE_LANGS,
  detectTextDirection,
  isRtlChatLang,
  isSameTranslation,
} from './chatTranslate'

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

  it('detects text direction from script', () => {
    expect(detectTextDirection('كيف الحال')).toBe('rtl')
    expect(detectTextDirection('Hello')).toBe('ltr')
  })

  it('compares normalized translations', () => {
    expect(isSameTranslation('Hello', 'Hello')).toBe(true)
    expect(isSameTranslation('Hello', 'Hi')).toBe(false)
    expect(isSameTranslation('كيف الحال', 'كيف  الحال')).toBe(true)
  })
})
