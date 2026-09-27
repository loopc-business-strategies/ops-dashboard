import React, { useCallback } from 'react'
import { StyleSheet, Text } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Screen, Subtitle } from '@/src/components/ui'
import { AsyncSection, SectionLoading } from '@/src/components/async'
import { ScaleOcrDiagnostics } from '@/src/components/weightCapture/ScaleOcrDiagnostics'
import { fetchScale } from '@/src/api/floor'
import { useAsyncResource } from '@/src/hooks/useAsyncResource'
import { useAuth } from '@/src/context/AuthContext'
import { supportsCameraOcr, toWeighProfile } from '@/src/scaleCamera/cameraSettings'
import { colors } from '@/src/theme'

/** On-site GJ-2000 OCR tuning for one camera scale (managers only). */
export default function ScaleOcrDiagnosticsScreen() {
  const { permissions } = useAuth()
  const params = useLocalSearchParams<{ scaleId?: string }>()
  const scaleId = String(params.scaleId || '').trim()
  const canManage = Boolean(permissions.manageScales)

  const scale = useAsyncResource(
    useCallback(
      async (signal) => {
        const res = await fetchScale(scaleId, { signal })
        return toWeighProfile(res.scale as Parameters<typeof toWeighProfile>[0])
      },
      [scaleId],
    ),
    { deps: [scaleId], enabled: canManage && Boolean(scaleId) },
  )

  if (!canManage) {
    return (
      <Screen>
        <Subtitle>Not authorized — scale managers only</Subtitle>
      </Screen>
    )
  }
  if (!scaleId) {
    return (
      <Screen>
        <Subtitle>Open this screen from a scale in the Scales list</Subtitle>
      </Screen>
    )
  }

  const profile = scale.data
  return (
    <Screen>
      <Subtitle>SCALE OCR DIAGNOSTICS — {scaleId}</Subtitle>
      {scale.status === 'loading' && !profile ? <SectionLoading label="Loading scale…" /> : null}
      <AsyncSection
        status={scale.status}
        error={scale.error || 'Unable to load scale'}
        emptyMessage="Scale not found"
        onRetry={scale.reload}
      >
        {profile && supportsCameraOcr(profile) ? <ScaleOcrDiagnostics profile={profile} /> : null}
        {profile && !supportsCameraOcr(profile) ? (
          <Text style={styles.warn}>Enable SCALE CAMERA (OCR) in this scale's capture settings first.</Text>
        ) : null}
      </AsyncSection>
    </Screen>
  )
}

const styles = StyleSheet.create({
  warn: { color: colors.warning, fontWeight: '700' },
})
