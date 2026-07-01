const SalesAiSession = require('../../models/SalesAiSession')

function titleFromMessage(message) {
  const text = String(message || '').trim()
  if (!text) return 'Sales briefing'
  return text.length > 60 ? `${text.slice(0, 57)}…` : text
}

async function listSessions(userId, { limit = 20 } = {}) {
  return SalesAiSession.find({ userId, isDeleted: false })
    .sort({ updatedAt: -1 })
    .limit(Math.min(limit, 50))
    .select('title pinned updatedAt createdAt messages')
    .lean()
    .then((rows) => rows.map((r) => ({
      id: String(r._id),
      title: r.title,
      pinned: r.pinned,
      messageCount: (r.messages || []).length,
      updatedAt: r.updatedAt,
      createdAt: r.createdAt,
    })))
}

async function getSession(userId, sessionId) {
  const doc = await SalesAiSession.findOne({
    _id: sessionId,
    userId,
    isDeleted: false,
  }).lean()
  if (!doc) return null
  return {
    id: String(doc._id),
    title: doc.title,
    pinned: doc.pinned,
    messages: doc.messages || [],
    updatedAt: doc.updatedAt,
    createdAt: doc.createdAt,
  }
}

async function createSession(user, { title, messages = [] } = {}) {
  const doc = await SalesAiSession.create({
    userId: user._id,
    userName: user.name,
    title: title || titleFromMessage(messages[0]?.content),
    messages: messages.map((m) => ({
      role: m.role,
      content: String(m.content || ''),
      meta: m.meta,
    })),
  })
  return getSession(user._id, doc._id)
}

async function appendMessages(userId, sessionId, messages) {
  const payload = (messages || []).map((m) => ({
    role: m.role,
    content: String(m.content || ''),
    meta: m.meta,
  }))
  const doc = await SalesAiSession.findOneAndUpdate(
    { _id: sessionId, userId, isDeleted: false },
    { $push: { messages: { $each: payload } } },
    { new: true },
  ).lean()
  return doc ? getSession(userId, doc._id) : null
}

async function saveChatTurn(user, { sessionId, userMessage, assistantReply, meta }) {
  const messages = [
    { role: 'user', content: userMessage },
    { role: 'assistant', content: assistantReply, meta },
  ]
  if (sessionId) {
    return appendMessages(user._id, sessionId, messages)
  }
  return createSession(user, {
    title: titleFromMessage(userMessage),
    messages,
  })
}

async function deleteSession(userId, sessionId) {
  const doc = await SalesAiSession.findOneAndUpdate(
    { _id: sessionId, userId },
    { isDeleted: true },
    { new: true },
  )
  return Boolean(doc)
}

function exportSessionMarkdown(session) {
  const lines = [`# ${session.title || 'Sales briefing'}`, '']
  for (const m of session.messages || []) {
    const heading = m.role === 'user' ? '## Question' : '## Briefing'
    lines.push(heading, '', m.content, '')
  }
  return lines.join('\n').trim()
}

module.exports = {
  listSessions,
  getSession,
  createSession,
  appendMessages,
  saveChatTurn,
  deleteSession,
  exportSessionMarkdown,
}
