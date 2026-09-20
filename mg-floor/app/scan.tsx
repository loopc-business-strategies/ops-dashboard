import React, { useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { BigButton, Screen, Subtitle } from '@/src/components/ui'
import { resolveScan } from '@/src/api/floor'
import { colors, spacing } from '@/src/theme'

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions()
  const [manual, setManual] = useState('')
  const [result, setResult] = useState<string>('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [scanned, setScanned] = useState(false)

  const runResolve = async (code: string) => {
    if (!code.trim()) return
    setBusy(true)
    setError('')
    try {
      const res = await resolveScan(code.trim())
      if (!res.match) {
        setResult('')
        setError(res.message || 'No match for scanned code')
      } else {
        setResult(JSON.stringify(res.match, null, 2))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan resolve failed')
    } finally {
      setBusy(false)
    }
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
          <Subtitle>Point at job / batch / material QR</Subtitle>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {result ? <Text style={styles.result}>{result}</Text> : null}
          <BigButton label="SCAN AGAIN" onPress={() => { setScanned(false); setResult(''); setError('') }} tone="neutral" />
          <TextInput
            style={styles.input}
            value={manual}
            onChangeText={setManual}
            placeholder="Manual code"
            placeholderTextColor={colors.textMuted}
          />
          <BigButton label={busy ? 'RESOLVING…' : 'RESOLVE CODE'} onPress={() => runResolve(manual)} disabled={busy} />
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.bg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  label: { color: colors.textMuted, marginTop: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    color: colors.text,
    padding: 14,
    fontSize: 16,
  },
  error: { color: colors.danger, fontWeight: '600' },
  result: { color: colors.text, fontFamily: 'monospace', fontSize: 12 },
})
