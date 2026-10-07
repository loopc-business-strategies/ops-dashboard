const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const { GridFSBucket } = require('mongodb')
const { getActiveTenantConnection } = require('../db/tenantModelProxy')
const { isHardenedEnv } = require('../utils/securityEnv')

const UPLOADED_FILES_BUCKET = 'uploadedFiles'

function buildUploadedFileKey(folder, fileName) {
  const safeFolder = String(folder || '').trim()
  const safeName = path.basename(String(fileName || '').trim())
  if (!safeFolder || !safeName || safeName === '.' || safeName === '..') return ''
  return `${safeFolder}/${safeName}`
}

function resolveFileStoreDb(connection) {
  const conn = connection || getActiveTenantConnection()
  if (conn) return conn.db || null
  if (isHardenedEnv()) throw new Error('Tenant DB context required')
  return mongoose.connection?.db || null
}

function getUploadedFilesBucket(connection) {
  const db = resolveFileStoreDb(connection)
  if (!db) throw new Error('File storage database is not connected')
  return new GridFSBucket(db, { bucketName: UPLOADED_FILES_BUCKET })
}

async function findUploadedFile({ folder, fileName, connection }) {
  const key = buildUploadedFileKey(folder, fileName)
  if (!key) return null
  const bucket = getUploadedFilesBucket(connection)
  const [doc] = await bucket.find({ filename: key }).sort({ uploadDate: -1 }).limit(1).toArray()
  return doc || null
}

function removeLocalFile(filePath) {
  if (!filePath) return
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {
    /* best effort */
  }
}

async function storeLocalFile({ folder, fileName, localPath, mimeType, connection, metadata = {} }) {
  const key = buildUploadedFileKey(folder, fileName)
  if (!key) throw new Error('Invalid upload file name')
  const bucket = getUploadedFilesBucket(connection)
  await new Promise((resolve, reject) => {
    fs.createReadStream(localPath)
      .on('error', reject)
      .pipe(bucket.openUploadStream(key, {
        metadata: { folder, fileName: path.basename(fileName), contentType: mimeType || '', ...metadata },
      }))
      .on('error', reject)
      .on('finish', resolve)
  })
  return key
}

/** Moves a multer disk upload into the tenant database and deletes the temporary disk copy. */
async function persistUploadedFile({ folder, file, connection, metadata = {} }) {
  if (!file?.path || !file?.filename) throw new Error('Uploaded file is missing')
  const key = await storeLocalFile({
    folder,
    fileName: file.filename,
    localPath: file.path,
    mimeType: file.mimetype,
    connection,
    metadata: { originalName: file.originalname || file.filename, ...metadata },
  })
  removeLocalFile(file.path)
  return key
}

function discardUploadedTempFile(file) {
  removeLocalFile(file?.path)
}

/**
 * Streams a stored upload. Files saved before uploads moved to the database are
 * still read from `localPath` until they have been copied.
 */
async function sendUploadedFile({ res, folder, fileName, localPath, connection, notFoundMessage = 'File not found.' }) {
  const stored = await findUploadedFile({ folder, fileName, connection })
  if (stored) {
    if (!res.getHeader('Content-Type')) {
      const contentType = stored.metadata?.contentType || stored.contentType
      if (contentType) res.setHeader('Content-Type', contentType)
      else res.type(path.extname(String(fileName)) || 'application/octet-stream')
    }
    res.setHeader('Content-Length', String(stored.length))
    const stream = getUploadedFilesBucket(connection).openDownloadStream(stored._id)
    stream.on('error', () => {
      if (!res.headersSent) res.status(404).json({ success: false, message: notFoundMessage })
      else res.destroy()
    })
    return stream.pipe(res)
  }
  if (localPath && fs.existsSync(localPath)) return res.sendFile(path.resolve(localPath))
  res.removeHeader('Content-Type')
  res.removeHeader('Content-Disposition')
  return res.status(404).json({ success: false, message: notFoundMessage })
}

/** Best effort: the owning record is already updated, so a storage failure is logged rather than thrown. */
async function deleteUploadedFile({ folder, fileName, localPath, connection }) {
  const key = buildUploadedFileKey(folder, fileName)
  if (key) {
    try {
      const bucket = getUploadedFilesBucket(connection)
      const docs = await bucket.find({ filename: key }).toArray()
      for (const doc of docs) await bucket.delete(doc._id)
    } catch (err) {
      console.warn(`[uploads] could not delete stored file ${key}: ${err?.message || err}`)
    }
  }
  removeLocalFile(localPath)
}

module.exports = {
  UPLOADED_FILES_BUCKET,
  buildUploadedFileKey,
  getUploadedFilesBucket,
  findUploadedFile,
  storeLocalFile,
  persistUploadedFile,
  discardUploadedTempFile,
  sendUploadedFile,
  deleteUploadedFile,
}
