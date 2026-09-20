import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { StatusPill } from '@/src/components/ui'
import { colors, spacing } from '@/src/theme'
import type { AsyncStatus } from '@/src/async/types'

export function SectionLoading({
  label = 'Loading…',
  slow,
  onRetry,
}: {
  label?: string
  slow?: boolean
  onRetry?: () => void
}) {
  return (
    <View style={styles.box}>
      <View style={styles.sectionRow}>
        <ActivityIndicator color={colors.accent} size="small" />
        <Text style={styles.muted}>{label}</Text>
      </View>
      {slow ? (
        <>
          <Text style={styles.meta}>Connection is taking longer than expected.</Text>
          {onRetry ? <RetryButton onPress={onRetry} /> : null}
        </>
      ) : null}
    </View>
  )
}

export function InlineSpinner() {
  return <ActivityIndicator color={colors.accent} size="small" />
}

export function RetryButton({ onPress, label = 'RETRY' }: { onPress: () => void; label?: string }) {
  return (
    <Pressable onPress={onPress} style={styles.retryBtn} accessibilityRole="button">
      <Text style={styles.retryText}>{label}</Text>
    </Pressable>
  )
}

export function ErrorState({
  message = 'Unable to load',
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <View style={styles.box}>
      <Text style={styles.error}>{message}</Text>
      {onRetry ? <RetryButton onPress={onRetry} /> : null}
    </View>
  )
}

export function EmptyState({ message }: { message: string }) {
  return <Text style={styles.muted}>{message}</Text>
}

export function OfflineState({
  message = 'OFFLINE',
  lastUpdated,
  onRetry,
}: {
  message?: string
  lastUpdated?: number | null
  onRetry?: () => void
}) {
  return (
    <View style={styles.box}>
      <StatusPill label="OFFLINE" tone="warn" />
      <Text style={styles.muted}>{message}</Text>
      {lastUpdated ? (
        <Text style={styles.meta}>LAST UPDATED: {new Date(lastUpdated).toLocaleString()}</Text>
      ) : null}
      {onRetry ? <RetryButton onPress={onRetry} /> : null}
    </View>
  )
}

export function LastUpdated({
  at,
  fromCache,
}: {
  at?: number | null
  fromCache?: boolean
}) {
  if (!at) return null
  return (
    <Text style={styles.meta}>
      {fromCache ? 'LAST KNOWN · ' : ''}LAST UPDATED: {new Date(at).toLocaleString()}
    </Text>
  )
}

export function ConnectionStatus({
  status,
}: {
  status: 'ONLINE' | 'OFFLINE' | 'RECONNECTING' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | string
}) {
  const tone =
    status === 'ONLINE' || status === 'CONNECTED'
      ? 'ok'
      : status === 'OFFLINE' || status === 'DISCONNECTED' || status === 'ERROR'
        ? 'bad'
        : 'warn'
  return <StatusPill label={status} tone={tone} />
}

export function HardwareStatus({
  label,
  status,
}: {
  label: string
  status: string
}) {
  const u = String(status || 'UNKNOWN').toUpperCase()
  const tone =
    u === 'CONNECTED' || u === 'STABLE' || u === 'READY' || u === 'ONLINE'
      ? 'ok'
      : u === 'ERROR' || u === 'DISABLED' || u === 'DISCONNECTED'
        ? 'bad'
        : 'warn'
  return (
    <View style={styles.hwRow}>
      <Text style={styles.hwLabel}>{label}</Text>
      <StatusPill label={u} tone={tone} />
    </View>
  )
}

export function AsyncSection({
  status,
  loadingLabel,
  error,
  emptyMessage,
  updatedAt,
  fromCache,
  onRetry,
  slow,
  children,
}: {
  status: AsyncStatus
  loadingLabel?: string
  error?: string | null
  emptyMessage?: string
  updatedAt?: number | null
  fromCache?: boolean
  onRetry?: () => void
  slow?: boolean
  children?: React.ReactNode
}) {
  if (status === 'loading' && !children) {
    return <SectionLoading label={loadingLabel} slow={slow} onRetry={onRetry} />
  }
  if (status === 'offline' && !children) {
    return <OfflineState message={error || 'Unable to load — offline'} lastUpdated={updatedAt} onRetry={onRetry} />
  }
  if (status === 'error') {
    return <ErrorState message={error || 'Unable to load'} onRetry={onRetry} />
  }
  if (status === 'empty') {
    return <EmptyState message={emptyMessage || 'Nothing here'} />
  }
  return (
    <View>
      {(status === 'loading' || status === 'retrying') && children ? (
        <SectionLoading
          label={status === 'retrying' ? 'Refreshing…' : loadingLabel}
          slow={slow}
          onRetry={onRetry}
        />
      ) : null}
      {fromCache || updatedAt ? <LastUpdated at={updatedAt} fromCache={fromCache} /> : null}
      {status === 'offline' && children ? (
        <Text style={styles.meta}>OFFLINE — showing last known</Text>
      ) : null}
      {fromCache && status !== 'offline' && children ? (
        <Text style={styles.meta}>LAST KNOWN DATA</Text>
      ) : null}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  box: { gap: spacing.sm, marginVertical: spacing.sm },
  muted: { color: colors.textMuted, fontSize: 14 },
  error: { color: colors.danger, fontSize: 14 },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    marginTop: 4,
  },
  retryText: { color: colors.text, fontWeight: '800', letterSpacing: 0.5 },
  hwRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 4 },
  hwLabel: { color: colors.text, fontWeight: '700' },
})
