const {
  getConnectionStatus,
  fetchRecentInbox,
  buildGmailQueryFromMessage,
} = require('../../email/emailInboxService')

function formatInboxContent(inbox) {
  const lines = [`Inbox: **${inbox.email}**`, `Query: \`${inbox.query}\``, '']
  if (!inbox.messages.length) {
    lines.push('No matching messages found in the selected window.')
    return lines.join('\n')
  }
  inbox.messages.forEach((m, i) => {
    lines.push(`${i + 1}. **${m.subject}** — ${m.from}`)
    lines.push(`   ${m.date ? new Date(m.date).toLocaleString() : 'Unknown date'}`)
    if (m.snippet) lines.push(`   ${m.snippet}`)
    lines.push('')
  })
  return lines.join('\n')
}

async function runEmailInboxAgent(user, userMessage) {
  const status = await getConnectionStatus(user)
  if (!status.connected) {
    return {
      agent: 'emailInbox',
      title: 'Inbox',
      connectRequired: true,
      connectUrl: status.connectUrl,
      content: 'No Gmail account is connected. Connect Gmail to let Sales Manager AI read your inbox (read-only).',
      messages: [],
    }
  }

  try {
    const inbox = await fetchRecentInbox(user, {
      userMessage,
      query: buildGmailQueryFromMessage(userMessage),
      maxResults: 15,
    })
    return {
      agent: 'emailInbox',
      title: 'Inbox',
      connectRequired: false,
      content: formatInboxContent(inbox),
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
