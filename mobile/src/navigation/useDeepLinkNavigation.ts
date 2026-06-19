import { useEffect } from 'react'
import * as Linking from 'expo-linking'
import { useRouter } from 'expo-router'
import { useAuth } from '@/src/context/AuthContext'
import { parseIncomingDeepLink } from './dashboardDeepLink'
import { consumePendingDeepLink, setPendingDeepLink } from './pendingDeepLink'
import { navigateDeepLink } from './deepLinkRouter'
import { notificationPayloadToDeepLink } from '@/src/notifications/notificationNavigation'
import * as Notifications from 'expo-notifications'
import { expoNotificationToPayload } from '@/src/context/NotificationsContext'

function handleIncomingUrl(router: ReturnType<typeof useRouter>, rawUrl: string, isAuthenticated: boolean) {
  const target = parseIncomingDeepLink(rawUrl)
  if (!target) return

  if (!isAuthenticated) {
    setPendingDeepLink(target)
    router.replace('/login')
    return
  }

  navigateDeepLink(router, target)
}

export function useDeepLinkNavigation() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (isLoading) return undefined

    const pending = consumePendingDeepLink()
    if (pending && isAuthenticated) {
      navigateDeepLink(router, pending)
    }

    let active = true
    void Linking.getInitialURL().then((url) => {
      if (!active || !url) return
      handleIncomingUrl(router, url, isAuthenticated)
    })

    const sub = Linking.addEventListener('url', ({ url }) => {
      handleIncomingUrl(router, url, isAuthenticated)
    })

    const pushSub = Notifications.addNotificationResponseReceivedListener((response) => {
      if (!isAuthenticated) return
      const payload = expoNotificationToPayload(response.notification)
      const target = notificationPayloadToDeepLink(payload)
      if (target) navigateDeepLink(router, target)
    })

    if (isAuthenticated) {
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (!active || !response?.notification) return
        const target = notificationPayloadToDeepLink(expoNotificationToPayload(response.notification))
        if (target) navigateDeepLink(router, target)
      })
    }

    return () => {
      active = false
      sub.remove()
      pushSub.remove()
    }
  }, [isAuthenticated, isLoading, router])
}
