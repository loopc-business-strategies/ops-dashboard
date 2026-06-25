import { useLiveMetalRates } from '@/src/hooks/useLiveMetalRates'
import { resolveEffectiveSpotPrices } from '@/src/utils/liveMetalRates'

/**
 * Central ERP live spot prices (gram USD) derived from the shared metal rates context.
 */
export function useErpLiveMetalSpotPrices() {
  const { snapshot } = useLiveMetalRates()
  const { goldPriceUSD, silverPriceUSD } = resolveEffectiveSpotPrices({ liveSnapshot: snapshot })

  return {
    snapshot,
    goldPriceUSD,
    silverPriceUSD,
    liveRecalcEnabled: goldPriceUSD > 0 || silverPriceUSD > 0,
  }
}
