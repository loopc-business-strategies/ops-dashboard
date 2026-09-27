import AsyncStorage from '@react-native-async-storage/async-storage'
import { ApiError, toApiError } from '@/src/api/errors'
import { uploadWeightCapturePhoto } from '@/src/api/weightCaptures'
import { deleteCapturePhoto } from '@/src/scaleCamera/capturePhoto'

export type PhotoQueueItem = {
  captureId: string
  uri: string
  queuedAt: string
  attempts: number
  lastError?: string
}

const STORAGE_KEY = 'mg_floor_photo_queue_v1'
/** Photos rejected this many times for a non-transient reason are dropped (file deleted). */
const MAX_REJECTIONS = 5

let cache: PhotoQueueItem[] | null = null
let writeChain: Promise<void> = Promise.resolve()
let flushing: Promise<{ uploaded: number }> | null = null

async function load(): Promise<PhotoQueueItem[]> {
  if (cache) return cache
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as { items?: PhotoQueueItem[] }) : null
    cache = Array.isArray(parsed?.items) ? parsed!.items : []
  } catch (err) {
    console.warn('[MG Floor] photo queue load failed', err)
    cache = []
  }
  return cache
}

async function persist(items: PhotoQueueItem[]) {
  cache = items
  writeChain = writeChain.then(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, items }))
    } catch (err) {
      console.warn('[MG Floor] photo queue persist failed', err)
    }
  })
  await writeChain
}

export async function enqueueCapturePhoto(captureId: string, uri: string) {
  const items = await load()
  const row: PhotoQueueItem = { captureId, uri, queuedAt: new Date().toISOString(), attempts: 0 }
  await persist([...items.filter((i) => i.captureId !== captureId), row])
}

export async function pendingPhotoCount() {
  return (await load()).length
}

function isTransient(err: ApiError) {
  return (
    err.kind === 'NETWORK_ERROR'
    || err.kind === 'TIMEOUT'
    || err.kind === 'SERVER_ERROR'
    || err.kind === 'OFFLINE'
    || err.kind === 'AUTH_ERROR'
    // Capture record not synced yet (still in the outbox).
    || err.kind === 'NOT_FOUND'
  )
}

async function runFlush() {
  let uploaded = 0
  const items = [...(await load())]
  for (const item of items) {
    try {
      await uploadWeightCapturePhoto(item.captureId, item.uri)
      uploaded += 1
      deleteCapturePhoto(item.uri)
      await persist((await load()).filter((i) => i.captureId !== item.captureId))
    } catch (err) {
      const e = toApiError(err)
      if (isTransient(e)) {
        if (e.kind === 'NETWORK_ERROR' || e.kind === 'TIMEOUT' || e.kind === 'OFFLINE') break
        continue
      }
      const attempts = item.attempts + 1
      if (attempts >= MAX_REJECTIONS) {
        console.warn('[MG Floor] dropping capture photo after repeated rejection', item.captureId, e.message)
        deleteCapturePhoto(item.uri)
        await persist((await load()).filter((i) => i.captureId !== item.captureId))
      } else {
        await persist(
          (await load()).map((i) => (i.captureId === item.captureId ? { ...i, attempts, lastError: e.message } : i)),
        )
      }
    }
  }
  return { uploaded }
}

/** Upload queued capture photos; one flush at a time. */
export function flushPhotoQueue() {
  if (!flushing) {
    flushing = runFlush().finally(() => {
      flushing = null
    })
  }
  return flushing
}
