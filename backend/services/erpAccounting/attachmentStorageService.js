const fs = require('fs')
const { ObjectId, GridFSBucket } = require('mongodb')

function getAttachmentStorageDriver() {
  return String(process.env.ATTACHMENT_STORAGE_DRIVER || 'gridfs').trim().toLowerCase()
}

function resolveBackendBaseUrl(req) {
  const configured = String(process.env.SERVER_BASE_URL || '').trim()
  if (configured) return configured.replace(/\/+$/, '')

  if (req) {
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
    const proto = forwardedProto || req.protocol || 'http'
    const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim()
    const host = forwardedHost || req.get('host')
    if (host) return `${proto}://${host}`
  }

  return ''
}

function getGridFsBucket(connection) {
  return new GridFSBucket(connection.db, { bucketName: 'transactionAttachments' })
}

async function storeUploadedAttachment({
  req,
  file,
  user,
  model,
  relativePathPrefix = '/uploads/transactions',
  bucketName = 'transactionAttachments',
  metadata = {},
}) {
  const relativePath = `${relativePathPrefix}/${file.filename}`
  const backendBaseUrl = resolveBackendBaseUrl(req)
  const base = {
    originalName: file.originalname,
    fileName: file.filename,
    relativePath,
    url: backendBaseUrl ? `${backendBaseUrl}${relativePath}` : relativePath,
    mimeType: file.mimetype || 'application/octet-stream',
    size: Number(file.size || 0),
    uploadedBy: user._id,
    uploadedAt: new Date(),
  }

  if (getAttachmentStorageDriver() === 'local') {
    return { ...base, storageDriver: 'local', storageKey: file.filename }
  }

  const bucket = new GridFSBucket(model.db, { bucketName })
  const uploadId = new ObjectId()
  await new Promise((resolve, reject) => {
    fs.createReadStream(file.path)
      .pipe(bucket.openUploadStreamWithId(uploadId, file.filename, {
        contentType: file.mimetype || 'application/octet-stream',
        metadata: {
          tenant: req.tenant,
          originalName: file.originalname,
          uploadedBy: String(user._id),
          ...metadata,
        },
      }))
      .on('error', reject)
      .on('finish', resolve)
  })

  if (fs.existsSync(file.path)) fs.unlinkSync(file.path)
  return { ...base, storageDriver: 'gridfs', storageKey: String(uploadId) }
}

async function storeTransactionAttachment({ req, file, user, transactionModel }) {
  return storeUploadedAttachment({
    req,
    file,
    user,
    model: transactionModel,
    relativePathPrefix: '/uploads/transactions',
    bucketName: 'transactionAttachments',
    metadata: { transactionId: String(req.params.id || '') },
  })
}

async function removeStoredAttachment({ attachment, transactionModel, localFilePath, bucketName = 'transactionAttachments' }) {
  if (String(attachment?.storageDriver || 'local') !== 'gridfs') {
    if (localFilePath && fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath)
    return
  }

  const storageKey = String(attachment.storageKey || '')
  if (!ObjectId.isValid(storageKey)) return
  try {
    const bucket = new GridFSBucket(transactionModel.db, { bucketName })
    await bucket.delete(new ObjectId(storageKey))
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err
  }
}

async function sendStoredAttachment({ res, attachment, transactionModel, localFilePath, bucketName = 'transactionAttachments' }) {
  if (String(attachment?.storageDriver || 'local') !== 'gridfs') {
    if (!localFilePath || !fs.existsSync(localFilePath)) {
      return res.status(404).json({ success: false, message: 'File not found' })
    }
    return res.sendFile(localFilePath)
  }

  const storageKey = String(attachment.storageKey || '')
  if (!ObjectId.isValid(storageKey)) {
    return res.status(404).json({ success: false, message: 'Stored file not found' })
  }

  const bucket = new GridFSBucket(transactionModel.db, { bucketName })
  const stream = bucket.openDownloadStream(new ObjectId(storageKey))
  stream.on('error', () => {
    if (!res.headersSent) res.status(404).json({ success: false, message: 'Stored file not found' })
  })
  return stream.pipe(res)
}

module.exports = {
  getAttachmentStorageDriver,
  storeUploadedAttachment,
  storeTransactionAttachment,
  removeStoredAttachment,
  sendStoredAttachment,
}
