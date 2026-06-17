import axios, { apiUrl } from './client'

const cfg = () => ({ withCredentials: true })

export async function getNotificationPreferences() {
  const res = await axios.get(apiUrl('/api/auth/me/notification-preferences'), cfg())
  return res.data
}

export async function updateNotificationPreferences(notificationPreferences) {
  const res = await axios.put(
    apiUrl('/api/auth/me/notification-preferences'),
    { notificationPreferences },
    cfg(),
  )
  return res.data
}

export async function previewReportDigest() {
  const res = await axios.post(apiUrl('/api/notifications/report-digest/preview'), {}, cfg())
  return res.data
}

export async function sendReportDigest() {
  const res = await axios.post(apiUrl('/api/notifications/report-digest/send'), {}, cfg())
  return res.data
}
