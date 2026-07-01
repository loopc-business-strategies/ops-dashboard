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
    'headerBg',
  ]

  test('exports light dashboard palette with dark readable text', () => {
    for (const key of requiredKeys) {
      expect(SALES_AI_THEME[key]).toBeTruthy()
    }
    expect(SALES_AI_THEME.panelBg).toBe('#f8f9fa')
    expect(SALES_AI_THEME.textPrimary).toBe('#1C2A33')
    expect(SALES_AI_THEME.cardBg).toBe('#ffffff')
    expect(SALES_AI_THEME.panelBg.toLowerCase()).not.toBe(SALES_AI_THEME.textPrimary.toLowerCase())
  })

  test('uses brand accent for interactive elements', () => {
    expect(SALES_AI_THEME.accent).toBe('#00684A')
    expect(SALES_AI_THEME.userText).toBe('#ffffff')
    expect(SALES_AI_THEME.userBubble).toBe('#00684A')
  })
})
