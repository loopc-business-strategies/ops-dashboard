export type MobileDeepLinkTarget = {
  screen: 'home' | 'chat' | 'erp' | 'settings' | 'transactions'
  chatId?: string
  erpSubTab?: string
  account?: string
  view?: string
}

function readTabParam(params: URLSearchParams): string | null {
  return String(params.get('tab') || '').trim() || null
}

function parseErpTab(tabParam: string): Pick<MobileDeepLinkTarget, 'erpSubTab' | 'account' | 'view'> | null {
  if (!tabParam.startsWith('erp-')) return null
  const erpSubTab = tabParam.replace(/^erp-/, '')
  return {
    erpSubTab,
    account: undefined,
    view: undefined,
  }
}

/**
 * Parse nexaops://, legacy mgops://, or https:// tenant URLs into mobile navigation targets.
 * Web parity: /dashboard?tab=erp-enquiry&account=CODE&view=statement
 */
export function parseIncomingDeepLink(rawUrl: string): MobileDeepLinkTarget | null {
  const trimmed = String(rawUrl || '').trim()
  if (!trimmed) return null

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }

  const params = url.searchParams
  const tabParam = readTabParam(params)
  const account = String(params.get('account') || '').trim() || undefined
  const view = String(params.get('view') || '').trim() || undefined

  if (tabParam) {
    if (tabParam === 'chat') return { screen: 'chat' }
    if (tabParam === 'overview') return { screen: 'home' }
    if (tabParam === 'erp-transactions' || tabParam === 'transactions') return { screen: 'transactions' }
    if (tabParam.startsWith('erp-')) {
      const erp = parseErpTab(tabParam)
      if (!erp) return null
      return {
        screen: 'erp',
        erpSubTab: erp.erpSubTab,
        account,
        view,
      }
    }
    return { screen: 'home' }
  }

  const host = String(url.hostname || '').toLowerCase()
  const path = String(url.pathname || '').replace(/^\//, '').toLowerCase()

  if (host === 'chat' || path === 'chat') return { screen: 'chat' }
  if (host === 'erp' || path === 'erp') {
    return {
      screen: 'erp',
      erpSubTab: String(params.get('subTab') || params.get('erpSub') || 'reports').trim() || 'reports',
      account,
      view,
    }
  }
  if (host === 'dashboard' || path === 'dashboard' || path.includes('dashboard')) {
    if (tabParam) {
      return parseIncomingDeepLink(`nexaops://local?${params.toString()}`)
    }
    return { screen: 'home' }
  }

  return null
}

export function buildNexaDashboardHref({
  tab = 'erp-enquiry',
  account,
  view,
}: {
  tab?: string
  account?: string
  view?: string
} = {}) {
  const params = new URLSearchParams()
  params.set('tab', tab)
  if (account) params.set('account', account)
  if (view === 'statement') params.set('view', 'statement')
  return `nexaops://dashboard?${params.toString()}`
}

/** @deprecated Use buildNexaDashboardHref. Kept for callers during the scheme migration. */
export const buildMgopsDashboardHref = buildNexaDashboardHref
