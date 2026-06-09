const getCookie = (name, cookieSource = document) => {
  const source = String(cookieSource?.cookie || '')
  const target = `${name}=`
  const value = source
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(target))
  return value ? decodeURIComponent(value.slice(target.length)) : ''
}

const readCommonCsrf = (axiosInstance) => {
  const raw = axiosInstance?.defaults?.headers?.common?.['x-csrf-token']
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

  let csrfToken = getCookie('csrfToken', cookieSource).trim()
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
