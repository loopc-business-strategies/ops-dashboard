import { describe, expect, test, vi, beforeEach } from 'vitest'
import {
  isStaleChunkError,
  reloadOnceForStaleChunk,
  clearStaleChunkReloadFlag,
} from './staleChunkReload.js'

describe('staleChunkReload', () => {
  test('detects Vite dynamic import failures', () => {
    expect(isStaleChunkError(new Error(
      'Failed to fetch dynamically imported module: https://vb.loopcstrategies.com/assets/Dashboard-f6Q4ueTG.js',
    ))).toBe(true)
    expect(isStaleChunkError(new Error('ChunkLoadError: Loading chunk 5 failed'))).toBe(true)
    expect(isStaleChunkError(new Error('Network Error'))).toBe(false)
  })

  test('reloadOnceForStaleChunk only reloads once per session key', () => {
    const store = new Map()
    const storage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)) },
      removeItem: (k) => { store.delete(k) },
    }
    const reload = vi.fn()
    vi.stubGlobal('window', { location: { reload } })

    expect(reloadOnceForStaleChunk(storage)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(reloadOnceForStaleChunk(storage)).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)

    clearStaleChunkReloadFlag(storage)
    expect(reloadOnceForStaleChunk(storage)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)

    vi.unstubAllGlobals()
  })
})
