const fs = require('fs')
const os = require('os')
const path = require('path')
const express = require('express')
const request = require('supertest')
const mongoose = require('mongoose')
const {
  startMongoMemoryServer,
  disconnectMongooseIfConnected,
} = require('./mongoMemoryTestServer')
const {
  persistUploadedFile,
  storeLocalFile,
  findUploadedFile,
  sendUploadedFile,
  deleteUploadedFile,
} = require('../services/uploadFileStore')

jest.setTimeout(120000)

let mongo
let tmpDir

const readBinaryBody = (res, callback) => {
  const chunks = []
  res.on('data', (chunk) => chunks.push(chunk))
  res.on('end', () => callback(null, Buffer.concat(chunks)))
}

const serveApp = (folder, fileName, localPath) => {
  const app = express()
  app.get('/file', (_req, res) => sendUploadedFile({ res, folder, fileName, localPath }))
  return app
}

const writeTemp = (name, content) => {
  const filePath = path.join(tmpDir, name)
  fs.writeFileSync(filePath, content)
  return filePath
}

beforeAll(async () => {
  mongo = await startMongoMemoryServer()
  await mongoose.connect(mongo.getUri())
})

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-store-'))
})

afterEach(async () => {
  await mongoose.connection.db.collection('uploadedFiles.files').deleteMany({})
  await mongoose.connection.db.collection('uploadedFiles.chunks').deleteMany({})
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('uploadFileStore', () => {
  test('persists a multer upload, removes the temp file, and serves it with its content type', async () => {
    const content = Buffer.from('%PDF-1.4 slip')
    const tempPath = writeTemp('bankslip-1-abc-slip.pdf', content)

    await persistUploadedFile({
      folder: 'bank-slips',
      file: { path: tempPath, filename: 'bankslip-1-abc-slip.pdf', mimetype: 'application/pdf', originalname: 'slip.pdf' },
    })

    expect(fs.existsSync(tempPath)).toBe(false)
    const res = await request(serveApp('bank-slips', 'bankslip-1-abc-slip.pdf')).get('/file').buffer(true).parse(readBinaryBody)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/pdf/)
    expect(Buffer.compare(res.body, content)).toBe(0)
  })

  test('falls back to the file extension when no content type was stored', async () => {
    const tempPath = writeTemp('legacy.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    await storeLocalFile({ folder: 'chat', fileName: 'legacy.png', localPath: tempPath })

    const res = await request(serveApp('chat', 'legacy.png')).get('/file').buffer(true).parse(readBinaryBody)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/image\/png/)
  })

  test('serves a disk-only file, and returns JSON 404 when the file is nowhere', async () => {
    const diskPath = writeTemp('old.txt', 'on disk')
    const disk = await request(serveApp('chat', 'old.txt', diskPath)).get('/file')
    expect(disk.status).toBe(200)
    expect(disk.text).toBe('on disk')

    const missing = await request(serveApp('chat', 'gone.txt', path.join(tmpDir, 'gone.txt'))).get('/file')
    expect(missing.status).toBe(404)
    expect(missing.body.success).toBe(false)
  })

  test('delete removes both the stored copy and the disk copy', async () => {
    const diskPath = writeTemp('doc.pdf', '%PDF-1.4 doc')
    await storeLocalFile({ folder: 'crm-contacts', fileName: 'doc.pdf', localPath: diskPath, mimeType: 'application/pdf' })
    expect(await findUploadedFile({ folder: 'crm-contacts', fileName: 'doc.pdf' })).not.toBeNull()

    await deleteUploadedFile({ folder: 'crm-contacts', fileName: 'doc.pdf', localPath: diskPath })

    expect(await findUploadedFile({ folder: 'crm-contacts', fileName: 'doc.pdf' })).toBeNull()
    expect(fs.existsSync(diskPath)).toBe(false)
  })
})
