const fs = require('fs')

const TRANSACTION_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'text/plain',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
]

const detectAttachmentSignature = (filePath) => {
  const fd = fs.openSync(filePath, 'r')
  try {
    const header = Buffer.alloc(16)
    const bytesRead = fs.readSync(fd, header, 0, 16, 0)
    const b = header.slice(0, bytesRead)
    if (b.length >= 4 && b.toString('ascii', 0, 4) === '%PDF') return 'pdf'
    if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 && b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A) return 'png'
    if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpeg'
    if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp'
    if (b.length >= 6 && ['GIF87a', 'GIF89a'].includes(b.toString('ascii', 0, 6))) return 'gif'
    if (b.length >= 2 && b.toString('ascii', 0, 2) === 'BM') return 'bmp'
    if (b.length >= 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2A && b[3] === 0x00) || (b[0] === 0x4D && b[1] === 0x4D && b[2] === 0x00 && b[3] === 0x2A))) return 'tiff'
    if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4B && b[2] === 0x03 && b[3] === 0x04) return 'zip'
    if (b.length >= 8 && b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11 && b[3] === 0xE0 && b[4] === 0xA1 && b[5] === 0xB1 && b[6] === 0x1A && b[7] === 0xE1) return 'ole'
    return 'unknown'
  } finally {
    fs.closeSync(fd)
  }
}

const isLikelyTextFile = (filePath) => {
  const fd = fs.openSync(filePath, 'r')
  try {
    const sample = Buffer.alloc(1024)
    const bytesRead = fs.readSync(fd, sample, 0, 1024, 0)
    const b = sample.slice(0, bytesRead)
    if (!b.length) return true
    const suspicious = [...b].filter((byte) => byte < 9 || (byte > 13 && byte < 32)).length
    return (suspicious / b.length) < 0.05
  } finally {
    fs.closeSync(fd)
  }
}

const validateAttachmentContent = (file) => {
  const sig = detectAttachmentSignature(file.path)
  const mime = String(file.mimetype || '')
  if (mime === 'application/pdf') return sig === 'pdf'
  if (mime === 'image/png') return sig === 'png'
  if (mime === 'image/jpeg') return sig === 'jpeg'
  if (mime === 'image/webp') return sig === 'webp'
  if (mime === 'image/gif') return sig === 'gif'
  if (mime === 'image/bmp') return sig === 'bmp'
  if (mime === 'image/tiff') return sig === 'tiff'
  if (mime === 'text/plain' || mime === 'text/csv') return isLikelyTextFile(file.path)
  if (['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'].includes(mime)) return sig === 'zip'
  if (['application/vnd.ms-excel', 'application/msword', 'application/vnd.ms-powerpoint'].includes(mime)) return sig === 'ole' || sig === 'zip'
  return false
}

module.exports = {
  TRANSACTION_ATTACHMENT_MIME_TYPES,
  validateAttachmentContent,
}
