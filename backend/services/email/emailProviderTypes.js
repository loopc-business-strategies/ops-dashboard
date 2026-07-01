function normalizeEmailMessage(raw = {}) {
  return {
    id: String(raw.id || '').trim(),
    threadId: String(raw.threadId || '').trim(),
    from: String(raw.from || '').trim(),
    subject: String(raw.subject || '').trim() || '(no subject)',
    date: raw.date ? new Date(raw.date).toISOString() : null,
    snippet: String(raw.snippet || '').trim().slice(0, 500),
  }
}

module.exports = {
  normalizeEmailMessage,
}
