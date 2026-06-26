import { describe, expect, test } from 'vitest'
import { escapeHtml, sanitizeLogoUrl } from './safeHtml'

describe('safeHtml', () => {
  test('escapeHtml encodes HTML special characters', () => {
    expect(escapeHtml('<script>"x"</script>')).toBe('&lt;script&gt;&quot;x&quot;&lt;/script&gt;')
  })

  test('sanitizeLogoUrl allows data:image/png', () => {
    expect(sanitizeLogoUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc')
  })

  test('sanitizeLogoUrl blocks javascript scheme', () => {
    expect(sanitizeLogoUrl('javascript:alert(1)')).toBe('')
  })

  test('sanitizeLogoUrl allows https URLs', () => {
    expect(sanitizeLogoUrl('https://cdn.example.com/logo.png')).toBe('https://cdn.example.com/logo.png')
  })
})
