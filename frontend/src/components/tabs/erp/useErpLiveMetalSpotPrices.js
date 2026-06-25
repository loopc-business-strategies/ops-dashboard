import { useMemo } from 'react'
import useLiveMetalRates from '../../hooks/useLiveMetalRates'
import { resolveEffectiveSpotPrices } from '../../utils/liveMetalRates'

/**
 * Central ERP live spot prices (gram USD) derived from the shared metal rates context.
 */
export function useErpLiveMetalSpotPrices() {
  const { snapshot } = useLiveMetalRates()

  return useMemo(() => {
    const { goldPriceUSD, silverPriceUSD } = resolveEffectiveSpotPrices({ liveSnapshot: snapshot })
    return {
      snapshot,
      goldPriceUSD,
      silverPriceUSD,
      liveRecalcEnabled: goldPriceUSD > 0 || silverPriceUSD > 0,
    }
  }, [snapshot])
}
