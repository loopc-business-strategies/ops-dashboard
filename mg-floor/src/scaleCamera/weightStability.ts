import type { ScaleWeighProfile } from './cameraSettings'

export type OcrFrame = {
  /** Parsed, range-checked weight for this frame; null when the frame produced no usable reading. */
  weight: number | null
  confidence: number
  at: number
}

export type StabilityConfig = {
  consecutiveFrames: number
  stableDurationMs: number
  /** ± band: every reading in a stable run lies within this distance of the run's midpoint. */
  allowedVariation: number
  minConfidence: number
  /** A gap longer than this between two readings breaks the run (camera paused, OCR stalled). */
  maxGapMs?: number
}

export type StabilityReason = 'NO_READING' | 'LOW_CONFIDENCE' | 'CHANGING' | 'COLLECTING' | 'STABLE'

export type StabilityState = {
  stable: boolean
  reason: StabilityReason
  /** Median of the current run (the latest reading when the run is a single frame). */
  weight: number | null
  /** Lowest confidence across the stable run (what gets submitted). */
  confidence: number
  frames: number
  durationMs: number
  /** 0..1 progress toward both the frame and duration requirements. */
  progress: number
}

export type StabilityReading = { weight: number; confidence: number; offsetMs: number }

/** What gets stored with a confirmed capture to show the display had settled. */
export type StabilitySnapshot = {
  stable: boolean
  stableFrames: number
  durationMs: number
  tolerance: number
  weight: number | null
  readings: StabilityReading[]
}

const EPS = 1e-9

export const MAX_TRACKED_FRAMES = 60
/** Background reads older than this cannot back a capture. */
export const MAX_READING_AGE_MS = 1500
export const MAX_STORED_READINGS = 30

export function pushFrame(frames: OcrFrame[], frame: OcrFrame, max = MAX_TRACKED_FRAMES): OcrFrame[] {
  const next = frames.length >= max ? frames.slice(frames.length - max + 1) : frames.slice()
  next.push(frame)
  return next
}

/** ± tolerance for a scale: the configured allowedVariation, never tighter than one display count. */
export function stabilityTolerance(profile: Pick<ScaleWeighProfile, 'resolution' | 'cameraOcr'>): number {
  const configured = Number(profile.cameraOcr.allowedVariation) || 0
  const resolution = Number(profile.resolution) || 0
  return Math.max(0, configured, resolution)
}

export function stabilityConfigFor(profile: Pick<ScaleWeighProfile, 'resolution' | 'cameraOcr'>): StabilityConfig {
  return {
    consecutiveFrames: profile.cameraOcr.consecutiveFrames,
    stableDurationMs: profile.cameraOcr.stableDurationMs,
    allowedVariation: stabilityTolerance(profile),
    minConfidence: profile.cameraOcr.minConfidence,
    maxGapMs: MAX_READING_AGE_MS,
  }
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) / 2)]
}

export function withinTolerance(a: number, b: number, tolerance: number) {
  return Math.abs(a - b) <= tolerance + EPS
}

/**
 * A reading is stable when the trailing run of frames — each with a weight, confidence at or
 * above the minimum, and all fitting inside a ±allowedVariation band — is at least
 * consecutiveFrames long and spans at least stableDurationMs. Any empty or low-confidence frame,
 * or a gap longer than maxGapMs, breaks the run.
 */
export function evaluateStability(frames: OcrFrame[], config: StabilityConfig): StabilityState {
  const empty: StabilityState = {
    stable: false,
    reason: 'NO_READING',
    weight: null,
    confidence: 0,
    frames: 0,
    durationMs: 0,
    progress: 0,
  }
  const latest = frames[frames.length - 1]
  if (!latest || latest.weight == null) return empty
  if (latest.confidence < config.minConfidence) {
    return { ...empty, reason: 'LOW_CONFIDENCE', weight: latest.weight, confidence: latest.confidence }
  }

  const band = 2 * Math.max(0, config.allowedVariation)
  const maxGap = config.maxGapMs != null && config.maxGapMs > 0 ? config.maxGapMs : Infinity
  let start = frames.length - 1
  let lo = latest.weight
  let hi = latest.weight
  let minConfidence = latest.confidence
  for (let i = frames.length - 2; i >= 0; i -= 1) {
    const f = frames[i]
    if (f.weight == null || f.confidence < config.minConfidence) break
    if (frames[i + 1].at - f.at > maxGap) break
    const nextLo = Math.min(lo, f.weight)
    const nextHi = Math.max(hi, f.weight)
    if (nextHi - nextLo > band + EPS) break
    lo = nextLo
    hi = nextHi
    start = i
    minConfidence = Math.min(minConfidence, f.confidence)
  }

  const run = frames.slice(start)
  const count = run.length
  const durationMs = Math.max(0, latest.at - frames[start].at)
  const needFrames = Math.max(1, config.consecutiveFrames)
  const needMs = Math.max(0, config.stableDurationMs)
  const progress = Math.min(1, count / needFrames, needMs > 0 ? durationMs / needMs : 1)
  const stable = count >= needFrames && durationMs >= needMs

  const previous = frames[start - 1]
  const changing = !stable && count === 1 && previous?.weight != null && previous.weight !== latest.weight

  return {
    stable,
    reason: stable ? 'STABLE' : changing ? 'CHANGING' : 'COLLECTING',
    weight: median(run.map((f) => f.weight as number)),
    confidence: minConfidence,
    frames: count,
    durationMs,
    progress,
  }
}

/** The latest reading is recent enough to trust (not a cached result from before a pause). */
export function isFresh(frames: OcrFrame[], now: number, maxAgeMs = MAX_READING_AGE_MS) {
  const latest = frames[frames.length - 1]
  return Boolean(latest) && now - latest.at >= 0 && now - latest.at <= maxAgeMs
}

export type StabilityStatus = { label: string; tone: 'neutral' | 'ok' | 'warn' | 'bad'; ready: boolean }

/** Operator-facing status line for the live camera. */
export function stabilityStatus(
  state: StabilityState | null,
  format: (weight: number) => string,
): StabilityStatus {
  if (!state || state.reason === 'NO_READING') return { label: 'WAITING FOR SCALE', tone: 'neutral', ready: false }
  if (state.stable && state.weight != null) {
    return { label: `STABLE — ${format(state.weight)} · CAPTURE READY`, tone: 'ok', ready: true }
  }
  if (state.reason === 'CHANGING') return { label: 'WEIGHT MOVING', tone: 'warn', ready: false }
  return { label: 'READING SCALE...', tone: 'neutral', ready: false }
}

/** Readings of the current run, for the capture record. */
export function stabilitySnapshot(frames: OcrFrame[], state: StabilityState, tolerance: number): StabilitySnapshot {
  const run = state.frames > 0 ? frames.slice(frames.length - state.frames) : []
  const first = run[0]?.at ?? 0
  const readings = run
    .filter((f): f is OcrFrame & { weight: number } => f.weight != null)
    .slice(-MAX_STORED_READINGS)
    .map((f) => ({ weight: f.weight, confidence: f.confidence, offsetMs: Math.max(0, f.at - first) }))
  return {
    stable: state.stable,
    stableFrames: state.frames,
    durationMs: state.durationMs,
    tolerance,
    weight: state.weight,
    readings,
  }
}
