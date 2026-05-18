function registerAttachmentRoutes(deps) {
  const {
    router,
    protect,
    path,
    fs,
    Transaction,
    Ledger,
    canAccessTransactions,
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
        ? path.resolve(process.env.TRANSACTION_UPLOAD_DIR || path.join(__dirname, '../../uploads/transactions'))
        : path.resolve(process.env.BANK_SLIP_UPLOAD_DIR || path.join(__dirname, '../../uploads/bank-slips'))

      const filePath = path.resolve(uploadDir, filename)
      if (!filePath.startsWith(uploadDir)) {
        return res.status(403).json({ success: false, message: 'Access denied' })
      }
      if (type === 'transaction') {
        if (!canAccessTransactions(req.user)) {
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
        const disposition = req.query.download === '1' ? 'attachment' : 'inline'
        res.setHeader('Content-Disposition', `${disposition}; filename="${String(attachment.originalName || filename).replace(/"/g, '')}"`)

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

        const disposition = req.query.download === '1' ? 'attachment' : 'inline'
        res.setHeader('Content-Disposition', `${disposition}; filename="${String(ledger.attachmentName || filename).replace(/"/g, '')}"`)
      }

      res.sendFile(filePath)
    } catch {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  })
}

module.exports = {
  registerAttachmentRoutes,
}
