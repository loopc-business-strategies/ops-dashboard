const {
  getConnectionStatus,
  fetchRecentInbox,
  buildGmailQueryFromMessage,
  getGmailTenantConnectStartUrl,
  getGmailConnectStartUrl,
} = require('../../email/emailInboxService')
const { resolveEmailFetchMaxResults } = require('../../email/gmailProvider')
const { buildEmailAnalysis, formatEmailAnalysisSummary } = require('./emailAnalysis')

function formatInboxContent(inbox) {
  const label = inbox.scope === 'tenant' ? 'Company inbox' : 'Inbox'
  const lines = [`${label}: **${inbox.email}**`, `Query: \`${inbox.query}\``, '']
  if (!inbox.messages.length) {
    lines.push('No matching messages found in the selected window.')
    return lines.join('\n')
  }
  inbox.messages.forEach((m, i) => {
    lines.push(`${i + 1}. **${m.subject || '(no subject)'}** — ${m.from}`)
    lines.push(`   ${m.date ? new Date(m.date).toLocaleString() : 'Unknown date'}`)
    if (m.snippet) lines.push(`   ${m.snippet}`)
    lines.push('')
  })
  return lines.join('\n')
}

async function runEmailInboxAgent(user, userMessage, tenantKey) {
  const status = await getConnectionStatus(user, tenantKey)
  if (!status.connected) {
    const isTenant = status.mode === 'tenant'
    const connectUrl = status.canManage
      ? (status.connectUrl || (isTenant ? getGmailTenantConnectStartUrl() : getGmailConnectStartUrl()))
      : null
    return {
      agent: 'emailInbox',
      title: 'Inbox',
      connectRequired: true,
      connectUrl,
      tenantConnect: isTenant,
      canManage: status.canManage,
      expectedEmail: status.expectedEmail || '',
      content: isTenant
        ? (status.canManage
          ? `Company inbox not connected. Connect Gmail as ${status.expectedEmail || 'your company mailbox'} (read-only).`
          : `Company inbox not connected yet. Ask a super admin to connect ${status.expectedEmail || 'the company Gmail'}.`)
        : 'No Gmail account is connected. Connect Gmail to let Sales Manager AI read your inbox (read-only).',
      messages: [],
    }
  }

  try {
    const query = buildGmailQueryFromMessage(userMessage)
    const maxResults = resolveEmailFetchMaxResults(userMessage)
    const inbox = await fetchRecentInbox(user, {
      userMessage,
      tenantKey,
      query,
      maxResults,
    })
    const analysis = buildEmailAnalysis(inbox.messages, { query })
    const summary = formatEmailAnalysisSummary(analysis, inbox.email)
    return {
      agent: 'emailInbox',
      title: 'Inbox',
      connectRequired: false,
      tenantConnect: inbox.scope === 'tenant',
      content: formatInboxContent(inbox),
      summary,
      analysis,
      messages: inbox.messages,
      query: inbox.query,
      email: inbox.email,
    }
  } catch (err) {
    if (err.statusCode === 429) {
      return {
        agent: 'emailInbox',
        title: 'Inbox',
        connectRequired: false,
        content: err.message,
        messages: [],
        error: 'rate_limit',
      }
    }
    throw err
  }
}

module.exports = {
  runEmailInboxAgent,
  formatInboxContent,
}
