import React, { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { BigButton, Screen, StatusPill, Subtitle } from '@/src/components/ui'
import { resolveScan } from '@/src/api/floor'
import { userFacingMessage } from '@/src/api/errors'
import { ApiError } from '@/src/api/errors'
import { colors, spacing } from '@/src/theme'

type ResolvePhase = 'idle' | 'scanned' | 'resolving' | 'verified' | 'not_found' | 'unavailable'

export default function ScanScreen() {
  const router = useRouter()
  const [permission, requestPermission] = useCameraPermissions()
  const [manual, setManual] = useState('')
  const [phase, setPhase] = useState<ResolvePhase>('idle')
  const [error, setError] = useState('')
  const [scanned, setScanned] = useState(false)
  const [match, setMatch] = useState<Record<string, unknown> | null>(null)
  const [lastCode, setLastCode] = useState('')

  const runResolve = async (code: string) => {
    if (!code.trim()) return
    setLastCode(code.trim())
    setPhase('scanned')
    setError('')
    setMatch(null)
    setPhase('resolving')
    try {
      const res = await resolveScan(code.trim())
      if (!res.match) {
        setPhase('not_found')
        setError(res.message || 'NOT FOUND')
      } else {
        setMatch(res.match)
        setPhase('verified')
      }
    } catch (err) {
      const e = err instanceof ApiError ? err : null
      if (e && (e.kind === 'NETWORK_ERROR' || e.kind === 'TIMEOUT' || e.kind === 'OFFLINE')) {
        setPhase('unavailable')
        setError('Unable to verify now.')
      } else {
        setPhase('unavailable')
        setError(userFacingMessage(err) || 'Unable to verify now.')
      }
    }
  }

  const reset = () => {
    setScanned(false)
    setMatch(null)
    setError('')
    setPhase('idle')
    setLastCode('')
  }

  const openMetalIn = () => {
    const passId = String(match?.passId || match?._id || match?.id || '')
    router.push({ pathname: '/metal-in', params: passId ? { passId } : {} })
  }

  const openMetalOut = () => {
    const batchId = String(match?.batchId || match?._id || '')
    const batchNumber = String(match?.batchNumber || '')
    router.push({
      pathname: '/metal-out',
      params: {
        ...(batchId ? { batchId } : {}),
        ...(batchNumber ? { batchNumber } : {}),
      },
    })
  }

  const openTransfer = () => {
    const batchId = String(match?.batchId || match?._id || '')
    router.push({
      pathname: '/transfer',
      params: batchId ? { batchId } : {},
    })
  }

  if (!permission?.granted) {
    return (
      <Screen>
        <Subtitle>Camera permission required for QR/barcode scanning</Subtitle>
        <BigButton label="ALLOW CAMERA" onPress={() => requestPermission()} />
        <Text style={styles.label}>Or enter code manually</Text>
        <TextInput style={styles.input} value={manual} onChangeText={setManual} placeholderTextColor={colors.textMuted} />
        <BigButton label="RESOLVE" onPress={() => runResolve(manual)} disabled={phase === 'resolving'} />
      </Screen>
    )
  }

  return (
    <Screen style={{ padding: 0 }}>
      <View style={{ flex: 1 }}>
        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13'] }}
          onBarcodeScanned={
            scanned
              ? undefined
              : ({ data }) => {
                  setScanned(true)
                  runResolve(String(data))
                }
          }
        />
        <View style={styles.panel}>
          {phase === 'scanned' || phase === 'resolving' ? (
            <View style={styles.row}>
              <StatusPill label="SCANNED" tone="neutral" />
              {phase === 'resolving' ? (
                <>
                  <StatusPill label="RESOLVING…" tone="warn" />
                  <ActivityIndicator color={colors.accent} />
                </>
              ) : null}
            </View>
          ) : null}
          {phase === 'verified' ? <StatusPill label="VERIFIED" tone="ok" /> : null}
          {phase === 'not_found' ? <StatusPill label="NOT FOUND" tone="bad" /> : null}
          {phase === 'unavailable' ? <StatusPill label="UNAVAILABLE" tone="warn" /> : null}
          {lastCode ? <Text style={styles.meta}>Code: {lastCode}</Text> : null}
          {error ? <Text style={styles.err}>{error}</Text> : null}
          {match ? (
            <>
              <Text style={styles.result} numberOfLines={6}>
                {JSON.stringify(match, null, 2)}
              </Text>
              <BigButton label="OPEN METAL IN" onPress={openMetalIn} />
              <BigButton label="OPEN METAL OUT" onPress={openMetalOut} />
              <BigButton label="OPEN TRANSFER" onPress={openTransfer} />
            </>
          ) : null}
          <BigButton label="SCAN AGAIN" tone="neutral" onPress={reset} />
          <Text style={styles.label}>Manual code</Text>
          <TextInput style={styles.input} value={manual} onChangeText={setManual} placeholderTextColor={colors.textMuted} />
          <BigButton label="RESOLVE" onPress={() => runResolve(manual)} disabled={phase === 'resolving'} />
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  panel: {
    padding: spacing.md,
    backgroundColor: colors.bg,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  label: { color: colors.textMuted, fontWeight: '700' },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    color: colors.text,
    padding: 12,
  },
  result: { color: colors.textMuted, fontSize: 11, fontFamily: 'monospace' },
  err: { color: '#f87171' },
  meta: { color: colors.textMuted, fontSize: 12 },
})
