function populateTransactionListQuery(query) {
  return query
    .populate('customerId', 'name')
    .populate('vendorId', 'name')
    .populate('debitAccountId', 'accountCode accountName')
    .populate('creditAccountId', 'accountCode accountName')
    .populate('createdBy', 'name')
}

function populateTransactionQuery(query) {
  return query
    .populate('customerId', 'name')
    .populate('vendorId', 'name')
    .populate('inventoryItemId', 'name sku')
    .populate('debitAccountId', 'accountCode accountName')
    .populate('creditAccountId', 'accountCode accountName')
    .populate('mappingId', 'mappingType description')
    .populate('createdBy', 'name')
    .populate('approvedBy', 'name')
    .populate('postedBy', 'name')
    .populate('attachments.uploadedBy', 'name')
    .populate('comments.createdBy', 'name')
    .populate('comments.mentionedUsers', 'name email role')
    .populate('comments.readBy.userId', 'name')
    .populate('auditTrail.actorId', 'name')
}

function createTransactionWorkflowAction({
  normalizeTransactionNote,
  appendTransactionComment,
  appendTransactionAudit,
  canManageTransactionWorkflow,
  getTransactionPostingService,
}) {
  return async function applyTransactionWorkflowAction(tx, user, action, options = {}, session = null) {
    const note = normalizeTransactionNote(options.comment)
    const fromStatus = tx.status
    const saveOpts = session ? { session } : {}

    if (action === 'submit') {
      if (!['draft', 'returned', 'rejected'].includes(tx.status)) throw new Error('Only draft, returned, or rejected transactions can be submitted')
      tx.status = 'submitted'
      tx.updatedBy = user._id
      appendTransactionComment(tx, user, note, 'submit_note')
      appendTransactionAudit(tx, user, 'submit', { fromStatus, toStatus: 'submitted', comment: note })
      await tx.save(saveOpts)
      return { transaction: tx }
    }

    if (action === 'approve') {
      if (!canManageTransactionWorkflow(user)) throw new Error('Only Admin/Finance can approve transactions')
      if (tx.status !== 'submitted') throw new Error('Only submitted transactions can be approved')
      tx.status = 'approved'
      tx.approvedBy = user._id
      tx.updatedBy = user._id
      appendTransactionComment(tx, user, note, 'approval_note')
      appendTransactionAudit(tx, user, 'approve', { fromStatus, toStatus: 'approved', comment: note })
      await tx.save(saveOpts)
      return { transaction: tx }
    }

    if (action === 'return') {
      if (!canManageTransactionWorkflow(user)) throw new Error('Only Admin/Finance can return transactions for edit')
      if (!['submitted', 'approved'].includes(tx.status)) throw new Error('Only submitted or approved transactions can be returned for edit')
      if (!note) throw new Error('Return reason is required')
      tx.status = 'returned'
      tx.updatedBy = user._id
      appendTransactionComment(tx, user, note, 'return_note')
      appendTransactionAudit(tx, user, 'return', { fromStatus, toStatus: 'returned', comment: note })
      await tx.save(saveOpts)
      return { transaction: tx }
    }

    if (action === 'reject') {
      if (!canManageTransactionWorkflow(user)) throw new Error('Only Admin/Finance can reject transactions')
      if (!['submitted', 'approved', 'returned'].includes(tx.status)) throw new Error('Only submitted, approved, or returned transactions can be rejected')
      if (!note) throw new Error('Rejection reason is required')
      tx.status = 'rejected'
      tx.updatedBy = user._id
      appendTransactionComment(tx, user, note, 'reject_note')
      appendTransactionAudit(tx, user, 'reject', { fromStatus, toStatus: 'rejected', comment: note })
      await tx.save(saveOpts)
      return { transaction: tx }
    }

    if (action === 'post') {
      return getTransactionPostingService().executePostWorkflowAction({
        tx,
        user,
        note,
        fromStatus,
        options,
        session,
      })
    }

    throw new Error('Unsupported transaction action')
  }
}

module.exports = {
  populateTransactionListQuery,
  populateTransactionQuery,
  createTransactionWorkflowAction,
}
