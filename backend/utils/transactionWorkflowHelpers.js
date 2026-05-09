function normalizeTransactionNote(value) {
  return String(value || '').trim()
}

function appendTransactionComment(transaction, user, message, kind = 'comment') {
  const note = normalizeTransactionNote(message)
  if (!note) return
  transaction.comments.push({
    message: note,
    kind,
    createdBy: user._id,
    createdAt: new Date(),
  })
}

function appendTransactionAudit(transaction, user, action, options = {}) {
  transaction.auditTrail.push({
    action,
    fromStatus: options.fromStatus || '',
    toStatus: options.toStatus || '',
    comment: normalizeTransactionNote(options.comment),
    actorId: user._id,
    createdAt: new Date(),
  })
}

function getTransactionWorkflowErrorStatus(message) {
  if (/Only Admin\/Finance|Forbidden/i.test(message || '')) return 403
  if (/not found/i.test(message || '')) return 404
  if (/Only draft|Only submitted|must be approved|required|greater than zero|Credit limit exceeded|Invalid|Unable to resolve|returned|rejected/i.test(message || '')) return 400
  return 500
}

function respondWorkflowError(res, err) {
  if (err?.status) {
    return res.status(err.status).json({
      success: false,
      message: err.message || 'Server error',
      ...(err.code ? { code: err.code } : {}),
      ...(err.details ? { details: err.details } : {}),
    })
  }

  const message = err?.message || 'Server error'
  const status = getTransactionWorkflowErrorStatus(message)
  if (status === 500) {
    console.error('Transaction workflow error:', err)
    return res.status(500).json({ success: false, message: 'Server error' })
  }

  return res.status(status).json({ success: false, message })
}

module.exports = {
  normalizeTransactionNote,
  appendTransactionComment,
  appendTransactionAudit,
  getTransactionWorkflowErrorStatus,
  respondWorkflowError,
}