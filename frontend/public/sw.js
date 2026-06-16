/* eslint-disable no-undef */
// Service worker for Web Push (Ops Dashboard). Served from site root.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = { title: 'Ops Dashboard', body: 'New activity', url: '/dashboard' }
  try {
    const text = event.data?.text()
    if (text) {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed === 'object') payload = { ...payload, ...parsed }
    }
  } catch {
    // keep defaults
  }
  const title = String(payload.title || 'Ops Dashboard').slice(0, 120)
  const body = String(payload.body || '').slice(0, 500)
  const url = String(payload.url || '/dashboard')
  const options = {
    body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: { url },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification?.data?.url || '/dashboard'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
      return undefined
    }),
  )
})
