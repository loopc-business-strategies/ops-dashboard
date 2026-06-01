import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { ALL_MODULES, DEPTS, ROLES, type UserFormState, type UserRole } from '@/src/constants/admin'
import { mgBranding } from '@/src/config/branding'

type Props = {
  form: UserFormState
  setForm: React.Dispatch<React.SetStateAction<UserFormState>>
  isEdit?: boolean
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  )
}

export function UserForm({ form, setForm, isEdit = false }: Props) {
  const toggleModule = (mod: string) => {
    setForm((f) => ({
      ...f,
      allowedModules: f.allowedModules.includes(mod)
        ? f.allowedModules.filter((m) => m !== mod)
        : [...f.allowedModules, mod],
    }))
  }

  return (
    <View style={styles.root}>
      <Field label="Username *">
        <TextInput
          value={form.name}
          onChangeText={(name) => setForm((f) => ({ ...f, name }))}
          autoCapitalize="none"
          style={styles.input}
          placeholder="e.g. john.smith"
          placeholderTextColor="#9CA3AF"
        />
      </Field>

      <Field label="Full name">
        <TextInput
          value={form.fullName}
          onChangeText={(fullName) => setForm((f) => ({ ...f, fullName }))}
          style={styles.input}
          placeholder="John Smith"
          placeholderTextColor="#9CA3AF"
        />
      </Field>

      <Field label={isEdit ? 'Reset password' : 'Password *'}>
        <TextInput
          value={form.password}
          onChangeText={(password) => setForm((f) => ({ ...f, password }))}
          secureTextEntry
          style={styles.input}
          placeholder={isEdit ? 'Leave blank to keep current' : 'Min. 8 characters'}
          placeholderTextColor="#9CA3AF"
        />
      </Field>

      <Field label="Job title">
        <TextInput value={form.title} onChangeText={(title) => setForm((f) => ({ ...f, title }))} style={styles.input} placeholderTextColor="#9CA3AF" />
      </Field>

      <Field label="Phone">
        <TextInput value={form.phone} onChangeText={(phone) => setForm((f) => ({ ...f, phone }))} style={styles.input} placeholderTextColor="#9CA3AF" />
      </Field>

      <Field label="Location">
        <TextInput value={form.location} onChangeText={(location) => setForm((f) => ({ ...f, location }))} style={styles.input} placeholderTextColor="#9CA3AF" />
      </Field>

      <Field label="Timezone">
        <TextInput value={form.timezone} onChangeText={(timezone) => setForm((f) => ({ ...f, timezone }))} style={styles.input} placeholderTextColor="#9CA3AF" />
      </Field>

      <Field label="Employee code">
        <TextInput value={form.employeeCode} onChangeText={(employeeCode) => setForm((f) => ({ ...f, employeeCode }))} style={styles.input} placeholderTextColor="#9CA3AF" />
      </Field>

      <Field label="Role">
        <View style={styles.roleList}>
          {ROLES.map((r) => (
            <Pressable
              key={r.value}
              onPress={() => setForm((f) => ({ ...f, role: r.value as UserRole, department: '', allowedModules: [] }))}
              style={[styles.roleCard, form.role === r.value && styles.roleCardActive]}
            >
              <Text style={styles.roleLabel}>{r.label}</Text>
              <Text style={styles.roleDesc}>{r.desc}</Text>
            </Pressable>
          ))}
        </View>
      </Field>

      {(form.role === 'department_head' || form.role === 'department_user') && (
        <Field label="Department *">
          <View style={styles.chipRow}>
            {DEPTS.filter((d) => d.value).map((d) => (
              <Pressable
                key={d.value}
                onPress={() => setForm((f) => ({ ...f, department: d.value }))}
                style={[styles.chip, form.department === d.value && styles.chipActive]}
              >
                <Text style={[styles.chipText, form.department === d.value && styles.chipTextActive]}>{d.label}</Text>
              </Pressable>
            ))}
          </View>
        </Field>
      )}

      {form.role === 'external' && (
        <Field label="Allowed modules">
          <View style={styles.chipRow}>
            {ALL_MODULES.map((mod) => (
              <Pressable
                key={mod}
                onPress={() => toggleModule(mod)}
                style={[styles.chip, form.allowedModules.includes(mod) && styles.chipActive]}
              >
                <Text style={[styles.chipText, form.allowedModules.includes(mod) && styles.chipTextActive]}>{mod}</Text>
              </Pressable>
            ))}
          </View>
        </Field>
      )}

      {form.role === 'department_user' && (
        <Field label="Assigned task IDs">
          <TextInput
            value={form.assignedTasks}
            onChangeText={(assignedTasks) => setForm((f) => ({ ...f, assignedTasks }))}
            style={styles.input}
            placeholder="task-001, task-002"
            placeholderTextColor="#9CA3AF"
          />
        </Field>
      )}

      <Field label="Access notes">
        <TextInput
          value={form.notes}
          onChangeText={(notes) => setForm((f) => ({ ...f, notes }))}
          style={[styles.input, styles.textArea]}
          multiline
          numberOfLines={3}
          placeholderTextColor="#9CA3AF"
        />
      </Field>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: '700', color: mgBranding.colors.muted, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: mgBranding.colors.text,
    backgroundColor: '#fff',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  roleList: { gap: 8 },
  roleCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fff',
  },
  roleCardActive: {
    borderColor: mgBranding.colors.primary,
    backgroundColor: '#EFF6FF',
  },
  roleLabel: { fontSize: 14, fontWeight: '700', color: mgBranding.colors.text },
  roleDesc: { fontSize: 12, color: mgBranding.colors.muted, marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  chipActive: {
    borderColor: mgBranding.colors.primary,
    backgroundColor: '#EFF6FF',
  },
  chipText: { fontSize: 12, color: mgBranding.colors.text, textTransform: 'capitalize' },
  chipTextActive: { color: mgBranding.colors.primary, fontWeight: '700' },
})
