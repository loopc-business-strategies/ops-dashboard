const path = require('path')

const INLINE_PREVIEW_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
])

function inferMimeFromFilename(filename) {
  const ext = path.extname(String(filename || '')).toLowerCase()
  const map = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  }
  return map[ext] || ''
}

function isInlinePreviewMimeType(mimeType) {
  return INLINE_PREVIEW_MIME_TYPES.has(String(mimeType || '').trim().toLowerCase())
}

function resolveAttachmentContentDisposition(req, { mimeType, filename }) {
  const safeName = String(filename || 'download').replace(/"/g, '')
  if (req.query.download === '1') {
    return `attachment; filename="${safeName}"`
  }

  const mime = String(mimeType || inferMimeFromFilename(filename)).trim().toLowerCase()
  const wantsInline = req.query.preview === '1' || req.query.inline === '1'
  const disposition = wantsInline && isInlinePreviewMimeType(mime) ? 'inline' : 'attachment'
  return `${disposition}; filename="${safeName}"`
}

module.exports = {
  INLINE_PREVIEW_MIME_TYPES,
  inferMimeFromFilename,
  isInlinePreviewMimeType,
  resolveAttachmentContentDisposition,
}
