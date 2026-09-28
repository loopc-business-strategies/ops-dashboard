export type OcrFrame = {
  /** Parsed, range-checked weight for this frame; null when the frame produced no usable reading. */
  weight: number | null
  confidence: number
  at: number
}

export type StabilityConfig = {
  consecutiveFrames: number
  stableDurationMs: number
  allowedVariation: number
  minConfidence: number
}

export type StabilityReason = 'NO_READING' | 'LOW_CONFIDENCE' | 'CHANGING' | 'COLLECTING' | 'STABLE'

export type StabilityState = {
  stable: boolean
  reason: StabilityReason
  weight: number | null
  /** Lowest confidence across the stable run (what gets submitted). */
  confidence: number
  frames: number
  durationMs: number
  /** 0..1 progress toward both the frame and duration requirements. */
  progress: number
}

const EPS = 1e-9

export const MAX_TRACKED_FRAMES = 60

export function pushFrame(frames: OcrFrame[], frame: OcrFrame, max = MAX_TRACKED_FRAMES): OcrFrame[] {
  const next = frames.length >= max ? frames.slice(frames.length - max + 1) : frames.slice()
  next.push(frame)
  return next
}

/**
 * A reading is stable when the trailing run of frames — each with a weight, confidence at or
 * above the minimum and within allowedVariation of the latest weight — is at least
 * consecutiveFrames long and spans at least stableDurationMs. Any empty or low-confidence
 * frame breaks the run.
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

  let start = frames.length - 1
  let minConfidence = latest.confidence
  for (let i = frames.length - 2; i >= 0; i -= 1) {
    const f = frames[i]
    if (f.weight == null || f.confidence < config.minConfidence) break
    if (Math.abs(f.weight - latest.weight) > config.allowedVariation + EPS) break
    start = i
    minConfidence = Math.min(minConfidence, f.confidence)
  }

  const count = frames.length - start
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
    weight: latest.weight,
    confidence: minConfidence,
    frames: count,
    durationMs,
    progress,
  }
}
