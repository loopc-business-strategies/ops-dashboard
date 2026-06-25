import { useMemo } from 'react'
import useLiveMetalRates from '../../../hooks/useLiveMetalRates'
import { resolveEffectiveSpotPrices } from '../../../utils/liveMetalRates'

/**
 * Central ERP live spot prices (gram USD) derived from the shared metal rates context.
 */
export function useErpLiveMetalSpotPrices() {
  const { snapshot } = useLiveMetalRates()
  const gold = snapshot?.gold
  const silver = snapshot?.silver
  const platinum = snapshot?.platinum
  const unit = snapshot?.unit
  const updatedAt = snapshot?.updatedAt
  const currency = snapshot?.currency

  return useMemo(() => {
    const { goldPriceUSD, silverPriceUSD } = resolveEffectiveSpotPrices({ liveSnapshot: snapshot })
    return {
      snapshot,
      goldPriceUSD,
      silverPriceUSD,
      liveRecalcEnabled: goldPriceUSD > 0 || silverPriceUSD > 0,
      liveMetalTick: updatedAt || `${gold}-${silver}`,
    }
  }, [snapshot, gold, silver, platinum, unit, updatedAt, currency])
}
