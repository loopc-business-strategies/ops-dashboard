import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native'
import { colors, spacing } from '@/src/theme'

export function useIsTablet() {
  const { width, height } = useWindowDimensions()
  return Math.min(width, height) >= 600 || width >= 900
}

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.screen, style]}>{children}</View>
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>
}

export function StatusPill({
  label,
  tone = 'neutral',
}: {
  label: string
  tone?: 'neutral' | 'ok' | 'warn' | 'bad'
}) {
  const bg =
    tone === 'ok'
      ? colors.success
      : tone === 'warn'
        ? colors.warning
        : tone === 'bad'
          ? colors.danger
          : colors.surfaceAlt
  const textColor = tone === 'neutral' ? colors.text : colors.onAccent
  return (
    <View style={[styles.pill, { backgroundColor: bg, borderWidth: tone === 'neutral' ? 1 : 0, borderColor: colors.border }]}>
      <Text style={[styles.pillText, { color: textColor }]}>{label}</Text>
    </View>
  )
}

export function BigButton({
  label,
  onPress,
  disabled,
  tone = 'accent',
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  tone?: 'accent' | 'danger' | 'neutral'
}) {
  const bg =
    tone === 'danger' ? colors.danger : tone === 'neutral' ? colors.surfaceAlt : colors.accent
  const textColor = tone === 'neutral' ? colors.text : colors.onAccent
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.bigBtn,
        {
          backgroundColor: bg,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          borderWidth: tone === 'neutral' ? 1 : 0,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.bigBtnText, { color: textColor }]}>{label}</Text>
    </Pressable>
  )
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.subtitle}>{label}</Text>
    </View>
  )
}

export function WeightDisplay({
  weight,
  unit = 'g',
  stable,
  connectionStatus,
  lastReadingAt,
  onReconnect,
}: {
  weight: number | null
  unit?: string
  stable: boolean | null
  connectionStatus?: string | null
  lastReadingAt?: string | null
  onReconnect?: () => void
}) {
  const conn = String(connectionStatus || '').toUpperCase()
  const connTone =
    conn === 'CONNECTED' ? 'ok' : conn === 'DISCONNECTED' || conn === 'ERROR' ? 'bad' : conn ? 'warn' : 'neutral'
  return (
    <View style={styles.weightBox}>
      {conn ? <StatusPill label={conn} tone={connTone} /> : null}
      <Text style={styles.weightValue}>
        {weight == null ? '—' : weight.toFixed(2)} <Text style={styles.weightUnit}>{unit}</Text>
      </Text>
      <StatusPill
        label={
          stable == null
            ? conn === 'DISCONNECTED' || conn === 'ERROR'
              ? 'NO LIVE READING'
              : 'WAITING FOR SCALE'
            : stable
              ? 'STABLE'
              : 'WAITING FOR STABLE WEIGHT'
        }
        tone={stable == null ? 'neutral' : stable ? 'ok' : 'warn'}
      />
      {lastReadingAt ? (
        <Text style={styles.weightMeta}>Last reading: {new Date(lastReadingAt).toLocaleTimeString()}</Text>
      ) : null}
      {(conn === 'DISCONNECTED' || conn === 'ERROR') && onReconnect ? (
        <Pressable onPress={onReconnect} style={styles.reconnect}>
          <Text style={styles.reconnectText}>RECONNECT</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    marginTop: 4,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  pillText: {
    color: colors.onAccent,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.6,
  },
  bigBtn: {
    minHeight: 64,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.sm,
  },
  bigBtnText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  weightBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  weightValue: {
    color: colors.text,
    fontSize: 48,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  weightUnit: {
    fontSize: 22,
    color: colors.textMuted,
  },
  weightMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  reconnect: {
    marginTop: spacing.sm,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reconnectText: {
    color: colors.text,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
})
