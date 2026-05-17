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
