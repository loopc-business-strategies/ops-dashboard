const express = require('express')
const fs = require('fs')
const path = require('path')
const { protect } = require('../middleware/auth')
const { Joi, validateParams, validateQuery, validateBody } = require('../middleware/validate')
const OperationsLegalDocument = require('../models/OperationsLegalDocument')
const OperationsLegalFolder = require('../models/OperationsLegalFolder')
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

const listDocsQuerySchema = Joi.object({
  folderId: Joi.alternatives().try(
    Joi.string().valid('unfiled'),
    Joi.string().hex().length(24),
  ).optional(),
})

const createFolderBodySchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
})

const renameFolderBodySchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
})

const router = express.Router()

function normalizeUploaderName(value) {
  if (value == null) return ''
  const s = String(value).trim()
  if (!s || s === 'NaN' || s === 'undefined' || s === 'null') return ''
  return s
}

function mapDocumentRow(row) {
  const name = normalizeUploaderName(row.uploadedByName)
  return {
    _id: row._id,
    originalName: row.originalName,
    mimeType: row.mimeType,
    size: row.size,
    uploadedByName: name || 'Unknown',
    uploadedAt: row.createdAt,
    folderId: row.folderId ? String(row.folderId) : null,
  }
}

function mapFolderRow(row) {
  return {
    _id: row._id,
    name: row.name,
    createdByName: row.createdByName,
    createdAt: row.createdAt,
  }
}

router.get('/folders', protect, async (req, res) => {
  if (!canViewOperationsModule(req.user)) {
    return res.status(403).json({ success: false, message: 'Forbidden' })
  }
  try {
    const rows = await OperationsLegalFolder.find({ isDeleted: { $ne: true } })
      .sort({ name: 1 })
      .lean()
    res.json({ success: true, folders: rows.map(mapFolderRow) })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to list folders' })
  }
})

router.post(
  '/folders',
  protect,
  (req, res, next) => {
    if (!canWriteOperationsLegalDocuments(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }
    next()
  },
  validateBody(createFolderBodySchema),
  async (req, res) => {
    try {
      const doc = await OperationsLegalFolder.create({
        name: req.body.name,
        createdById: req.user._id,
        createdByName: normalizeUploaderName(req.user?.name) || 'Unknown',
      })
      res.status(201).json({ success: true, folder: mapFolderRow(doc.toObject()) })
    } catch (e) {
      if (e && e.code === 11000) {
        return res.status(409).json({ success: false, message: 'A folder with that name already exists' })
      }
      res.status(500).json({ success: false, message: e.message || 'Failed to create folder' })
    }
  },
)

router.patch(
  '/folders/:id',
  protect,
  (req, res, next) => {
    if (!canWriteOperationsLegalDocuments(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }
    next()
  },
  validateParams(idParamSchema),
  validateBody(renameFolderBodySchema),
  async (req, res) => {
    try {
      const folder = await OperationsLegalFolder.findById(req.params.id)
      if (!folder || folder.isDeleted) {
        return res.status(404).json({ success: false, message: 'Folder not found' })
      }
      folder.name = String(req.body.name).trim()
      await folder.save()
      res.json({ success: true, folder: mapFolderRow(folder.toObject()) })
    } catch (e) {
      if (e && e.code === 11000) {
        return res.status(409).json({ success: false, message: 'A folder with that name already exists' })
      }
      res.status(500).json({ success: false, message: e.message || 'Failed to rename folder' })
    }
  },
)

router.delete('/folders/:id', protect, validateParams(idParamSchema), async (req, res) => {
  if (!canWriteOperationsLegalDocuments(req.user)) {
    return res.status(403).json({ success: false, message: 'Forbidden' })
  }
  try {
    const folder = await OperationsLegalFolder.findById(req.params.id)
    if (!folder || folder.isDeleted) {
      return res.status(404).json({ success: false, message: 'Folder not found' })
    }
    const count = await OperationsLegalDocument.countDocuments({
      isDeleted: { $ne: true },
      folderId: folder._id,
    })
    if (count > 0) {
      return res.status(409).json({ success: false, message: 'Folder is not empty. Move or delete documents first.' })
    }
    folder.isDeleted = true
    await folder.save()
    res.json({ success: true })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to delete folder' })
  }
})

router.get('/', protect, validateQuery(listDocsQuerySchema), async (req, res) => {
  if (!canViewOperationsModule(req.user)) {
    return res.status(403).json({ success: false, message: 'Forbidden' })
  }
  try {
    const filter = { isDeleted: { $ne: true } }
    const q = req.query.folderId
    if (q === 'unfiled') {
      filter.$or = [{ folderId: null }, { folderId: { $exists: false } }]
    } else if (q) {
      filter.folderId = q
    }
    const rows = await OperationsLegalDocument.find(filter)
      .sort({ createdAt: -1 })
      .lean()
    res.json({
      success: true,
      documents: rows.map(mapDocumentRow),
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

      let folderId = null
      const rawFolder = req.body?.folderId != null ? String(req.body.folderId).trim() : ''
      if (rawFolder && /^[a-f\d]{24}$/i.test(rawFolder)) {
        const folder = await OperationsLegalFolder.findOne({ _id: rawFolder, isDeleted: { $ne: true } })
        if (!folder) {
          fs.unlinkSync(req.file.path)
          return res.status(400).json({ success: false, message: 'Folder not found' })
        }
        folderId = folder._id
      }

      const storedFileName = path.basename(req.file.path)
      const uploader = normalizeUploaderName(req.user?.name)
      const doc = await OperationsLegalDocument.create({
        originalName: req.file.originalname || 'document',
        storedFileName,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedById: req.user._id,
        uploadedByName: uploader || 'Unknown',
        folderId,
      })
      res.status(201).json({
        success: true,
        document: mapDocumentRow(doc.toObject()),
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
