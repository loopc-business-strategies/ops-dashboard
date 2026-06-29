import { StyleSheet } from 'react-native'
import type { MobileTenantBranding } from '@/src/config/tenantBranding'

export function createAdminFormScreenStyles(branding: MobileTenantBranding) {
  const { colors } = branding
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 32, gap: 12 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
    error: { color: colors.danger, fontSize: 13, marginBottom: 8 },
    subtitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
    btn: {
      marginTop: 8,
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
    },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  })
}

export function createAdminListScreenStyles(branding: MobileTenantBranding) {
  const { colors } = branding
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    toolbar: { padding: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#fff' },
    search: {
      borderWidth: 1,
      borderColor: '#E5E7EB',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      backgroundColor: '#F8FAFC',
    },
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    filterChip: {
      borderWidth: 1,
      borderColor: '#E5E7EB',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: '#fff',
    },
    filterChipActive: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
    filterText: { fontSize: 12, color: colors.muted },
    filterTextActive: { color: colors.primary, fontWeight: '700' },
    createBtn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    error: { color: colors.danger, paddingHorizontal: 16, paddingTop: 8 },
    list: { padding: 16, gap: 12, paddingBottom: 32 },
    empty: { textAlign: 'center', color: colors.muted, marginTop: 24 },
    card: {
      backgroundColor: '#fff',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      padding: 14,
      marginBottom: 12,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    name: { fontSize: 16, fontWeight: '800', color: colors.text },
    username: { fontSize: 13, color: colors.muted, marginTop: 2 },
    meta: { fontSize: 12, color: colors.muted, marginTop: 8 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    actionBtn: {
      borderWidth: 1,
      borderColor: '#E5E7EB',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: '#F8FAFC',
    },
    dangerBtn: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
    actionText: { fontSize: 12, fontWeight: '700', color: colors.primary },
    dangerText: { color: colors.danger },
  })
}

export function createUserFormStyles(branding: MobileTenantBranding) {
  const { colors } = branding
  return StyleSheet.create({
    root: { gap: 12 },
    field: { gap: 6 },
    label: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
    input: {
      borderWidth: 1,
      borderColor: '#E5E7EB',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
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
      borderColor: colors.primary,
      backgroundColor: '#EFF6FF',
    },
    roleLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
    roleDesc: { fontSize: 12, color: colors.muted, marginTop: 2 },
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
      borderColor: colors.primary,
      backgroundColor: '#EFF6FF',
    },
    chipText: { fontSize: 12, color: colors.text, textTransform: 'capitalize' },
    chipTextActive: { color: colors.primary, fontWeight: '700' },
  })
}

export function createPermissionEditorStyles(branding: MobileTenantBranding) {
  const { colors } = branding
  return StyleSheet.create({
    root: { gap: 12 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.muted,
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
    rowLabel: { fontSize: 14, color: colors.text, flex: 1, paddingRight: 8 },
  })
}

export function createCreateGroupStyles(branding: MobileTenantBranding) {
  const { colors } = branding
  return StyleSheet.create({
    content: { padding: 16, paddingBottom: 32 },
    label: { fontSize: 12, fontWeight: '800', color: colors.muted, marginBottom: 6, marginTop: 12, textTransform: 'uppercase' },
    input: {
      borderWidth: 1,
      borderColor: '#E5E7EB',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      backgroundColor: '#fff',
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#F3F4F6',
    },
    avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontWeight: '800', fontSize: 13 },
    memberName: { fontWeight: '700', color: colors.text, fontSize: 15 },
    memberDept: { color: colors.muted, fontSize: 12, marginTop: 2 },
    check: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: '#D1D5DB',
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkActive: { backgroundColor: colors.success, borderColor: colors.success },
    checkMark: { color: '#fff', fontWeight: '800', fontSize: 12 },
    createBtn: {
      marginTop: 20,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    createBtnDisabled: { opacity: 0.5 },
    createText: { color: '#fff', fontWeight: '800', fontSize: 16 },
    error: { color: colors.danger, marginTop: 12, fontSize: 13 },
  })
}
