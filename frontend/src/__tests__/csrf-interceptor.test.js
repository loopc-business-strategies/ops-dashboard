import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getCookie, applyCsrfHeader, installCsrfInterceptor } from '../utils/csrfInterceptor'

describe('csrf interceptor utility', () => {
  beforeEach(() => {
    document.cookie = 'csrfToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  })

  it('reads csrfToken from cookie source', () => {
    document.cookie = 'csrfToken=test-token-123'
    expect(getCookie('csrfToken')).toBe('test-token-123')
  })

  it('adds x-csrf-token for mutating methods only', () => {
    document.cookie = 'csrfToken=test-token-abc'

    const postConfig = applyCsrfHeader({ method: 'post', headers: {} })
    expect(postConfig.headers['x-csrf-token']).toBe('test-token-abc')

    const getConfig = applyCsrfHeader({ method: 'get', headers: {} })
    expect(getConfig.headers['x-csrf-token']).toBeUndefined()
  })

  it('falls back to axios defaults when csrf cookie is absent', () => {
    const axiosInstance = {
      defaults: { headers: { common: { 'x-csrf-token': 'from-defaults' } } },
    }
    const postConfig = applyCsrfHeader({ method: 'post', headers: {} }, document, axiosInstance)
    expect(postConfig.headers['x-csrf-token']).toBe('from-defaults')
  })

  it('ignores page csrf cookie when API host differs from page host', () => {
    document.cookie = 'csrfToken=wrong-from-page'
    const axiosInstance = {
      defaults: {
        baseURL: 'https://api.loopcstrategies.com',
        headers: { common: { 'x-csrf-token': 'correct-from-api-session' } },
      },
      getUri(cfg) {
        const rel = cfg?.url || ''
        if (/^https?:\/\//i.test(rel)) return rel
        const b = String(this.defaults.baseURL || '').replace(/\/$/, '')
        return `${b}${rel.startsWith('/') ? '' : '/'}${rel}`
      },
    }
    vi.stubGlobal('window', {
      location: { hostname: 'mg.loopcstrategies.com', origin: 'https://mg.loopcstrategies.com' },
    })
    const postConfig = applyCsrfHeader(
      { method: 'post', url: '/api/messages', headers: {} },
      document,
      axiosInstance,
    )
    expect(postConfig.headers['x-csrf-token']).toBe('correct-from-api-session')
    vi.unstubAllGlobals()
  })

  it('reads tenant-scoped csrf cookie when x-tenant is set', () => {
    document.cookie = 'csrfToken_mg=mg-token-456'
    const axiosInstance = {
      defaults: { headers: { common: { 'x-tenant': 'mg' } } },
    }
    const postConfig = applyCsrfHeader({ method: 'post', headers: {} }, document, axiosInstance)
    expect(postConfig.headers['x-csrf-token']).toBe('mg-token-456')
  })

  it('installs request interceptor that applies csrf header', () => {
    document.cookie = 'csrfToken=token-via-install'

    const use = vi.fn()
    const axiosInstance = {
      interceptors: {
        request: { use },
      },
    }

    installCsrfInterceptor(axiosInstance)
    expect(use).toHaveBeenCalledTimes(1)

    const interceptor = use.mock.calls[0][0]
    const result = interceptor({ method: 'put', headers: {} })
    expect(result.headers['x-csrf-token']).toBe('token-via-install')
  })

  it('installs only one request interceptor per axios instance', () => {
    const use = vi.fn()
    const axiosInstance = {
      interceptors: {
        request: { use },
      },
    }

    installCsrfInterceptor(axiosInstance)
    installCsrfInterceptor(axiosInstance)

    expect(use).toHaveBeenCalledTimes(1)
  })
})
