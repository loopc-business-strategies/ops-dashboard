import { Switch, Text, View } from 'react-native'
import {
  ALL_PERM_ROWS,
  ERP_PERMISSION_ROWS,
  type ModulePermissions,
} from '@/src/constants/admin'
import { useTenant } from '@/src/context/TenantContext'
import { useBrandingStyles } from '@/src/hooks/useBrandingStyles'
import { createPermissionEditorStyles } from '@/src/styles/adminFormScreenStyles'

type Props = {
  perms: ModulePermissions
  onChange: (next: ModulePermissions) => void
}

export function PermissionEditor({ perms, onChange }: Props) {
  const styles = useBrandingStyles(createPermissionEditorStyles)
  const { branding } = useTenant()
  const switchTrack = { false: '#CBD5E1', true: branding.colors.secondary } as const

  const PermRow = ({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={checked} onValueChange={onToggle} trackColor={switchTrack} thumbColor="#fff" />
    </View>
  )

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
