import React, { useEffect, useState } from 'react'
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { BigButton, Screen, Subtitle, Title } from '@/src/components/ui'
import { ModernGoldLogo } from '@/src/components/ModernGoldLogo'
import { getSelectedDepartment, setSelectedDepartment } from '@/src/auth/sessionPrefs'
import { brand, colors, spacing } from '@/src/theme'

/** Matches production-control DEFAULT_FLOW_STAGES — used before auth. */
const DEPARTMENTS = [
  { key: 'melting', label: 'Melting' },
  { key: 'casting', label: 'Casting' },
  { key: 'rolling', label: 'Rolling' },
  { key: 'bangle_division', label: 'Bangle' },
  { key: 'stamping', label: 'Stamping' },
  { key: 'polishing', label: 'Polishing' },
  { key: 'quality_control', label: 'Quality Control' },
  { key: 'packing', label: 'Packaging' },
]

export default function DepartmentScreen() {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getSelectedDepartment().then((saved) => {
      if (saved && DEPARTMENTS.some((d) => d.key === saved)) setSelected(saved)
    })
  }, [])

  const selectedLabel = DEPARTMENTS.find((d) => d.key === selected)?.label

  const continueNext = async () => {
    if (!selected || busy) return
    setBusy(true)
    try {
      await setSelectedDepartment(selected)
      const saved = await getSelectedDepartment()
      if (saved !== selected) {
        Alert.alert('Could not save department', 'Please try CONTINUE again.')
        return
      }
      router.replace('/')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <View style={styles.content}>
        <ModernGoldLogo height={64} />
        <Title>{brand.appName}</Title>
        <Subtitle>Select Department</Subtitle>

        <Text style={styles.label}>Department</Text>
        <Pressable
          onPress={() => setOpen(true)}
          style={styles.field}
          accessibilityRole="button"
          accessibilityLabel="Select department"
        >
          <Text style={[styles.fieldText, !selectedLabel && styles.placeholder]}>
            {selectedLabel || 'Select department…'}
          </Text>
          <Text style={styles.chevron}>▼</Text>
        </Pressable>

        <BigButton
          label={busy ? 'PLEASE WAIT…' : 'CONTINUE'}
          onPress={continueNext}
          disabled={!selected || busy}
        />
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Choose department</Text>
            {DEPARTMENTS.map((d) => {
              const active = d.key === selected
              return (
                <Pressable
                  key={d.key}
                  onPress={() => {
                    setSelected(d.key)
                    setOpen(false)
                  }}
                  style={[styles.option, active && styles.optionActive]}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{d.label}</Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      </Modal>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', gap: spacing.sm, paddingBottom: spacing.xl },
  label: {
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: 6,
    fontWeight: '600',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  fieldText: { color: colors.text, fontWeight: '700', fontSize: 16, flex: 1 },
  placeholder: { color: colors.textMuted, fontWeight: '600' },
  chevron: { color: colors.accent, fontSize: 12, marginLeft: spacing.sm },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    maxHeight: '80%',
    zIndex: 1,
  },
  sheetTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    marginBottom: 4,
  },
  optionActive: { backgroundColor: colors.accent },
  optionText: { color: colors.text, fontWeight: '700', fontSize: 16 },
  optionTextActive: { color: colors.onAccent },
})
