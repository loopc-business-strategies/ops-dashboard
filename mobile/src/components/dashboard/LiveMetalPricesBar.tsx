import { StyleSheet, Text, View } from 'react-native'
import { useLiveMetalRates } from '@/src/hooks/useLiveMetalRates'
import { useBrandingStyles } from '@/src/hooks/useBrandingStyles'
import type { MobileTenantBranding } from '@/src/config/tenantBranding'
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

function createStyles(branding: MobileTenantBranding) {
  return StyleSheet.create({
    root: {
      marginBottom: 10,
      padding: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#BFD0E5',
      backgroundColor: '#FFFFFF',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 6,
    },
    headerTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: branding.colors.primary,
      letterSpacing: 0.3,
      flexShrink: 0,
    },
    headerSubline: {
      flex: 1,
      flexShrink: 1,
      fontSize: 10,
      color: branding.colors.muted,
      fontWeight: '600',
      textAlign: 'right',
    },
    cardsRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 6,
    },
    card: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 6,
      paddingHorizontal: 6,
      borderRadius: 6,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#D1D5DB',
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 2,
    },
    swatch: {
      width: 20,
      height: 20,
      borderRadius: 5,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    swatchText: {
      fontSize: 8,
      fontWeight: '800',
    },
    metalLabel: {
      flex: 1,
      minWidth: 0,
      fontSize: 10,
      fontWeight: '600',
      color: '#475569',
    },
    spotPrice: {
      fontSize: 13,
      fontWeight: '700',
      color: branding.colors.text,
      fontVariant: ['tabular-nums'],
      textAlign: 'right',
    },
    moveRow: {
      marginTop: 2,
      fontSize: 9,
      fontWeight: '600',
      textAlign: 'right',
    },
    moveUp: {
      color: branding.colors.success,
    },
    moveDown: {
      color: branding.colors.danger,
    },
    moveMuted: {
      color: '#94A3B8',
    },
    footnote: {
      marginTop: 6,
      fontSize: 10,
      color: branding.colors.muted,
    },
  })
}

export function LiveMetalPricesBar() {
  const styles = useBrandingStyles(createStyles)
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
              <View style={styles.labelRow}>
                <View style={[styles.swatch, { backgroundColor: swatch }]}>
                  <Text style={[styles.swatchText, { color: symColor }]}>{sym}</Text>
                </View>
                <Text style={styles.metalLabel} numberOfLines={1}>
                  {label}
                </Text>
              </View>
              <Text
                style={styles.spotPrice}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
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
                numberOfLines={1}
              >
                {move ? `${move.arrow} ${move.rest}` : metalStatusSubline(snapshot, price, error)}
              </Text>
            </View>
          )
        })}
      </View>

      <Text style={styles.footnote} numberOfLines={1}>
        {`${snapshot.currency || 'USD'}/${formatLiveMetalUnit(snapshot.unit || 'TOZ')} · equity updates with spot`}
      </Text>
    </View>
  )
}
