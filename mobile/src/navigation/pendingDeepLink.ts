import type { MobileDeepLinkTarget } from './dashboardDeepLink'

let pending: MobileDeepLinkTarget | null = null

export function setPendingDeepLink(target: MobileDeepLinkTarget | null) {
  pending = target
}

export function consumePendingDeepLink(): MobileDeepLinkTarget | null {
  const next = pending
  pending = null
  return next
}
