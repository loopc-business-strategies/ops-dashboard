import { useEffect } from 'react'
import { liveRatesToMetalRatesState } from '../../../utils/liveMetalRates'

/**
 * Keeps Account Summary enquiry metals in sync with the shared live snapshot.
 */
export function useErpEnquiryMetalRatesSync({
  snapshot,
  activeTabRef,
  showEnquiryModalRef,
  accountEnquiryDataRef,
  onEnquiryMetalRatesPatch,
}) {
  useEffect(() => {
    const tab = activeTabRef.current
    const enquiryModalOpen = Boolean(showEnquiryModalRef?.current)
    const enquiryActive = tab === 'enquiry' || enquiryModalOpen
    if (!enquiryActive || !accountEnquiryDataRef.current?.account?.accountCode) return
    const synced = liveRatesToMetalRatesState(snapshot)
    if (synced) onEnquiryMetalRatesPatch(synced)
  }, [
    snapshot,
    activeTabRef,
    showEnquiryModalRef,
    accountEnquiryDataRef,
    onEnquiryMetalRatesPatch,
  ])
}

/** @deprecated Use useErpEnquiryMetalRatesSync — socket + poll live in LiveMetalRatesProvider. */
export function useErpMetalRatesRealtime() {
  return undefined
}
