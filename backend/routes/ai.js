const express = require('express')
const fs = require('fs')
const path = require('path')
const multer = require('multer')
const rateLimit = require('express-rate-limit')
const { protect } = require('../middleware/auth')
const { Joi, validateBody } = require('../middleware/validate')
const { runAgentChat, getAiAgentConfig } = require('../services/aiAgentService')
const { processUploadedFiles, cleanupUploadedFiles } = require('../services/loopcFileProcessor')

const router = express.Router()

const isProduction = process.env.NODE_ENV === 'production'
const aiChatLimiter = rateLimit({
  windowMs: Number(process.env.AI_CHAT_RATE_LIMIT_WINDOW_MS || 60 * 1000),
  max: Number(process.env.AI_CHAT_RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction,
  message: { success: false, message: 'Too many AI requests. Please wait a moment.' },
})

const uploadDir = path.join(__dirname, '..', 'uploads', 'loopc')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const MAX_FILE_SIZE = Number(process.env.LOOPC_MAX_UPLOAD_BYTES || 15 * 1024 * 1024)
const MAX_FILES = Number(process.env.LOOPC_MAX_UPLOAD_FILES || 5)

const ALLOWED_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv', 'text/markdown', 'application/json', 'application/xml', 'text/xml',
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/m4a',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo',
  'application/octet-stream',
])

const loopcUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const safe = String(file.originalname || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_')
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`)
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase()
    if (ALLOWED_MIMES.has(mime) || mime.startsWith('image/') || mime.startsWith('audio/') || mime.startsWith('video/') || mime.startsWith('text/')) {
      cb(null, true)
    } else {
      cb(new Error(`File type not allowed: ${mime || 'unknown'}`))
    }
  },
})

const chatSchema = Joi.object({
  message: Joi.string().trim().min(1).max(4000).required(),
  history: Joi.array().items(Joi.object({
    role: Joi.string().valid('user', 'assistant').required(),
    content: Joi.string().max(8000).required(),
  })).max(20).optional(),
  pageContext: Joi.object({
    tab: Joi.string().max(80).allow('').optional(),
    path: Joi.string().max(200).allow('').optional(),
    tenant: Joi.string().max(40).allow('').optional(),
  }).optional(),
  lastError: Joi.object({
    status: Joi.number().integer().min(0).max(599).allow(null).optional(),
    message: Joi.string().max(500).allow('').optional(),
    url: Joi.string().max(500).allow('').optional(),
    method: Joi.string().max(10).allow('').optional(),
    at: Joi.string().max(40).allow('').optional(),
  }).allow(null).optional(),
  model: Joi.string().valid('gpt-4o', 'gpt-4o-mini').optional(),
  provider: Joi.string().valid('builtin', 'openai').optional(),
})

function parseJsonField(value, fallback = null) {
  if (value == null || value === '') return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(String(value))
  } catch {
    return fallback
  }
}

function sendChatResult(res, result) {
  res.json({
    success: true,
    reply: result.reply,
    intent: result.intent,
    mode: result.mode,
    provider: result.provider,
    providerLabel: result.providerLabel,
    model: result.model,
    error: Boolean(result.error),
    contextUsed: result.contextUsed,
  })
}

router.get('/config', protect, (req, res) => {
  res.json({
    success: true,
    ...getAiAgentConfig(),
    uploads: {
      enabled: true,
      maxFiles: MAX_FILES,
      maxFileSizeMB: Math.round(MAX_FILE_SIZE / (1024 * 1024)),
      accepts: 'documents, images, audio, video',
    },
  })
})

router.post('/chat', protect, aiChatLimiter, validateBody(chatSchema), async (req, res) => {
  try {
    const { message, history = [], pageContext = {}, lastError = null, model = null, provider = null } = req.body
    const result = await runAgentChat({
      req,
      message,
      history,
      pageContext,
      lastError,
      model,
      provider,
      attachments: [],
    })
    sendChatResult(res, result)
  } catch (err) {
    console.error('[ai-agent] chat error:', err)
    res.status(500).json({ success: false, message: 'AI agent could not process your request.' })
  }
})

router.post('/chat/upload', protect, aiChatLimiter, (req, res, next) => {
  loopcUpload.array('files', MAX_FILES)(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? `File too large. Max ${Math.round(MAX_FILE_SIZE / (1024 * 1024))} MB per file.`
        : (err.message || 'Upload failed.')
      return res.status(400).json({ success: false, message: msg })
    }
    return next()
  })
}, async (req, res) => {
  const uploaded = req.files || []
  try {
    const message = String(req.body?.message || '').trim()
    if (!message && uploaded.length === 0) {
      return res.status(400).json({ success: false, message: 'Message or at least one file is required.' })
    }

    const attachments = await processUploadedFiles(uploaded)
    const safeAttachments = attachments.map((a) => ({
      id: a.id,
      name: a.name,
      mimeType: a.mimeType,
      size: a.size,
      kind: a.kind,
      summary: a.summary,
      textExcerpt: a.textExcerpt,
      stats: a.stats,
      imageBase64: a.imageBase64,
      audioBase64: a.audioBase64,
    }))

    const result = await runAgentChat({
      req,
      message: message || 'Analyze the uploaded file(s).',
      history: parseJsonField(req.body?.history, []),
      pageContext: parseJsonField(req.body?.pageContext, {}),
      lastError: parseJsonField(req.body?.lastError, null),
      model: req.body?.model || null,
      provider: req.body?.provider || null,
      attachments: safeAttachments,
    })

    sendChatResult(res, result)
  } catch (err) {
    console.error('[ai-agent] chat upload error:', err)
    res.status(500).json({ success: false, message: 'AI agent could not process your upload.' })
  } finally {
    cleanupUploadedFiles(uploaded)
  }
})

module.exports = router
