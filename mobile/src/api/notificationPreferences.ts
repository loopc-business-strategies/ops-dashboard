import { apiRequest } from '@/src/api/client'

export type NotificationTopics = Record<string, boolean>

export type ReportDigestPrefs = {
  enabled: boolean
  timeLocal: string
  includeExpensesToday: boolean
  includeSalesToday: boolean
  includeBankCashBalance: boolean
  includeGoldPrice: boolean
}

export type NotificationPreferences = {
  topics: NotificationTopics
  reportDigest: ReportDigestPrefs
}

type PrefsResponse = {
  success: boolean
  notificationPreferences: NotificationPreferences
}

type DigestTextResponse = {
  success: boolean
  text: string
}

export async function fetchNotificationPreferences(token: string) {
  return apiRequest<PrefsResponse>('/api/auth/me/notification-preferences', { token })
}

export async function saveNotificationPreferences(token: string, notificationPreferences: NotificationPreferences) {
  return apiRequest<PrefsResponse>('/api/auth/me/notification-preferences', {
    method: 'PUT',
    token,
    body: { notificationPreferences },
  })
}

export async function previewReportDigest(token: string) {
  return apiRequest<DigestTextResponse>('/api/notifications/report-digest/preview', {
    method: 'POST',
    token,
    body: {},
  })
}

export async function sendReportDigest(token: string) {
  return apiRequest<DigestTextResponse>('/api/notifications/report-digest/send', {
    method: 'POST',
    token,
    body: {},
  })
}

export const TOPIC_GROUPS: { title: string; topics: { key: string; label: string }[] }[] = [
  {
    title: 'Vouchers',
    topics: [
      { key: 'voucher_submitted', label: 'Submitted' },
      { key: 'voucher_approved', label: 'Approved' },
      { key: 'voucher_posted', label: 'Posted' },
      { key: 'voucher_returned', label: 'Returned' },
      { key: 'voucher_rejected', label: 'Rejected' },
    ],
  },
  {
    title: 'Journal',
    topics: [{ key: 'jv_posted', label: 'JV / Bank JV posted' }],
  },
  {
    title: 'Due & overdue',
    topics: [
      { key: 'task_due', label: 'Tasks due today' },
      { key: 'task_overdue', label: 'Tasks overdue' },
      { key: 'vendor_due', label: 'Vendor due' },
      { key: 'vendor_overdue', label: 'Vendor overdue' },
    ],
  },
  {
    title: 'Chat',
    topics: [
      { key: 'chat_message', label: 'Chat messages' },
      { key: 'chat_mention', label: 'Mentions' },
    ],
  },
  {
    title: 'Reports',
    topics: [
      { key: 'report_digest', label: 'Daily report' },
      { key: 'gold_price_alert', label: 'Gold price alerts' },
    ],
  },
]
