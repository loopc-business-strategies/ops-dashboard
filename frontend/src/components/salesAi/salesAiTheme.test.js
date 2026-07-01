import { describe, expect, test } from 'vitest'
import { SALES_AI_THEME } from './salesAiTheme'

describe('salesAiTheme', () => {
  const requiredKeys = [
    'panelBg',
    'chatBg',
    'cardBg',
    'textPrimary',
    'textSecondary',
    'accent',
    'userBubble',
    'assistantBubble',
    'link',
    'inputBg',
    'inputText',
    'placeholder',
  ]

  test('exports dark-surface palette with light text', () => {
    for (const key of requiredKeys) {
      expect(SALES_AI_THEME[key]).toBeTruthy()
    }
    expect(SALES_AI_THEME.panelBg).toMatch(/^#[0-9a-f]{6}$/i)
    expect(SALES_AI_THEME.textPrimary).toMatch(/^#[0-9a-f]{6}$/i)
    expect(SALES_AI_THEME.panelBg.toLowerCase()).not.toBe(SALES_AI_THEME.textPrimary.toLowerCase())
  })
})
