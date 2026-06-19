import { StyleSheet, Text, View } from 'react-native'
import { useLiveMetalRates } from '@/src/hooks/useLiveMetalRates'
import { mgBranding } from '@/src/config/branding'
import {
  fmtMoveRow,
  fmtSpot,
  formatLiveMetalSourceLabel,
  formatLiveMetalUnit,
  isMt4BridgeRates,
  metalErrorLabel,
  metalStatusSubline,
} from '@/src/utils/liveMetalRates'

const METALS = [
  { key: 'gold' as const, label: 'Gold', swatch: '#FACC15', sym: 'Au', symColor: '#0f172a' },
  { key: 'silver' as const, label: 'Silver', swatch: '#CBD5E1', sym: 'Ag', symColor: '#0f172a' },
  { key: 'platinum' as const, label: 'Platinum', swatch: '#A855F7', sym: 'Pt', symColor: '#fafafa' },
]

export function LiveMetalPricesBar() {
  const { snapshot, error } = useLiveMetalRates()
  const feedLabel = formatLiveMetalSourceLabel(snapshot.source)
  const isMt4 = isMt4BridgeRates(snapshot)
  const updatedLabel = snapshot.updatedAt
    ? new Date(snapshot.updatedAt).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null

  const headerSubline = error
    ? metalErrorLabel(error) || 'Feed unavailable'
    : isMt4 && updatedLabel
      ? `MT4 live · updated ${updatedLabel}`
      : feedLabel && updatedLabel
        ? `${feedLabel} · updated ${updatedLabel}`
        : 'Waiting for live feed…'

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>LIVE SPOT PRICES</Text>
        <Text style={styles.headerSubline} numberOfLines={1}>
          {headerSubline}
        </Text>
      </View>

      <View style={styles.cardsRow}>
        {METALS.map(({ key, label, swatch, sym, symColor }) => {
          const price = snapshot[key]
          const move =
            snapshot.deltas && snapshot.prevSnapshot && !error
              ? fmtMoveRow(snapshot.deltas[key], snapshot.prevSnapshot[key])
              : null

          return (
            <View key={key} style={styles.card}>
              <View style={[styles.swatch, { backgroundColor: swatch }]}>
                <Text style={[styles.swatchText, { color: symColor }]}>{sym}</Text>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.priceRow}>
                  <Text style={styles.metalLabel}>{label}</Text>
                  <Text style={styles.spotPrice}>{fmtSpot(price)}</Text>
                </View>
                <Text
                  style={[
                    styles.moveRow,
                    error
                      ? styles.moveMuted
                      : move
                        ? move.up
                          ? styles.moveUp
                          : styles.moveDown
                        : styles.moveMuted,
                  ]}
                  numberOfLines={1}
                >
                  {move ? `${move.arrow} ${move.rest}` : metalStatusSubline(snapshot, price, error)}
                </Text>
              </View>
            </View>
          )
        })}
      </View>

      <Text style={styles.footnote}>
        {`Prices in ${snapshot.currency || 'USD'}/${formatLiveMetalUnit(snapshot.unit || 'TOZ')}. Equity and margin columns update as spot moves.`}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    marginBottom: 14,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFD0E5',
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E3A8A',
    letterSpacing: 0.4,
  },
  headerSubline: {
    flex: 1,
    fontSize: 11,
    color: mgBranding.colors.muted,
    fontWeight: '600',
    textAlign: 'right',
  },
  cardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    minWidth: '30%',
    flexGrow: 1,
    flexBasis: '30%',
    maxWidth: '100%',
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchText: {
    fontSize: 8,
    fontWeight: '800',
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 6,
  },
  metalLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  spotPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: mgBranding.colors.text,
    fontVariant: ['tabular-nums'],
  },
  moveRow: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
  },
  moveUp: {
    color: mgBranding.colors.success,
  },
  moveDown: {
    color: mgBranding.colors.danger,
  },
  moveMuted: {
    color: '#94A3B8',
  },
  footnote: {
    marginTop: 8,
    fontSize: 11,
    color: mgBranding.colors.muted,
  },
})
