/**
 * Register Web Push after dashboard login (HTTPS or localhost).
 * Requires VITE_WEB_PUSH_PUBLIC_KEY and backend WEB_PUSH_* VAPID keys.
 */

import axios, { apiUrl } from '../api/client'

const STORAGE_KEY = 'ops_dashboard_web_push_subscription_v1'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export function isWebPushConfigured() {
  const key = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY
  return Boolean(String(key || '').trim())
}

export async function ensureWebPushSubscription() {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  const vapidPublic = String(import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY || '').trim()
  if (!vapidPublic) return

  if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    await reg.update()

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublic),
      })
    }

    const json = sub.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return

    await axios.post(apiUrl('/api/auth/me/web-push-subscription'), json, { withCredentials: true })
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(json))
  } catch {
    // Permission denied, wrong key, or network — ignore
  }
}

export async function teardownWebPush() {
  if (typeof window === 'undefined') return

  try {
    const reg = await navigator.serviceWorker.getRegistration('/')
    const sub = reg ? await reg.pushManager.getSubscription() : null
    const json = sub?.toJSON()
    if (json?.endpoint) {
      try {
        await axios.delete(apiUrl('/api/auth/me/web-push-subscription'), {
          withCredentials: true,
          data: { endpoint: json.endpoint },
        })
      } catch {
        // ignore
      }
      await sub.unsubscribe().catch(() => {})
    }
  } catch {
    // ignore
  }
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
