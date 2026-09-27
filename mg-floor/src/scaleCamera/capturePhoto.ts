import { Directory, File, Paths } from 'expo-file-system'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'

const PHOTO_DIR = 'mg-floor-captures'
const PHOTO_MAX_WIDTH = 1280

function photoDirectory() {
  const dir = new Directory(Paths.document, PHOTO_DIR)
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true })
  return dir
}

export function capturePhotoFile(captureId: string) {
  return new File(photoDirectory(), `${captureId}.jpg`)
}

/**
 * Downscale and JPEG-compress the frame that produced the confirmed reading and keep it in the
 * app document directory until it is uploaded (survives restarts; cache could be purged).
 */
export async function saveCapturePhoto(sourceUri: string, captureId: string, quality: number): Promise<string> {
  const context = ImageManipulator.manipulate(sourceUri)
  context.resize({ width: PHOTO_MAX_WIDTH })
  const image = await context.renderAsync()
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: Math.min(0.9, Math.max(0.3, quality)) })
  const target = capturePhotoFile(captureId)
  await new File(result.uri).move(target, { overwrite: true })
  return target.uri
}

export function deleteCapturePhoto(uri: string) {
  try {
    const file = new File(uri)
    if (file.exists) file.delete()
  } catch {
    // Already gone or not ours — nothing to clean up.
  }
}

/** Remove a camera frame that was only needed for OCR. */
export function discardFrame(uri: string | null | undefined) {
  if (!uri) return
  deleteCapturePhoto(uri)
}
