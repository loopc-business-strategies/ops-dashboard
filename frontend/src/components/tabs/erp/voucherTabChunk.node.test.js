import { describe, expect, test } from 'vitest'
import { importVoucherTab, prefetchVoucherTabChunk } from './voucherTabChunk.js'

describe('voucherTabChunk', () => {
  test('exports import and prefetch helpers', () => {
    expect(typeof importVoucherTab).toBe('function')
    expect(typeof prefetchVoucherTabChunk).toBe('function')
    expect(() => prefetchVoucherTabChunk()).not.toThrow()
  })
})
