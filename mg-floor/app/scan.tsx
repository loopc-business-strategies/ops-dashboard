import React, { useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { BigButton, Screen, Subtitle } from '@/src/components/ui'
import { resolveScan } from '@/src/api/floor'
import { colors, spacing } from '@/src/theme'

export default function ScanScreen() {
  const router = useRouter()
  const [permission, requestPermission] = useCameraPermissions()
  const [manual, setManual] = useState('')
  const [result, setResult] = useState<string>('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [match, setMatch] = useState<Record<string, unknown> | null>(null)

  const runResolve = async (code: string) => {
    if (!code.trim()) return
    setBusy(true)
    setError('')
    setMatch(null)
    try {
      const res = await resolveScan(code.trim())
      if (!res.match) {
        setResult('')
        setError(res.message || 'No match for scanned code')
      } else {
        setMatch(res.match)
        setResult(JSON.stringify(res.match, null, 2))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan resolve failed')
    } finally {
      setBusy(false)
    }
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
        <BigButton label="RESOLVE" onPress={() => runResolve(manual)} disabled={busy} />
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
          {error ? <Text style={styles.err}>{error}</Text> : null}
          {result ? <Text style={styles.result} numberOfLines={6}>{result}</Text> : null}
          {match ? (
            <>
              <BigButton label="OPEN METAL IN" onPress={openMetalIn} />
              <BigButton label="OPEN METAL OUT" onPress={openMetalOut} />
              <BigButton label="OPEN TRANSFER" onPress={openTransfer} />
            </>
          ) : null}
          <BigButton
            label="SCAN AGAIN"
            tone="neutral"
            onPress={() => {
              setScanned(false)
              setResult('')
              setMatch(null)
              setError('')
            }}
          />
          <Text style={styles.label}>Manual code</Text>
          <TextInput style={styles.input} value={manual} onChangeText={setManual} placeholderTextColor={colors.textMuted} />
          <BigButton label="RESOLVE" onPress={() => runResolve(manual)} disabled={busy} />
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
})
