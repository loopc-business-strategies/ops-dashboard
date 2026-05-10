function registerAttachmentRoutes(deps) {
  const {
    router,
    protect,
    path,
    fs,
    Transaction,
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
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'File not found' })
      }

      if (type === 'transaction') {
        const txId = req.query.txId
        if (!txId) {
          return res.status(400).json({ success: false, message: 'Transaction ID required' })
        }

        const tx = await Transaction.findById(txId)
        if (!tx) {
          return res.status(404).json({ success: false, message: 'Transaction not found' })
        }
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