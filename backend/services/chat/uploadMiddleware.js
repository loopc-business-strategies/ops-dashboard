const { createDiskUpload, resolveUploadDir } = require('../erpAccounting/uploadMiddleware')

const CHAT_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/webm',
  'audio/x-m4a',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]

const chatUploadDir = resolveUploadDir('CHAT_UPLOAD_DIR', 'chat')

const chatUpload = createDiskUpload({
  dir: chatUploadDir,
  prefix: 'chat',
  maxBytes: Number(process.env.CHAT_ATTACHMENT_MAX_BYTES || 15 * 1024 * 1024),
  allowedMimeTypes: CHAT_ATTACHMENT_MIME_TYPES,
  typeError: 'Unsupported chat attachment type',
})

function inferAttachmentKind(mimeType = '') {
  const mime = String(mimeType).toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('audio/')) return 'audio'
  return 'file'
}

function buildAttachmentPayload(file) {
  if (!file) return null
  return {
    fileName: file.filename,
    originalName: file.originalname || file.filename,
    mimeType: file.mimetype || 'application/octet-stream',
    size: Number(file.size || 0),
    kind: inferAttachmentKind(file.mimetype),
  }
}

module.exports = {
  chatUploadDir,
  chatUpload,
  buildAttachmentPayload,
  inferAttachmentKind,
}
