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
        <Text style={styles.headerSubline}>{headerSubline}</Text>
      </View>

      <View style={styles.cardsRow}>
        {METALS.map(({ key, label, swatch, sym, symColor }) => {
          const price = snapshot[key]
          const move =
            snapshot.deltas && snapshot.prevSnapshot
              ? fmtMoveRow(snapshot.deltas[key], snapshot.prevSnapshot[key])
              : null

          return (
            <View key={key} style={styles.card}>
              <View style={[styles.swatch, { backgroundColor: swatch }]}>
                <Text style={[styles.swatchText, { color: symColor }]}>{sym}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.metalLabel} numberOfLines={1}>
                  {label}
                </Text>
                <Text
                  style={styles.spotPrice}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.9}
                >
                  {fmtSpot(price)}
                </Text>
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
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E3A8A',
    letterSpacing: 0.4,
  },
  headerSubline: {
    fontSize: 11,
    color: mgBranding.colors.muted,
    fontWeight: '600',
  },
  cardsRow: {
    flexDirection: 'column',
    gap: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  swatchText: {
    fontSize: 9,
    fontWeight: '800',
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  metalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  spotPrice: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: '700',
    color: mgBranding.colors.text,
    fontVariant: ['tabular-nums'],
  },
  moveRow: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    flexWrap: 'wrap',
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
