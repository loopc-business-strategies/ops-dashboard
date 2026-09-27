const fs = require('fs')
const path = require('path')

function resolveUploadStorageRoot() {
  const explicit = String(process.env.UPLOAD_STORAGE_ROOT || '').trim()
  if (explicit) return path.resolve(explicit)

  const volumeMount = String(process.env.RAILWAY_VOLUME_MOUNT_PATH || '').trim()
  if (volumeMount) return path.resolve(volumeMount)

  return null
}

function getUploadStorageStatus() {
  const isProduction = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production'
  const uploadStorageRootSet = Boolean(String(process.env.UPLOAD_STORAGE_ROOT || '').trim())
  const volumeMountPath = String(process.env.RAILWAY_VOLUME_MOUNT_PATH || '').trim() || null
  const root = resolveUploadStorageRoot()

  let uploadStorageExists = false
  let uploadStorageWritable = false

  if (root) {
    try {
      fs.mkdirSync(root, { recursive: true })
      uploadStorageExists = fs.existsSync(root)
      fs.accessSync(root, fs.constants.W_OK)
      uploadStorageWritable = true
    } catch {
      uploadStorageWritable = false
    }
  }

  const volumeAligned = !root || !volumeMountPath
    || path.resolve(volumeMountPath) === path.resolve(root)

  return {
    uploadStorageRootSet,
    uploadStorageWritable,
    uploadStorageExists,
    volumeMountPath,
    volumeAligned,
    uploadStorageRecommended: isProduction,
    root: root || null,
  }
}

function isPathInside(child, parent) {
  const rel = path.relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

/** Scale camera photos: MG_FLOOR_CAPTURE_UPLOAD_DIR override, else <upload root>/mg-floor-captures. */
function getMgFloorCaptureStorageStatus() {
  const override = String(process.env.MG_FLOOR_CAPTURE_UPLOAD_DIR || '').trim()
  const root = resolveUploadStorageRoot()
  const dir = override ? path.resolve(override) : (root ? path.join(root, 'mg-floor-captures') : null)

  let writable = false
  if (dir) {
    try {
      fs.mkdirSync(dir, { recursive: true })
      fs.accessSync(dir, fs.constants.W_OK)
      writable = true
    } catch {
      writable = false
    }
  }

  return {
    dir,
    overridden: Boolean(override),
    insideUploadRoot: Boolean(dir && root && isPathInside(dir, root)),
    writable,
  }
}

module.exports = {
  getUploadStorageStatus,
  getMgFloorCaptureStorageStatus,
  resolveUploadStorageRoot,
}
