import { useEffect } from 'react'
import { enquiryDeepLinkKey, parseEnquiryDeepLink } from '../../../../utils/dashboardNavigation'

/**
 * URL + notification deep links for Account Summary (erp-enquiry).
 * Caller owns lastEnquiryDeepLinkKeyRef so fetchAccountEnquiryByCode can dedupe loads.
 */
export function useEnquiryDeepLinkEffects({
  activeTab,
  searchParams,
  lastEnquiryDeepLinkKeyRef,
  fetchAccountEnquiryByCode,
  jumpToEnquiryAccountCode,
  onJumpToEnquiryConsumed,
  setActiveTabGuarded,
}) {
  useEffect(() => {
    if (!jumpToEnquiryAccountCode || typeof onJumpToEnquiryConsumed !== 'function') return undefined
    let cancelled = false
    ;(async () => {
      try {
        const code = String(jumpToEnquiryAccountCode || '').trim()
        if (!code) return
        setActiveTabGuarded('enquiry')
        await fetchAccountEnquiryByCode(code, { openModal: true })
      } finally {
        if (!cancelled) onJumpToEnquiryConsumed()
      }
    })()
    return () => {
      cancelled = true
    }
    // One-shot deep link from notifications; fetchAccountEnquiryByCode intentionally omitted from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpToEnquiryAccountCode, onJumpToEnquiryConsumed])

  useEffect(() => {
    if (activeTab !== 'enquiry') {
      lastEnquiryDeepLinkKeyRef.current = ''
      return undefined
    }
    const { account, view } = parseEnquiryDeepLink(searchParams.toString())
    if (!account) {
      lastEnquiryDeepLinkKeyRef.current = ''
      return undefined
    }
    const key = enquiryDeepLinkKey({ account, view })
    if (lastEnquiryDeepLinkKeyRef.current === key) return undefined
    lastEnquiryDeepLinkKeyRef.current = key
    let cancelled = false
    ;(async () => {
      await fetchAccountEnquiryByCode(account, {
        openModal: true,
        openStatementPreview: view === 'statement',
      })
      if (cancelled) lastEnquiryDeepLinkKeyRef.current = ''
    })()
    return () => {
      cancelled = true
    }
    // Deep link from URL; fetchAccountEnquiryByCode intentionally omitted from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, searchParams])
}
