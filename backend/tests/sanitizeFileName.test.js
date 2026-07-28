const { describe, expect, test } = require('@jest/globals')
const { sanitizeFileName } = require('../utils/sanitizeFileName')

describe('sanitizeFileName', () => {
  test('strips control characters and quotes', () => {
    expect(sanitizeFileName('a\u0000b\u001fc"d.txt')).toBe('abcd.txt')
  })

  test('replaces path separators and falls back when empty', () => {
    expect(sanitizeFileName('foo/bar\\baz.pdf')).toBe('foo_bar_baz.pdf')
    expect(sanitizeFileName('\u0000\u0001', 'document')).toBe('document')
  })
})
