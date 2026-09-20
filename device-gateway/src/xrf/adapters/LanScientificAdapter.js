/**
 * LANScientific adapter stub.
 * Protocol/SDK is not documented in-repo — do not invent wire formats.
 * Fill in once model, firmware, and communication path are confirmed on site.
 */
class LanScientificAdapter {
  constructor(config = {}) {
    const analyzerId = String(config.analyzerId || '').trim().toUpperCase()
    if (!analyzerId) {
      throw new Error('LanScientificAdapter requires analyzerId')
    }
    this.config = config
    this.analyzerId = analyzerId
    this._connected = false
  }

  async connect() {
    throw new Error(
      `LANScientific protocol not configured for ${this.analyzerId}. ` +
        'Set MG_XRF_MODE=simulator for development, or provide model/SDK details to implement the adapter.',
    )
  }

  async disconnect() {
    this._connected = false
  }

  get connected() {
    return this._connected
  }

  async runTest() {
    throw new Error('LANScientific live test is not implemented — protocol TBD')
  }
}

module.exports = { LanScientificAdapter }
