const fs = require('fs')
const os = require('os')
const path = require('path')
const { getUploadStorageStatus, resolveUploadStorageRoot } = require('../services/uploadStorage')

describe('uploadStorage', () => {
  const previous = {}

  beforeEach(() => {
    for (const key of ['UPLOAD_STORAGE_ROOT', 'RAILWAY_VOLUME_MOUNT_PATH', 'NODE_ENV']) {
      previous[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  test('resolveUploadStorageRoot prefers UPLOAD_STORAGE_ROOT over volume mount', () => {
    process.env.UPLOAD_STORAGE_ROOT = '/app/uploads'
    process.env.RAILWAY_VOLUME_MOUNT_PATH = '/data'
    expect(resolveUploadStorageRoot()).toBe(path.resolve('/app/uploads'))
  })

  test('resolveUploadStorageRoot falls back to RAILWAY_VOLUME_MOUNT_PATH', () => {
    process.env.RAILWAY_VOLUME_MOUNT_PATH = '/app/uploads'
    expect(resolveUploadStorageRoot()).toBe(path.resolve('/app/uploads'))
  })

  test('getUploadStorageStatus reports writable temp directory', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-root-'))
    process.env.UPLOAD_STORAGE_ROOT = dir
    process.env.RAILWAY_VOLUME_MOUNT_PATH = dir

    const status = getUploadStorageStatus()
    expect(status.uploadStorageRootSet).toBe(true)
    expect(status.uploadStorageWritable).toBe(true)
    expect(status.volumeAligned).toBe(true)
  })
})
