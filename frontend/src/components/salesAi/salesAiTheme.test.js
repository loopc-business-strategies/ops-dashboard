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

  test('exports black-surface palette with white text', () => {
    for (const key of requiredKeys) {
      expect(SALES_AI_THEME[key]).toBeTruthy()
    }
    expect(SALES_AI_THEME.panelBg).toBe('#000000')
    expect(SALES_AI_THEME.textPrimary).toBe('#ffffff')
    expect(SALES_AI_THEME.panelBg.toLowerCase()).not.toBe(SALES_AI_THEME.textPrimary.toLowerCase())
  })

  test('does not use green brand colors', () => {
    const serialized = JSON.stringify(SALES_AI_THEME).toLowerCase()
    expect(serialized).not.toMatch(/00684a|13aa52|22c55e|6ee7b7/)
  })
})
