import React, { useEffect, useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { BigButton, Screen, StatusPill, Subtitle, Title } from '@/src/components/ui'
import { useAuth } from '@/src/context/AuthContext'
import { pendingCount } from '@/src/offline/outbox'
import { flushOutbox } from '@/src/offline/sync'
import { APP_ENV, API_URL } from '@/src/config/env'
import { MG_TENANT } from '@/src/config/tenant'
import { colors, spacing } from '@/src/theme'

export default function ProfileScreen() {
  const { user, shift, permissions, logout, refresh } = useAuth()
  const [pending, setPending] = useState(0)
  const [syncMsg, setSyncMsg] = useState('')

  useEffect(() => {
    pendingCount().then(setPending)
  }, [])

  return (
    <Screen>
      <Title>Profile</Title>
      <Subtitle>{user?.name}</Subtitle>
      <Text style={styles.line}>Role: {user?.role}</Text>
      <Text style={styles.line}>Production role: {user?.productionRole || '—'}</Text>
      <Text style={styles.line}>Department: {user?.department || '—'}</Text>
      <Text style={styles.line}>
        Shift:{' '}
        {shift && typeof shift === 'object' && shift !== null && 'name' in shift
          ? String((shift as { name?: string }).name)
          : '—'}
      </Text>
      <Text style={styles.line}>Tenant: {MG_TENANT} (locked)</Text>
      <Text style={styles.line}>Env: {APP_ENV}</Text>
      <Text style={styles.line}>API: {API_URL}</Text>
      <StatusPill label={`PENDING SYNC ${pending}`} tone={pending ? 'warn' : 'ok'} />
      <Text style={styles.perms}>Permissions: {Object.entries(permissions).filter(([, v]) => v).map(([k]) => k).join(', ') || '—'}</Text>
      {syncMsg ? <Text style={styles.line}>{syncMsg}</Text> : null}
      <BigButton
        label="SYNC NOW"
        onPress={async () => {
          try {
            await flushOutbox()
            setPending(await pendingCount())
            setSyncMsg('Sync complete')
          } catch (err) {
            setSyncMsg(err instanceof Error ? err.message : 'Sync failed')
          }
        }}
      />
      <BigButton label="REFRESH PROFILE" onPress={() => refresh()} tone="neutral" />
      <BigButton label="SIGN OUT" onPress={() => logout()} tone="danger" />
    </Screen>
  )
}

const styles = StyleSheet.create({
  line: { color: colors.text, marginTop: spacing.sm, fontSize: 16 },
  perms: { color: colors.textMuted, marginVertical: spacing.md },
})
