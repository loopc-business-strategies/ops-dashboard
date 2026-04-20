export const formatTransactionCommentKind = (kind) => String(kind || 'comment').replace(/_/g, ' ')

export const getTransactionBulkSelectionLabel = (selectedIds = []) => {
  if (selectedIds.length) return `${selectedIds.length} selected transaction(s)`
  return 'Select rows below to submit, approve, or post in bulk.'
}

export const formatTransactionAuditEntry = (entry, labels = {}) => ({
  title: labels[entry?.action] || entry?.action || 'Unknown',
  actorName: entry?.actorId?.name || 'User',
  statusText: `${entry?.fromStatus || '-'} to ${entry?.toStatus || '-'}`,
  comment: entry?.comment || '',
})