import { StyleSheet, Switch, Text, View } from 'react-native'
import {
  ALL_PERM_ROWS,
  ERP_PERMISSION_ROWS,
  type ModulePermissions,
} from '@/src/constants/admin'
import { mgBranding } from '@/src/config/branding'

type Props = {
  perms: ModulePermissions
  onChange: (next: ModulePermissions) => void
}

function PermRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={checked}
        onValueChange={onToggle}
        trackColor={{ false: '#CBD5E1', true: mgBranding.colors.secondary }}
        thumbColor="#fff"
      />
    </View>
  )
}

export function PermissionEditor({ perms, onChange }: Props) {
  const erpSubs = perms.erp?.subs || {}
  const erpAllEnabled = !!perms.erp?.on && Object.keys(erpSubs).length === 0

  const toggleModule = (modId: string) => {
    onChange((() => {
      if (perms[modId]?.on) {
        const next = { ...perms }
        delete next[modId]
        return next
      }
      return { ...perms, [modId]: { on: true } }
    })())
  }

  const toggleErpSub = (subId: string) => {
    onChange((() => {
      const currentSubs =
        perms.erp?.on && !perms.erp?.subs
          ? ERP_PERMISSION_ROWS.reduce<Record<string, { on: boolean }>>((acc, row) => {
              acc[row.id] = { on: true }
              return acc
            }, {})
          : { ...(perms.erp?.subs || {}) }

      const nextSubs = { ...currentSubs }
      if (nextSubs[subId]?.on) delete nextSubs[subId]
      else nextSubs[subId] = { on: true }

      const next = { ...perms }
      if (!Object.keys(nextSubs).length) delete next.erp
      else next.erp = { ...(perms.erp || {}), on: true, subs: nextSubs }
      return next
    })())
  }

  const isErpSubOn = (subId: string) => erpAllEnabled || !!erpSubs[subId]?.on

  const generalRows = ALL_PERM_ROWS.filter((r) => r.group === 'GENERAL')
  const deptRows = ALL_PERM_ROWS.filter((r) => r.group === 'DEPARTMENTS')

  return (
    <View style={styles.root}>
      <Text style={styles.sectionTitle}>General</Text>
      <View style={styles.card}>
        {generalRows.map((row) => (
          <PermRow
            key={row.id}
            label={row.label}
            checked={!!perms[row.id]?.on}
            onToggle={() => toggleModule(row.id)}
          />
        ))}
      </View>

      <Text style={styles.sectionTitle}>Departments</Text>
      <View style={styles.card}>
        {deptRows.map((row) => (
          <PermRow
            key={row.id}
            label={row.label}
            checked={!!perms[row.id]?.on}
            onToggle={() => toggleModule(row.id)}
          />
        ))}
      </View>

      <Text style={styles.sectionTitle}>ERP modules</Text>
      <View style={styles.card}>
        <PermRow label="ERP (all modules)" checked={!!perms.erp?.on && erpAllEnabled} onToggle={() => toggleModule('erp')} />
        {ERP_PERMISSION_ROWS.map((row) => (
          <PermRow
            key={row.id}
            label={row.label}
            checked={isErpSubOn(row.id)}
            onToggle={() => toggleErpSub(row.id)}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: mgBranding.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rowLabel: { fontSize: 14, color: mgBranding.colors.text, flex: 1, paddingRight: 8 },
})
