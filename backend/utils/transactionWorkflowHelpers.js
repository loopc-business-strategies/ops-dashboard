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

  // Dual-write to tenant AuditLog for ERP Activity Log (non-blocking).
  if (options.req && !options.skipGlobalAudit) {
    void (async () => {
      try {
        const { auditLog } = require('../middleware/audit')
        const { buildVoucherActivityDetail } = require('./activityLogDetail')
        const docNo = String(transaction?.voucherMeta?.vocNo || transaction?.reference || transaction?._id || '')
        const detail = await buildVoucherActivityDetail(transaction, action, {
          comment: options.comment,
          fromStatus: options.fromStatus,
          toStatus: options.toStatus,
        })
        await auditLog(options.req, {
          resource: 'Transaction',
          resourceId: transaction._id,
          action,
          detail,
          module: 'voucher',
          documentNo: docNo,
          changes: {
            fromStatus: options.fromStatus || '',
            toStatus: options.toStatus || '',
            type: transaction?.type || '',
            amount: transaction?.amount,
            currency: transaction?.currency || '',
            partyName: transaction?.voucherMeta?.partyName || '',
          },
        })
      } catch (err) {
        console.error('[audit] voucher dual-write failed:', err?.message || err)
      }
    })()
  }
}

function getTransactionWorkflowErrorStatus(message) {
  if (/Only Admin\/Finance|Forbidden/i.test(message || '')) return 403
  if (/not found/i.test(message || '')) return 404
  if (/Only draft|Only submitted|must be approved|required|greater than zero|Credit limit exceeded|Invalid|Unable to resolve|returned|rejected|Insufficient vault stock/i.test(message || '')) return 400
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
