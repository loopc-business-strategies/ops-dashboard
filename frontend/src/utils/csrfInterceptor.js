const getCookie = (name, cookieSource = document) => {
  const source = String(cookieSource?.cookie || '')
  const target = `${name}=`
  const value = source
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(target))
  return value ? decodeURIComponent(value.slice(target.length)) : ''
}

const applyCsrfHeader = (config, cookieSource = document) => {
  const method = String(config?.method || 'get').toUpperCase()
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return config

  const csrfToken = getCookie('csrfToken', cookieSource)
  if (!csrfToken) return config

  const nextConfig = config || {}
  nextConfig.headers = nextConfig.headers || {}
  nextConfig.headers['x-csrf-token'] = csrfToken
  return nextConfig
}

const installedInterceptors = new WeakSet()

const installCsrfInterceptor = (axiosInstance, cookieSource = document) => {
  if (!axiosInstance?.interceptors?.request?.use || installedInterceptors.has(axiosInstance)) return
  installedInterceptors.add(axiosInstance)
  axiosInstance.interceptors.request.use((config) => applyCsrfHeader(config, cookieSource))
}

export {
  getCookie,
  applyCsrfHeader,
  installCsrfInterceptor,
}
