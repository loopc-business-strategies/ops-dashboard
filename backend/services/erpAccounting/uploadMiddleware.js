const fs = require('fs')
const path = require('path')
const multer = require('multer')

const DEFAULT_UPLOAD_ROOT = path.join(__dirname, '../../uploads')
let warnedAboutEphemeralUploads = false

function resolveUploadDir(envVar, fallbackName) {
  if (process.env[envVar]) return path.resolve(process.env[envVar])

  const root = process.env.UPLOAD_STORAGE_ROOT
    ? path.resolve(process.env.UPLOAD_STORAGE_ROOT)
    : DEFAULT_UPLOAD_ROOT

  if (process.env.NODE_ENV === 'production' && !process.env.UPLOAD_STORAGE_ROOT && !warnedAboutEphemeralUploads) {
    warnedAboutEphemeralUploads = true
    console.warn('[uploads] UPLOAD_STORAGE_ROOT is not set. Configure it to a persistent volume path in production.')
  }

  return path.join(root, fallbackName)
}

function createDiskUpload({ dir, prefix, maxBytes, allowedMimeTypes, typeError }) {
  fs.mkdirSync(dir, { recursive: true })

  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, dir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '')
        const rawBase = path.basename(file.originalname || prefix, ext)
        const base = rawBase.replace(/[^a-zA-Z0-9-_]+/g, '-').slice(0, 48) || prefix
        cb(null, `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${base}${ext}`)
      },
    }),
    limits: { fileSize: maxBytes },
    fileFilter: (_req, file, cb) => {
      if (allowedMimeTypes.includes(file.mimetype)) return cb(null, true)
      cb(new Error(typeError))
    },
  })
}

function createErpUploadMiddleware({ transactionAttachmentMimeTypes }) {
  const transactionUploadDir = resolveUploadDir('TRANSACTION_UPLOAD_DIR', 'transactions')
  const bankSlipUploadDir = resolveUploadDir('BANK_SLIP_UPLOAD_DIR', 'bank-slips')
  const vendorDocumentUploadDir = resolveUploadDir('VENDOR_DOCUMENT_UPLOAD_DIR', 'vendor-documents')
  const bankSlipMimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']

  return {
    transactionUploadDir,
    bankSlipUploadDir,
    vendorDocumentUploadDir,
    bankSlipUpload: createDiskUpload({
      dir: bankSlipUploadDir,
      prefix: 'bankslip',
      maxBytes: 5 * 1024 * 1024,
      allowedMimeTypes: bankSlipMimeTypes,
      typeError: 'Only PDF, PNG, JPG, WEBP files are allowed for bank slips',
    }),
    transactionUpload: createDiskUpload({
      dir: transactionUploadDir,
      prefix: 'attachment',
      maxBytes: Number(process.env.TRANSACTION_ATTACHMENT_MAX_BYTES || 10 * 1024 * 1024),
      allowedMimeTypes: transactionAttachmentMimeTypes,
      typeError: 'Unsupported attachment type',
    }),
    vendorDocumentUpload: createDiskUpload({
      dir: vendorDocumentUploadDir,
      prefix: 'vendor-document',
      maxBytes: Number(process.env.VENDOR_DOCUMENT_MAX_BYTES || 10 * 1024 * 1024),
      allowedMimeTypes: transactionAttachmentMimeTypes,
      typeError: 'Unsupported attachment type',
    }),
  }
}

module.exports = {
  createDiskUpload,
  createErpUploadMiddleware,
  resolveUploadDir,
}
