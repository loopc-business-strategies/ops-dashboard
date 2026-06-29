import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { useBrandingStyles } from '@/src/hooks/useBrandingStyles'
import { useTenantBranding } from '@/src/context/TenantContext'
import type { MobileTenantBranding } from '@/src/config/tenantBranding'
import { formatDateToInput, normalizeDateInput, parseDateInput } from '@/src/utils/dateInput'

type DateFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function createDateFieldStyles(branding: MobileTenantBranding) {
  const { colors } = branding
  return StyleSheet.create({
    wrap: { flex: 1 },
    label: { fontSize: 11, fontWeight: '700', color: colors.muted, marginBottom: 4 },
    row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: '#D1D5DB',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
      backgroundColor: '#FAFAFA',
    },
    calBtn: {
      borderWidth: 1,
      borderColor: '#D1D5DB',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: '#FFFFFF',
    },
    calBtnText: { fontSize: 16 },
  })
}

export default function DateField({ label, value, onChange, placeholder = 'YYYY-MM-DD' }: DateFieldProps) {
  const styles = useBrandingStyles(createDateFieldStyles)
  const { branding } = useTenantBranding()
  const [showPicker, setShowPicker] = useState(false)

  const pickerDate = parseDateInput(value) || new Date()

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false)
    if (event.type === 'dismissed') {
      setShowPicker(false)
      return
    }
    if (selected) {
      onChange(formatDateToInput(selected))
      if (Platform.OS === 'ios') setShowPicker(false)
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={branding.colors.muted}
          value={value}
          onChangeText={onChange}
          onBlur={() => onChange(normalizeDateInput(value))}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable style={styles.calBtn} onPress={() => setShowPicker(true)} accessibilityLabel={`${label} calendar`}>
          <Text style={styles.calBtnText}>📅</Text>
        </Pressable>
      </View>
      {showPicker ? (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onPickerChange}
        />
      ) : null}
    </View>
  )
}
