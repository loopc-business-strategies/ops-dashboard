import React, { useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { BigButton, StatusPill, Subtitle } from '@/src/components/ui'
import { resolveScan } from '@/src/api/floor'
import { userFacingMessage, ApiError } from '@/src/api/errors'
import { colors, spacing } from '@/src/theme'

function field(match: Record<string, unknown>, ...keys: string[]) {
  for (const k of keys) {
    const v = match[k]
    if (v != null && String(v).trim()) return String(v)
  }
  return '—'
}

type Props = {
  /** Called after backend verify succeeds */
  onVerified: (match: Record<string, unknown>, code: string) => void
  hint?: string
}

/**
 * Primary QR scan + secondary manual code entry (always backend-verified).
 */
export function QrFirstResolve({ onVerified, hint }: Props) {
  const [permission, requestPermission] = useCameraPermissions()
  const [scanning, setScanning] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manual, setManual] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [match, setMatch] = useState<Record<string, unknown> | null>(null)
  const [scanned, setScanned] = useState(false)

  const runResolve = async (code: string) => {
    if (!code.trim()) return
    setBusy(true)
    setError('')
    setMatch(null)
    try {
      const res = await resolveScan(code.trim())
      if (!res.match) {
        setError(res.message || 'NOT FOUND')
        return
      }
      setMatch(res.match)
      onVerified(res.match, code.trim())
    } catch (err) {
      const e = err instanceof ApiError ? err : null
      if (e && (e.kind === 'NETWORK_ERROR' || e.kind === 'TIMEOUT' || e.kind === 'OFFLINE')) {
        setError('Unable to verify now.')
      } else {
        setError(userFacingMessage(err) || 'Unable to verify now.')
      }
    } finally {
      setBusy(false)
    }
  }

  if (!permission?.granted) {
    return (
      <View style={styles.block}>
        <Subtitle>Camera permission required for QR</Subtitle>
        <BigButton label="ALLOW CAMERA" onPress={() => requestPermission()} />
        <BigButton
          label="ENTER CODE MANUALLY"
          tone="neutral"
          onPress={() => setManualOpen(true)}
        />
        {manualOpen ? (
          <View>
            <TextInput
              style={styles.input}
              value={manual}
              onChangeText={setManual}
              placeholder="Job / batch / material code"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />
            <BigButton
              label={busy ? 'VERIFYING…' : 'VERIFY CODE'}
              onPress={() => runResolve(manual)}
              disabled={busy || !manual.trim()}
            />
          </View>
        ) : null}
      </View>
    )
  }

  return (
    <View style={styles.block}>
      <Text style={styles.step}>SCAN QR (PRIMARY)</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {!scanning ? (
        <BigButton label="SCAN QR" onPress={() => { setScanning(true); setScanned(false) }} />
      ) : (
        <View style={styles.camWrap}>
          <CameraView
            style={styles.cam}
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13'] }}
            onBarcodeScanned={
              scanned || busy
                ? undefined
                : ({ data }) => {
                    setScanned(true)
                    setScanning(false)
                    runResolve(String(data || ''))
                  }
            }
          />
          <BigButton label="CLOSE CAMERA" tone="neutral" onPress={() => setScanning(false)} />
        </View>
      )}

      {busy ? <Text style={styles.hint}>Verifying…</Text> : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {match ? (
        <View style={styles.card}>
          <StatusPill label="VERIFIED" tone="ok" />
          <Text style={styles.cardLine}>Batch: {field(match, 'batchNumber', 'batchId', 'passNumber')}</Text>
          <Text style={styles.cardLine}>Job: {field(match, 'jobNumber', 'jobId', 'job')}</Text>
          <Text style={styles.cardLine}>Material: {field(match, 'material', 'materialId', 'alloy')}</Text>
          <Text style={styles.cardLine}>
            Dept: {field(match, 'department', 'currentDepartment', 'fromDepartment', 'toDepartment')}
          </Text>
          <Text style={styles.cardLine}>Status: {field(match, 'status')}</Text>
        </View>
      ) : null}

      <BigButton
        label={manualOpen ? 'HIDE MANUAL ENTRY' : 'ENTER CODE MANUALLY (FALLBACK)'}
        tone="neutral"
        onPress={() => setManualOpen((v) => !v)}
      />
      {manualOpen ? (
        <View>
          <Text style={styles.warn}>Manual entry still requires backend verification.</Text>
          <TextInput
            style={styles.input}
            value={manual}
            onChangeText={setManual}
            placeholder="Job / batch / material code"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
          />
          <BigButton
            label={busy ? 'VERIFYING…' : 'VERIFY CODE'}
            onPress={() => runResolve(manual)}
            disabled={busy || !manual.trim()}
          />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  block: { marginBottom: spacing.md, gap: spacing.sm },
  step: { color: colors.accent, fontWeight: '800', letterSpacing: 0.5 },
  hint: { color: colors.textMuted, fontSize: 13 },
  warn: { color: colors.warning, fontSize: 12, fontWeight: '700' },
  err: { color: colors.danger },
  camWrap: { height: 220, borderRadius: 8, overflow: 'hidden', gap: spacing.sm },
  cam: { flex: 1, minHeight: 180 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    color: colors.text,
    padding: 14,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  card: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  cardLine: { color: colors.text, fontSize: 14 },
})
