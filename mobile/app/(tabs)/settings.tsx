import { useCallback, useEffect, useState } from 'react'
import {
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { mgBranding } from '@/src/config/branding'
import { TENANT } from '@/src/config/tenant'
import { useAuth } from '@/src/context/AuthContext'
import {
  fetchNotificationPreferences,
  previewReportDigest,
  saveNotificationPreferences,
  sendReportDigest,
  TOPIC_GROUPS,
  type NotificationPreferences,
} from '@/src/api/notificationPreferences'
import {
  getNotificationPermissionStatus,
  registerExpoPushAndPost,
} from '@/src/services/expoPushRegistration'
import { isSuperAdmin } from '@/src/utils/roles'

export default function SettingsScreen() {
  const { user, token, logout } = useAuth()
  const router = useRouter()
  const showAdmin = isSuperAdmin(user)
  const [permissionStatus, setPermissionStatus] = useState<string>('—')
  const [pushRegistering, setPushRegistering] = useState(false)
  const [pushMessage, setPushMessage] = useState('')
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [prefsStatus, setPrefsStatus] = useState('')
  const [digestPreview, setDigestPreview] = useState('')

  const refreshPermission = useCallback(async () => {
    const status = await getNotificationPermissionStatus()
    setPermissionStatus(status)
  }, [])

  const loadPrefs = useCallback(async () => {
    if (!token) return
    setPrefsLoading(true)
    try {
      const data = await fetchNotificationPreferences(token)
      setPrefs(data.notificationPreferences)
    } catch (err) {
      setPrefsStatus(err instanceof Error ? err.message : 'Failed to load notification settings')
    } finally {
      setPrefsLoading(false)
    }
  }, [token])

  useEffect(() => {
    void refreshPermission()
  }, [refreshPermission])

  useEffect(() => {
    void loadPrefs()
  }, [loadPrefs])

  const persistPrefs = useCallback(async (next: NotificationPreferences) => {
    if (!token) return
    setPrefs(next)
    setPrefsStatus('')
    try {
      const data = await saveNotificationPreferences(token, next)
      setPrefs(data.notificationPreferences)
      setPrefsStatus('Saved')
    } catch (err) {
      setPrefsStatus(err instanceof Error ? err.message : 'Save failed')
    }
  }, [token])

  const toggleTopic = (key: string) => {
    if (!prefs) return
    void persistPrefs({
      ...prefs,
      topics: { ...prefs.topics, [key]: !prefs.topics[key] },
    })
  }

  const toggleDigest = (key: keyof NotificationPreferences['reportDigest']) => {
    if (!prefs) return
    void persistPrefs({
      ...prefs,
      reportDigest: { ...prefs.reportDigest, [key]: !prefs.reportDigest[key] },
    })
  }

  const setDigestTime = (timeLocal: string) => {
    if (!prefs) return
    void persistPrefs({
      ...prefs,
      reportDigest: { ...prefs.reportDigest, timeLocal },
    })
  }

  const enablePush = useCallback(async () => {
    if (!token) return
    setPushRegistering(true)
    setPushMessage('')
    try {
      const ok = await registerExpoPushAndPost(token)
      await refreshPermission()
      setPushMessage(ok ? 'Push registered with server.' : 'Allow notifications in system settings, then tap again.')
    } catch (err) {
      setPushMessage(err instanceof Error ? err.message : 'Push registration failed.')
    } finally {
      setPushRegistering(false)
    }
  }, [token, refreshPermission])

  const openNotificationSettings = useCallback(() => {
    void Linking.openSettings()
  }, [])

  const runPreview = async () => {
    if (!token) return
    setPrefsStatus('')
    try {
      const data = await previewReportDigest(token)
      setDigestPreview(data.text || '')
    } catch (err) {
      setPrefsStatus(err instanceof Error ? err.message : 'Preview failed')
    }
  }

  const runSend = async () => {
    if (!token) return
    setPrefsStatus('')
    try {
      const data = await sendReportDigest(token)
      setDigestPreview(data.text || '')
      setPrefsStatus('Report sent')
    } catch (err) {
      setPrefsStatus(err instanceof Error ? err.message : 'Send failed')
    }
  }

  const shareDigest = async () => {
    const text = digestPreview.trim()
    if (!text) {
      await runPreview()
      return
    }
    try {
      await Share.share({ message: text })
    } catch {
      // user cancelled
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.name}>{user?.fullName || user?.name || 'User'}</Text>
        <Text style={styles.meta}>Role: {user?.role || '—'}</Text>
        <Text style={styles.meta}>Tenant: {TENANT.toUpperCase()}</Text>
      </View>

      {showAdmin ? (
        <Pressable style={styles.adminCard} onPress={() => router.push('/admin-settings')}>
          <View style={{ flex: 1 }}>
            <Text style={styles.adminTitle}>Admin settings</Text>
            <Text style={styles.adminDesc}>Manage users & permissions</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Push registration</Text>
        <Text style={styles.meta}>Permission: {permissionStatus}</Text>
        <Pressable
          style={[styles.actionBtn, pushRegistering && styles.actionBtnDisabled]}
          onPress={() => enablePush()}
          disabled={pushRegistering}
        >
          <Text style={styles.actionBtnText}>{pushRegistering ? 'Registering…' : 'Register for push'}</Text>
        </Pressable>
        {permissionStatus !== Notifications.PermissionStatus.GRANTED ? (
          <Pressable style={styles.linkBtn} onPress={openNotificationSettings}>
            <Text style={styles.linkBtnText}>Open system notification settings</Text>
          </Pressable>
        ) : null}
        {pushMessage ? <Text style={styles.pushMsg}>{pushMessage}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Notification topics</Text>
        {prefsLoading || !prefs ? (
          <Text style={styles.meta}>Loading…</Text>
        ) : (
          TOPIC_GROUPS.map((group) => (
            <View key={group.title} style={styles.topicGroup}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              {group.topics.map((topic) => (
                <View key={topic.key} style={styles.topicRow}>
                  <Text style={styles.topicLabel}>{topic.label}</Text>
                  <Switch
                    value={prefs.topics[topic.key] !== false}
                    onValueChange={() => toggleTopic(topic.key)}
                    trackColor={{ false: '#CBD5E1', true: mgBranding.colors.primary }}
                  />
                </View>
              ))}
            </View>
          ))
        )}
      </View>

      {prefs ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Report digest</Text>
          <View style={styles.topicRow}>
            <Text style={styles.topicLabel}>Scheduled digest</Text>
            <Switch
              value={prefs.reportDigest.enabled !== false}
              onValueChange={() => toggleDigest('enabled')}
              trackColor={{ false: '#CBD5E1', true: mgBranding.colors.primary }}
            />
          </View>
          <Text style={styles.meta}>Time (local)</Text>
          <TextInput
            style={styles.timeInput}
            value={String(prefs.reportDigest.timeLocal || '08:00').slice(0, 5)}
            onChangeText={setDigestTime}
            placeholder="08:00"
          />
          {(['includeExpensesToday', 'includeSalesToday', 'includeBankCashBalance', 'includeGoldPrice'] as const).map((key) => (
            <View key={key} style={styles.topicRow}>
              <Text style={styles.topicLabel}>
                {key === 'includeExpensesToday' ? 'Expenses today'
                  : key === 'includeSalesToday' ? 'Sales today'
                    : key === 'includeBankCashBalance' ? 'Bank & cash'
                      : 'Gold price'}
              </Text>
              <Switch
                value={prefs.reportDigest[key] !== false}
                onValueChange={() => toggleDigest(key)}
                trackColor={{ false: '#CBD5E1', true: mgBranding.colors.primary }}
              />
            </View>
          ))}
          <View style={styles.rowBtns}>
            <Pressable style={styles.secondaryBtn} onPress={() => void runPreview()}>
              <Text style={styles.secondaryBtnText}>Preview</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={() => void runSend()}>
              <Text style={styles.actionBtnText}>Send now</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => void shareDigest()}>
              <Text style={styles.secondaryBtnText}>Share</Text>
            </Pressable>
          </View>
          {digestPreview ? <Text style={styles.previewText}>{digestPreview}</Text> : null}
        </View>
      ) : null}

      {prefsStatus ? <Text style={styles.prefsStatus}>{prefsStatus}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.label}>App</Text>
        <Text style={styles.meta}>{mgBranding.appName} v{Constants.expoConfig?.version || '1.0.0'}</Text>
        <Text style={styles.meta}>View-only companion app</Text>
      </View>

      <Pressable style={styles.logoutBtn} onPress={() => logout()}>
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mgBranding.colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  adminCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: mgBranding.colors.primary,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  adminTitle: { fontSize: 16, fontWeight: '800', color: mgBranding.colors.text },
  adminDesc: { fontSize: 13, color: mgBranding.colors.muted, marginTop: 4 },
  chevron: { fontSize: 28, color: mgBranding.colors.primary, fontWeight: '300' },
  label: { fontSize: 12, fontWeight: '700', color: mgBranding.colors.muted, textTransform: 'uppercase' },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: mgBranding.colors.text, marginBottom: 8 },
  name: { marginTop: 6, fontSize: 20, fontWeight: '800', color: mgBranding.colors.text },
  meta: { marginTop: 4, fontSize: 14, color: mgBranding.colors.muted },
  topicGroup: { marginTop: 8 },
  groupTitle: { fontSize: 13, fontWeight: '700', color: mgBranding.colors.text, marginBottom: 4 },
  topicRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  topicLabel: { flex: 1, fontSize: 14, color: mgBranding.colors.text, paddingRight: 12 },
  timeInput: {
    marginTop: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: mgBranding.colors.text,
    maxWidth: 120,
  },
  rowBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionBtn: {
    backgroundColor: mgBranding.colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: mgBranding.colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  secondaryBtnText: { color: mgBranding.colors.primary, fontWeight: '700', fontSize: 14 },
  linkBtn: { marginTop: 10, paddingVertical: 8 },
  linkBtnText: { color: mgBranding.colors.primary, fontWeight: '600', fontSize: 14 },
  pushMsg: { marginTop: 8, fontSize: 13, color: mgBranding.colors.text },
  previewText: { marginTop: 12, fontSize: 12, color: mgBranding.colors.text, lineHeight: 18 },
  prefsStatus: { fontSize: 13, color: mgBranding.colors.text, textAlign: 'center' },
  logoutBtn: {
    marginTop: 8,
    backgroundColor: mgBranding.colors.danger,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { color: '#fff', fontWeight: '800', fontSize: 16 },
})
