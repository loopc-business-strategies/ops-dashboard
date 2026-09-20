import React, { useEffect, useState } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { BigButton, LoadingBlock, Screen, StatusPill, Subtitle } from '@/src/components/ui'
import { fetchScaleStatus, fetchScales } from '@/src/api/floor'
import { colors, spacing } from '@/src/theme'

export default function ScalesScreen() {
  const [scales, setScales] = useState<Array<Record<string, unknown>>>([])
  const [detail, setDetail] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetchScales()
      setScales(res.scales || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    )
  }

  return (
    <Screen>
      <Subtitle>Seven MG scales — status & diagnostics</Subtitle>
      <BigButton label="REFRESH" onPress={load} tone="neutral" />
      <FlatList
        data={scales}
        keyExtractor={(item) => String(item.scaleId)}
        renderItem={({ item }) => {
          const status = String(item.status || 'UNKNOWN')
          const tone =
            status === 'STABLE' || status === 'CONNECTED'
              ? 'ok'
              : status === 'ERROR' || status === 'DISCONNECTED'
                ? 'bad'
                : 'warn'
          return (
            <View style={styles.row}>
              <Text style={styles.title}>{String(item.scaleId)}</Text>
              <Text style={styles.meta}>
                {String(item.model || '')} · {String(item.connectionType || '')} · {String(item.department || 'unassigned')}
              </Text>
              <StatusPill label={status} tone={tone} />
              <Text style={styles.meta}>
                Last: {item.lastWeight != null ? `${item.lastWeight} g` : '—'} ·{' '}
                {item.lastSeenAt ? new Date(String(item.lastSeenAt)).toLocaleString() : 'never'}
              </Text>
              <BigButton
                label="READ STATUS"
                tone="neutral"
                onPress={async () => {
                  const s = await fetchScaleStatus(String(item.scaleId))
                  setDetail(JSON.stringify(s, null, 2))
                }}
              />
            </View>
          )
        }}
      />
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: 8,
  },
  title: { color: colors.text, fontWeight: '800', fontSize: 18 },
  meta: { color: colors.textMuted },
  detail: { color: colors.text, fontFamily: 'monospace', fontSize: 11, marginTop: spacing.md },
})
