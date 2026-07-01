function isOutlookConfigured() {
  return Boolean(
    String(process.env.MICROSOFT_CLIENT_ID || '').trim()
    && String(process.env.MICROSOFT_CLIENT_SECRET || '').trim(),
  )
}

async function listOutlookMessages() {
  throw new Error('Outlook email integration is not available yet. Connect Gmail or check back later.')
}

module.exports = {
  isOutlookConfigured,
  listOutlookMessages,
}
