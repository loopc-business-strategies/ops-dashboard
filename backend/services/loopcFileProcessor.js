const fs = require('fs')
const path = require('path')

const MAX_TEXT_CHARS = Number(process.env.LOOPC_MAX_EXTRACTED_TEXT || 12000)
const MAX_PREVIEW_LINES = 20

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm', '.log', '.yaml', '.yml', '.env', '.sql', '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.css',
])

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'])
const AUDIO_MIMES = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/m4a'])
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'])
const DOC_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
])

function truncate(text, max = MAX_TEXT_CHARS) {
  const s = String(text || '')
  if (s.length <= max) return s
  return `${s.slice(0, max)}\n\n… [truncated ${s.length - max} chars]`
}

function extOf(name = '') {
  return path.extname(String(name || '')).toLowerCase()
}

function classifyFile(mimeType = '', filename = '') {
  const mime = String(mimeType || '').toLowerCase()
  const ext = extOf(filename)
  if (IMAGE_MIMES.has(mime) || /^\.(jpe?g|png|gif|webp|bmp|svg)$/.test(ext)) return 'image'
  if (AUDIO_MIMES.has(mime) || /^\.(mp3|wav|ogg|m4a|webm|aac|flac)$/.test(ext)) return 'audio'
  if (VIDEO_MIMES.has(mime) || /^\.(mp4|webm|mov|avi|mkv)$/.test(ext)) return 'video'
  if (mime === 'application/pdf' || ext === '.pdf') return 'pdf'
  if (DOC_MIMES.has(mime) || TEXT_EXTENSIONS.has(ext)) return 'document'
  return 'file'
}

function extractPdfText(buffer) {
  const raw = buffer.toString('latin1')
  const chunks = []
  const parenMatches = raw.match(/\((?:\\.|[^\\)])+?\)/g) || []
  for (const match of parenMatches) {
    const inner = match.slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')
    if (/[\w\s]{3,}/.test(inner)) chunks.push(inner)
  }
  const unique = [...new Set(chunks.map((c) => c.trim()).filter(Boolean))]
  return unique.join('\n')
}

function summarizeCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return { preview: '', rows: 0, columns: 0 }
  const header = lines[0]
  const columns = header.split(',').length
  const preview = lines.slice(0, MAX_PREVIEW_LINES).join('\n')
  return { preview, rows: Math.max(0, lines.length - 1), columns }
}

function readFileBuffer(file) {
  if (file?.buffer) return file.buffer
  if (file?.path && fs.existsSync(file.path)) return fs.readFileSync(file.path)
  return Buffer.alloc(0)
}

async function processUploadedFile(file) {
  const buffer = readFileBuffer(file)
  const name = String(file.originalname || file.filename || 'upload')
  const mimeType = String(file.mimetype || 'application/octet-stream')
  const size = Number(file.size || buffer.length || 0)
  const kind = classifyFile(mimeType, name)
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const base = { id, name, mimeType, size, kind }

  if (kind === 'image') {
    const base64 = buffer.toString('base64')
    return {
      ...base,
      imageBase64: base64,
      dataUrl: `data:${mimeType};base64,${base64}`,
      textExcerpt: '',
      summary: `Image uploaded (${Math.round(size / 1024)} KB)`,
    }
  }

  if (kind === 'pdf') {
    const extracted = truncate(extractPdfText(buffer))
    return {
      ...base,
      textExcerpt: extracted,
      summary: extracted
        ? `PDF with ~${extracted.split(/\s+/).length} words extracted`
        : 'PDF uploaded (limited text extraction — describe what you need)',
    }
  }

  if (kind === 'document' || TEXT_EXTENSIONS.has(extOf(name))) {
    const text = truncate(buffer.toString('utf8'))
    if (extOf(name) === '.csv' || mimeType.includes('csv')) {
      const csv = summarizeCsv(text)
      return {
        ...base,
        textExcerpt: truncate(csv.preview),
        summary: `CSV: ${csv.rows} rows × ${csv.columns} columns`,
        stats: csv,
      }
    }
    const words = text.split(/\s+/).filter(Boolean).length
    return {
      ...base,
      textExcerpt: text,
      summary: `Document: ${words} words, ${Math.round(size / 1024)} KB`,
    }
  }

  if (kind === 'audio') {
    return {
      ...base,
      textExcerpt: '',
      summary: `Audio file (${Math.round(size / 1024)} KB) — ${name}`,
      audioBase64: buffer.toString('base64'),
    }
  }

  if (kind === 'video') {
    return {
      ...base,
      textExcerpt: '',
      summary: `Video file (${Math.round(size / 1024)} KB) — ${name}`,
    }
  }

  // Generic binary — try utf8 read
  const maybeText = buffer.toString('utf8')
  const printableRatio = maybeText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').length / Math.max(maybeText.length, 1)
  if (printableRatio > 0.95 && maybeText.length > 0) {
    return {
      ...base,
      kind: 'document',
      textExcerpt: truncate(maybeText),
      summary: `Text-like file (${Math.round(size / 1024)} KB)`,
    }
  }

  return {
    ...base,
    textExcerpt: '',
    summary: `File uploaded (${Math.round(size / 1024)} KB) — ${mimeType}`,
  }
}

async function processUploadedFiles(files = []) {
  const list = Array.isArray(files) ? files : [files].filter(Boolean)
  return Promise.all(list.map((f) => processUploadedFile(f)))
}

function cleanupUploadedFiles(files = []) {
  for (const file of files) {
    try {
      if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path)
    } catch {
      /* ignore */
    }
  }
}

module.exports = {
  classifyFile,
  processUploadedFile,
  processUploadedFiles,
  cleanupUploadedFiles,
  IMAGE_MIMES,
  AUDIO_MIMES,
  VIDEO_MIMES,
}
