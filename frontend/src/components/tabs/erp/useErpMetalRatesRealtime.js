import { useEffect } from 'react'
import { startMetalRatesRealtime } from '../../../utils/realtimeSocket'
import { erpTabNeedsLiveMetalRates } from './erpTabUtils'

/**
 * Subscribes to live metal rates without coupling socket wiring to ERPTab render body.
 * Updates parent metal state only on tabs that display rates; enquiry patches via callback.
 */
export function useErpMetalRatesRealtime({
  token,
  tenant,
  canAccessERP,
  activeTabRef,
  accountEnquiryDataRef,
  metalRatesRef,
  onMetalRatesForTabs,
  onEnquiryMetalRatesPatch,
}) {
  useEffect(() => {
    if (!token || !canAccessERP) return undefined

    let stopMetalRatesRealtime = () => {}
    const timer = window.setTimeout(() => {
      stopMetalRatesRealtime = startMetalRatesRealtime({
        token,
        tenant,
        onRatesUpdate: (payload) => {
          const rates = payload?.rates || payload?.data?.rates
          if (!rates) return
          metalRatesRef.current = rates
          const tab = activeTabRef.current
          if (erpTabNeedsLiveMetalRates(tab)) {
            onMetalRatesForTabs(rates)
          }
          if (tab === 'enquiry' && accountEnquiryDataRef.current?.account?.accountCode) {
            onEnquiryMetalRatesPatch(rates)
          }
        },
      })
    }, 300)

    return () => {
      window.clearTimeout(timer)
      stopMetalRatesRealtime()
    }
  }, [
    token,
    tenant,
    canAccessERP,
    activeTabRef,
    accountEnquiryDataRef,
    metalRatesRef,
    onMetalRatesForTabs,
    onEnquiryMetalRatesPatch,
  ])
}
