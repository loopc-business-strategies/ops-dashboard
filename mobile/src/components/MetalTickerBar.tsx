import { StyleSheet, Text, View } from 'react-native'
import type { MetalDeltas } from '@/src/context/LiveMetalTickerContext'
import type { MetalSnapshot } from '@/src/utils/liveMetalDisplay'
import {
  fmtMoveRow,
  fmtSpot,
  metalStatusSubline,
} from '@/src/utils/liveMetalDisplay'

const METALS = [
  { key: 'gold' as const, label: 'Gold', sym: 'Au', swatch: '#FACC15', symColor: '#0f172a', labelColor: '#FDE047' },
  { key: 'silver' as const, label: 'Silver', sym: 'Ag', swatch: '#CBD5E1', symColor: '#0f172a', labelColor: 'rgba(248, 250, 252, 0.88)' },
  { key: 'platinum' as const, label: 'Platinum', sym: 'Pt', swatch: '#A855F7', symColor: '#fafafa', labelColor: '#FDE68A' },
]

type Props = {
  snapshot: MetalSnapshot | null
  deltas: MetalDeltas
  errorMessage?: string
}

export function MetalTickerBar({ snapshot, deltas, errorMessage }: Props) {
  return (
    <View style={styles.row}>
      {METALS.map(({ key, label, sym, swatch, symColor, labelColor }) => {
        const price = snapshot ? snapshot[key] : 0
        const prev = snapshot && deltas
          ? price - (deltas[key] ?? 0)
          : 0
        const move = snapshot && deltas && prev > 0
          ? fmtMoveRow(deltas![key], prev)
          : null
        const subError = errorMessage && !snapshot ? errorMessage : ''
        const subline = move
          ? `${move.arrow} ${move.rest}`
          : metalStatusSubline(
              snapshot || { gold: 0, silver: 0, platinum: 0, currency: 'USD', unit: 'TOZ', source: '', updatedAt: null },
              price,
              subError,
            )

        return (
          <View key={key} style={styles.pill}>
            <View style={[styles.badge, { backgroundColor: swatch }]}>
              <Text style={[styles.sym, { color: symColor }]}>{sym}</Text>
            </View>
            <View style={styles.pillBody}>
              <View style={styles.pillTop}>
                <Text style={[styles.metalLabel, { color: labelColor }]} numberOfLines={1}>
                  {label}
                </Text>
                <Text style={styles.price} numberOfLines={1}>
                  {fmtSpot(price)}
                </Text>
              </View>
              <Text
                style={[
                  styles.subline,
                  { color: move ? (move.up ? '#4ade80' : '#f87171') : 'rgba(248,250,252,0.45)' },
                ]}
                numberOfLines={1}
              >
                {subline}
              </Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
  },
  pill: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sym: {
    fontSize: 10,
    fontWeight: '800',
  },
  pillBody: {
    flex: 1,
    minWidth: 0,
  },
  pillTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 4,
  },
  metalLabel: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 0,
  },
  price: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'right',
    flex: 1,
  },
  subline: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
  },
})
