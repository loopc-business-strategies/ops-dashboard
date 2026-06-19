import type { Router } from 'expo-router'
import type { MobileDeepLinkTarget } from './dashboardDeepLink'

export function navigateDeepLink(router: Router, target: MobileDeepLinkTarget) {
  if (target.screen === 'chat') {
    if (target.chatId) {
      router.push({ pathname: '/chat/[chatId]' as never, params: { chatId: target.chatId } })
      return
    }
    router.push('/(tabs)/chat')
    return
  }

  if (target.screen === 'erp') {
    router.push({
      pathname: '/(tabs)/erp' as never,
      params: {
        account: target.account || '',
        view: target.view || '',
        subTab: target.erpSubTab || (target.account ? 'enquiry' : 'reports'),
      },
    })
    return
  }

  if (target.screen === 'settings') {
    router.push('/(tabs)/settings')
    return
  }

  router.push('/(tabs)/home')
}
