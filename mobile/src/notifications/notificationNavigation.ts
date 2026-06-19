import type { NotificationPayload } from '@/src/realtime/notificationsSocket'
import { mapPayloadToItem } from '@/src/notifications/notificationMap'
import { resolveMobileNotificationRoute } from '@/src/notifications/resolveNotificationRoute'
import type { MobileDeepLinkTarget } from '@/src/navigation/dashboardDeepLink'

export function notificationPayloadToDeepLink(payload: NotificationPayload): MobileDeepLinkTarget | null {
  const item = mapPayloadToItem(payload)
  const route = resolveMobileNotificationRoute(item)
  if (!route) return null

  if (route.screen === 'chat') {
    return { screen: 'chat', chatId: route.chatId }
  }

  return {
    screen: 'erp',
    erpSubTab: route.erpSubTab,
    account: route.account,
    view: route.view,
  }
}
