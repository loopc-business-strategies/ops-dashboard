import { Directory, File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { bundleSamples, samplesFromJson, type OcrSample } from './ocrSamples'

const SAMPLE_DIR = 'mg-floor-ocr-samples'
/** Each sample holds a ~480×150 grayscale crop (~100 KB as JSON); cap what one tablet keeps. */
export const MAX_OCR_SAMPLES = 60

function sampleDirectory() {
  const dir = new Directory(Paths.document, SAMPLE_DIR)
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true })
  return dir
}

function sampleFiles(): File[] {
  return sampleDirectory()
    .list()
    .filter((entry): entry is File => entry instanceof File && entry.uri.endsWith('.json'))
    .sort((a, b) => a.uri.localeCompare(b.uri))
}

export function countOcrSamples() {
  try {
    return sampleFiles().length
  } catch {
    return 0
  }
}

export function saveOcrSample(sample: OcrSample) {
  if (sampleFiles().length >= MAX_OCR_SAMPLES) {
    throw new Error(`Sample limit (${MAX_OCR_SAMPLES}) reached — export and clear samples first`)
  }
  const file = new File(sampleDirectory(), `${sample.id}.json`)
  file.write(JSON.stringify(sample))
}

async function loadOcrSamples(): Promise<OcrSample[]> {
  const out: OcrSample[] = []
  for (const file of sampleFiles()) {
    try {
      out.push(...samplesFromJson(JSON.parse(await file.text())))
    } catch {
      // Corrupt or partial file — skip rather than block the export.
    }
  }
  return out
}

/** Write every saved sample into one bundle file and open the share sheet (email, Drive, USB…). */
export async function exportOcrSamples(): Promise<number> {
  const samples = await loadOcrSamples()
  if (!samples.length) throw new Error('No samples saved yet')
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const bundle = new File(Paths.cache, `gj2000-ocr-samples-${stamp}.json`)
  bundle.write(JSON.stringify(bundleSamples(samples, new Date())))
  await Sharing.shareAsync(bundle.uri, { mimeType: 'application/json', dialogTitle: 'Export OCR samples' })
  return samples.length
}

export function clearOcrSamples() {
  for (const file of sampleFiles()) {
    try {
      file.delete()
    } catch {
      // Already removed.
    }
  }
}
