const express = require('express')
const fs = require('fs')
const path = require('path')
const { protect } = require('../middleware/auth')
const { Joi, validateParams } = require('../middleware/validate')
const OperationsLegalDocument = require('../models/OperationsLegalDocument')
const { createDiskUpload, resolveUploadDir } = require('../services/erpAccounting/uploadMiddleware')
const {
  TRANSACTION_ATTACHMENT_MIME_TYPES,
  validateAttachmentContent,
} = require('../services/erpAccounting/attachmentValidationService')
const { resolveAttachmentContentDisposition } = require('../services/erpAccounting/attachmentDownloadHeaders')
const {
  canViewOperationsModule,
  canWriteOperationsLegalDocuments,
} = require('../services/permissions/moduleAccessPolicy')

const uploadDir = resolveUploadDir('OPS_LEGAL_DOCUMENT_UPLOAD_DIR', 'operations-legal-docs')
const MAX_BYTES = Number(process.env.OPS_LEGAL_DOCUMENT_MAX_BYTES || 10 * 1024 * 1024)

const legalUpload = createDiskUpload({
  dir: uploadDir,
  prefix: 'ops-legal',
  maxBytes: MAX_BYTES,
  allowedMimeTypes: TRANSACTION_ATTACHMENT_MIME_TYPES,
  typeError: 'Unsupported file type for legal documents.',
})

const idParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
})

const router = express.Router()

router.get('/', protect, async (req, res) => {
  if (!canViewOperationsModule(req.user)) {
    return res.status(403).json({ success: false, message: 'Forbidden' })
  }
  try {
    const rows = await OperationsLegalDocument.find({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .lean()
    res.json({
      success: true,
      documents: rows.map((row) => ({
        _id: row._id,
        originalName: row.originalName,
        mimeType: row.mimeType,
        size: row.size,
        uploadedByName: row.uploadedByName,
        uploadedAt: row.createdAt,
      })),
    })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to list documents' })
  }
})

router.post(
  '/',
  protect,
  (req, res, next) => {
    if (!canWriteOperationsLegalDocuments(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }
    next()
  },
  (req, res, next) => {
    legalUpload.single('file')(req, res, (err) => {
      if (!err) return next()
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'File is too large' })
      }
      return res.status(400).json({ success: false, message: err.message || 'Upload failed' })
    })
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'File is required' })
      }
      if (!validateAttachmentContent(req.file)) {
        fs.unlinkSync(req.file.path)
        return res.status(400).json({ success: false, message: 'File content does not match declared type' })
      }
      const storedFileName = path.basename(req.file.path)
      const doc = await OperationsLegalDocument.create({
        originalName: req.file.originalname || 'document',
        storedFileName,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedById: req.user._id,
        uploadedByName: req.user.name,
      })
      res.status(201).json({
        success: true,
        document: {
          _id: doc._id,
          originalName: doc.originalName,
          mimeType: doc.mimeType,
          size: doc.size,
          uploadedByName: doc.uploadedByName,
          uploadedAt: doc.createdAt,
        },
      })
    } catch (e) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path)
        } catch {
          /* ignore */
        }
      }
      res.status(500).json({ success: false, message: e.message || 'Upload failed' })
    }
  },
)

router.delete('/:id', protect, validateParams(idParamSchema), async (req, res) => {
  if (!canWriteOperationsLegalDocuments(req.user)) {
    return res.status(403).json({ success: false, message: 'Forbidden' })
  }
  try {
    const doc = await OperationsLegalDocument.findById(req.params.id)
    if (!doc || doc.isDeleted) {
      return res.status(404).json({ success: false, message: 'Document not found' })
    }
    const safeName = String(doc.storedFileName || '')
    if (!safeName || safeName.includes('..') || safeName.includes('/') || safeName.includes('\\')) {
      return res.status(400).json({ success: false, message: 'Invalid stored filename' })
    }
    const resolvedUpload = path.resolve(uploadDir)
    const filePath = path.resolve(resolvedUpload, safeName)
    if (!filePath.startsWith(resolvedUpload)) {
      return res.status(403).json({ success: false, message: 'Access denied' })
    }
    doc.isDeleted = true
    await doc.save()
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath)
      } catch {
        /* ignore */
      }
    }
    res.json({ success: true })
  } catch {
    res.status(500).json({ success: false, message: 'Delete failed' })
  }
})

router.get('/:id/download', protect, validateParams(idParamSchema), async (req, res) => {
  if (!canViewOperationsModule(req.user)) {
    return res.status(403).json({ success: false, message: 'Forbidden' })
  }
  try {
    const doc = await OperationsLegalDocument.findById(req.params.id)
    if (!doc || doc.isDeleted) {
      return res.status(404).json({ success: false, message: 'Document not found' })
    }
    const safeName = String(doc.storedFileName || '')
    if (!safeName || safeName.includes('..') || safeName.includes('/') || safeName.includes('\\')) {
      return res.status(400).json({ success: false, message: 'Invalid stored filename' })
    }
    const resolvedUpload = path.resolve(uploadDir)
    const filePath = path.resolve(resolvedUpload, safeName)
    if (!filePath.startsWith(resolvedUpload)) {
      return res.status(403).json({ success: false, message: 'Access denied' })
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File missing on disk' })
    }
    const mime = doc.mimeType || 'application/octet-stream'
    res.type(mime)
    res.setHeader(
      'Content-Disposition',
      resolveAttachmentContentDisposition(req, {
        mimeType: doc.mimeType,
        filename: doc.originalName,
      }),
    )
    res.sendFile(filePath)
  } catch {
    res.status(500).json({ success: false, message: 'Download failed' })
  }
})

module.exports = router
