const fs = require('fs')

const SIGNATURES = {
  pdf: [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }],
  png: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] }],
  jpeg: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  webp: [
    { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
    { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
  ],
  gif: [{ offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] }],
  zip: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  ole: [{ offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0] }],
}

const MIME_TO_KIND = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'zip',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'zip',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'zip',
  'application/msword': 'ole',
  'application/vnd.ms-excel': 'ole',
  'application/vnd.ms-powerpoint': 'ole',
}

function readHeader(filePath, length = 16) {
  const fd = fs.openSync(filePath, 'r')
  try {
    const buffer = Buffer.alloc(length)
    fs.readSync(fd, buffer, 0, length, 0)
    return buffer
  } finally {
    fs.closeSync(fd)
  }
}

function matchesSignature(buffer, signature) {
  return signature.bytes.every((byte, index) => buffer[signature.offset + index] === byte)
}

function detectKind(buffer) {
  for (const [kind, signatures] of Object.entries(SIGNATURES)) {
    if (signatures.every((signature) => matchesSignature(buffer, signature))) {
      return kind
    }
  }
  return null
}

function validateFileContent(filePath, declaredMimeType) {
  const mime = String(declaredMimeType || '').trim().toLowerCase()
  const expectedKind = MIME_TO_KIND[mime]

  if (!expectedKind) {
    if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml' || mime === 'text/xml') {
      return { ok: true }
    }
    if (mime.startsWith('audio/') || mime.startsWith('video/')) {
      return { ok: true }
    }
    return { ok: false, message: `Unsupported MIME type for content validation: ${mime || 'unknown'}` }
  }

  let buffer
  try {
    buffer = readHeader(filePath)
  } catch {
    return { ok: false, message: 'Unable to read uploaded file for validation' }
  }

  const detected = detectKind(buffer)
  if (!detected) {
    return { ok: false, message: 'Uploaded file content does not match declared type' }
  }

  if (expectedKind !== detected) {
    return { ok: false, message: `File content (${detected}) does not match declared type (${expectedKind})` }
  }

  return { ok: true }
}

function validateUploadedFiles(req, res, next) {
  const files = []
  if (req.file) files.push(req.file)
  if (Array.isArray(req.files)) files.push(...req.files)
  else if (req.files && typeof req.files === 'object') {
    for (const group of Object.values(req.files)) {
      if (Array.isArray(group)) files.push(...group)
    }
  }

  for (const file of files) {
    const filePath = file.path
    if (!filePath) continue
    const result = validateFileContent(filePath, file.mimetype)
    if (!result.ok) {
      try {
        fs.unlinkSync(filePath)
      } catch {
        // ignore cleanup errors
      }
      return res.status(400).json({ success: false, message: result.message })
    }
  }

  return next()
}

module.exports = {
  validateFileContent,
  validateUploadedFiles,
}
