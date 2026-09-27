import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CameraOcrSettings } from './cameraSettings'
import { replayOcrSample } from './ocrReplay'
import { samplesFromJson, type OcrSample } from './ocrSamples'

/**
 * Replays GJ-2000 frames exported from SCALE OCR DIAGNOSTICS (drop the JSON into __fixtures__/gj2000).
 * Candidate decoder settings can be scored without touching the tablet:
 *   GJ2000_TUNING='{"segmentThreshold":0.35}' npx vitest run gj2000Fixtures
 */
const FIXTURE_DIR = join(__dirname, '__fixtures__', 'gj2000')

function loadFixtures(): { file: string; sample: OcrSample }[] {
  if (!existsSync(FIXTURE_DIR)) return []
  return readdirSync(FIXTURE_DIR)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .sort()
    .flatMap((file) => {
      const samples = samplesFromJson(JSON.parse(readFileSync(join(FIXTURE_DIR, file), 'utf8')))
      if (!samples.length) throw new Error(`${file} contains no valid OCR samples`)
      return samples.map((sample) => ({ file, sample }))
    })
}

function tuningOverrides(): Partial<CameraOcrSettings> {
  const raw = process.env.GJ2000_TUNING
  return raw ? (JSON.parse(raw) as Partial<CameraOcrSettings>) : {}
}

const fixtures = loadFixtures()
const overrides = tuningOverrides()

describe.skipIf(fixtures.length === 0)('GJ-2000 fixture replay', () => {
  it.each(fixtures.map(({ file, sample }) => [
    `${file} · ${sample.id} · ${sample.expected ?? 'SHOULD NOT READ'}${sample.note ? ` (${sample.note})` : ''}`,
    sample,
  ] as const))('%s', (_label, sample) => {
    const outcome = replayOcrSample(sample, overrides)
    expect(outcome.pass, outcome.reason).toBe(true)
  })
})
