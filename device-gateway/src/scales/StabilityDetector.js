class StabilityDetector {
  constructor({ toleranceGrams = 0.05, durationMs = 800 } = {}) {
    this.toleranceGrams = toleranceGrams
    this.durationMs = durationMs
    this._anchor = null
    this._since = null
  }

  /**
   * @returns {{ stable: boolean, weight: number }}
   */
  update(weight, now = Date.now()) {
    const w = Number(weight)
    if (!Number.isFinite(w)) {
      this._anchor = null
      this._since = null
      return { stable: false, weight: w }
    }

    if (this._anchor == null || Math.abs(w - this._anchor) > this.toleranceGrams) {
      this._anchor = w
      this._since = now
      return { stable: false, weight: w }
    }

    const stable = now - this._since >= this.durationMs
    return { stable, weight: this._anchor }
  }

  reset() {
    this._anchor = null
    this._since = null
  }
}

module.exports = { StabilityDetector }
