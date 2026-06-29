const { respondRouteError } = require('../../utils/routeErrorHelpers')
const fs = require('fs')
const path = require('path')
const { resolveUploadDir } = require('../../services/erpAccounting/uploadMiddleware')
const {
  inferMimeFromFilename,
  resolveAttachmentContentDisposition,
} = require('../../services/erpAccounting/attachmentDownloadHeaders')

function registerAttachmentRoutes(deps) {
  const {
    router,
    protect,
    Transaction,
    Ledger,
    canAccessOperationalTransactions,
    canViewLedger,
    canCreateTransaction,
    sendStoredAttachment,
  } = deps

  router.get('/attachments/download/:type/:filename', protect, async (req, res) => {
    try {
      const { type, filename } = req.params

      if (!['transaction', 'bank-slip'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Invalid attachment type' })
      }

      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ success: false, message: 'Invalid filename' })
      }

      const uploadDir = type === 'transaction'
        ? resolveUploadDir('TRANSACTION_UPLOAD_DIR', 'transactions')
        : resolveUploadDir('BANK_SLIP_UPLOAD_DIR', 'bank-slips')

      const filePath = path.resolve(uploadDir, filename)
      if (!filePath.startsWith(uploadDir)) {
        return res.status(403).json({ success: false, message: 'Access denied' })
      }
      if (type === 'transaction') {
        if (!canAccessOperationalTransactions(req.user)) {
          return res.status(403).json({ success: false, message: 'Forbidden' })
        }

        const txId = req.query.txId
        if (!txId) {
          return res.status(400).json({ success: false, message: 'Transaction ID required' })
        }

        const tx = await Transaction.findById(txId)
        if (!tx) {
          return res.status(404).json({ success: false, message: 'Transaction not found' })
        }

        const attachment = (tx.attachments || []).find((entry) => String(entry.fileName || '') === filename)
        if (!attachment) {
          return res.status(404).json({ success: false, message: 'Attachment not found for this transaction' })
        }

        if (attachment.mimeType) {
          res.type(attachment.mimeType)
        }
        res.setHeader('Content-Disposition', resolveAttachmentContentDisposition(req, {
          mimeType: attachment.mimeType,
          filename: attachment.originalName || filename,
        }))

        const TenantTransaction = await Transaction.getTenantModel(req.tenant)
        return sendStoredAttachment({ res, attachment, transactionModel: TenantTransaction, localFilePath: filePath })
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'File not found' })
      }

      if (type === 'bank-slip') {
        if (!canViewLedger(req.user) && !canCreateTransaction(req.user)) {
          return res.status(403).json({ success: false, message: 'Forbidden' })
        }

        const ledger = await Ledger.findOne({
          referenceType: 'bank_jv',
          attachmentUrl: `/uploads/bank-slips/${filename}`,
          isDeleted: { $ne: true },
        }).select('_id attachmentName')

        if (!ledger) {
          return res.status(404).json({ success: false, message: 'Bank slip not found for this tenant' })
        }

        res.setHeader('Content-Disposition', resolveAttachmentContentDisposition(req, {
          mimeType: inferMimeFromFilename(filename),
          filename: ledger.attachmentName || filename,
        }))
      }

      res.sendFile(filePath)
    } catch (err) {
      respondRouteError(res, err, { tag: 'erp-accounting/attachmentRoutes' })
    }
  })
}

module.exports = {
  registerAttachmentRoutes,
}
