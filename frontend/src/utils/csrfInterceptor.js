const getCookie = (name, cookieSource = document) => {
  const source = String(cookieSource?.cookie || '')
  const target = `${name}=`
  const value = source
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(target))
  return value ? decodeURIComponent(value.slice(target.length)) : ''
}

const resolveRequestHostname = (config, axiosInstance) => {
  if (axiosInstance?.getUri) {
    try {
      return new URL(axiosInstance.getUri(config)).hostname
    } catch {
      /* fall through */
    }
  }
  const url = String(config?.url || '')
  try {
    if (/^https?:\/\//i.test(url)) return new URL(url).hostname
  } catch {
    /* fall through */
  }
  const base = String(config?.baseURL ?? axiosInstance?.defaults?.baseURL ?? '')
  try {
    if (/^https?:\/\//i.test(base)) return new URL(url || '/', base).hostname
  } catch {
    /* fall through */
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    try {
      return new URL(url || '/', window.location.origin).hostname
    } catch {
      /* fall through */
    }
  }
  return ''
}

/** Only read csrfToken from document when the XHR target host matches the page — avoids wrong token when API is on api.* and cookies are host-scoped. */
const shouldReadDocumentCsrfCookie = (config, axiosInstance, cookieSource) => {
  if (cookieSource !== document || typeof window === 'undefined') return true
  const pageHost = String(window.location.hostname || '').toLowerCase()
  const reqHost = String(resolveRequestHostname(config, axiosInstance) || '').toLowerCase()
  if (!reqHost) return true
  return reqHost === pageHost
}

const readCommonCsrf = (axiosInstance) => {
  const common = axiosInstance?.defaults?.headers?.common
  if (!common) return ''
  if (typeof common.get === 'function') {
    const v = common.get('x-csrf-token')
    if (v != null && String(v).trim()) return String(v).trim()
  }
  const raw = common['x-csrf-token']
  if (raw == null) return ''
  return String(raw).trim()
}

const setRequestHeader = (config, name, value) => {
  const next = config || {}
  next.headers = next.headers || {}
  if (typeof next.headers.set === 'function') {
    next.headers.set(name, value)
  } else {
    next.headers[name] = value
  }
  return next
}

/** @param {import('axios').AxiosInstance | null} [axiosInstance] */
const applyCsrfHeader = (config, cookieSource = document, axiosInstance = null) => {
  const method = String(config?.method || 'get').toUpperCase()
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return config

  let csrfToken = ''
  if (shouldReadDocumentCsrfCookie(config, axiosInstance, cookieSource)) {
    csrfToken = getCookie('csrfToken', cookieSource).trim()
  }
  if (!csrfToken) csrfToken = readCommonCsrf(axiosInstance)
  if (!csrfToken) return config

  return setRequestHeader(config, 'x-csrf-token', csrfToken)
}

const installedInterceptors = new WeakSet()

const installCsrfInterceptor = (axiosInstance, cookieSource = document) => {
  if (!axiosInstance?.interceptors?.request?.use || installedInterceptors.has(axiosInstance)) return
  installedInterceptors.add(axiosInstance)
  axiosInstance.interceptors.request.use((config) => applyCsrfHeader(config, cookieSource, axiosInstance))
}

export {
  getCookie,
  applyCsrfHeader,
  installCsrfInterceptor,
}
