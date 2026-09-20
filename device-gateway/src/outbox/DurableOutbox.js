const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

/**
 * Durable gateway outbox — file-backed (atomic JSON rewrite).
 * Survives process restart. better-sqlite3 preferred when native build tools exist;
 * this store needs no Python/node-gyp and works on factory Windows PCs.
 */

const STATUSES = ['PENDING', 'SENDING', 'SENT', 'FAILED']
const MAX_ATTEMPTS = Number(process.env.MG_GATEWAY_OUTBOX_MAX_ATTEMPTS || 25)
const BASE_BACKOFF_MS = Number(process.env.MG_GATEWAY_OUTBOX_BACKOFF_MS || 5000)
const MAX_BACKOFF_MS = Number(process.env.MG_GATEWAY_OUTBOX_MAX_BACKOFF_MS || 60000)

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function readStore(filePath) {
  if (!fs.existsSync(filePath)) return { version: 1, events: [] }
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(raw)
    if (!Array.isArray(data.events)) return { version: 1, events: [] }
    return data
  } catch {
    // Corrupt file: keep sidecar backup and start empty
    try {
      fs.copyFileSync(filePath, `${filePath}.corrupt.${Date.now()}`)
    } catch {
      // ignore
    }
    return { version: 1, events: [] }
  }
}

function writeStore(filePath, data) {
  const dir = path.dirname(filePath)
  ensureDir(dir)
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 0), 'utf8')
  fs.renameSync(tmp, filePath)
}

class DurableOutbox {
  constructor({ dataDir, gatewayId } = {}) {
    this.dataDir = dataDir || path.join(__dirname, '..', '..', 'data')
    this.filePath = path.join(this.dataDir, 'outbox.json')
    this.gatewayId = gatewayId || 'MG-GATEWAY-001'
    ensureDir(this.dataDir)
    this._data = readStore(this.filePath)
    // Reset interrupted SENDING → PENDING on open (crash recovery)
    let dirty = false
    for (const ev of this._data.events) {
      if (ev.status === 'SENDING') {
        ev.status = 'PENDING'
        dirty = true
      }
    }
    if (dirty) this._persist()
  }

  _persist() {
    writeStore(this.filePath, this._data)
  }

  enqueue({
    eventId,
    deviceId,
    deviceType,
    eventType,
    tenantId = 'mg',
    operationId = null,
    payload = {},
  }) {
    const id = String(eventId || crypto.randomUUID())
    const existing = this._data.events.find((e) => e.eventId === id)
    if (existing) return existing

    const row = {
      eventId: id,
      gatewayId: this.gatewayId,
      deviceId: String(deviceId || ''),
      deviceType: String(deviceType || 'unknown'),
      eventType: String(eventType || 'UNKNOWN'),
      tenantId: String(tenantId || 'mg'),
      operationId: operationId ? String(operationId) : null,
      payload,
      createdAt: new Date().toISOString(),
      attempts: 0,
      lastAttemptAt: null,
      lastError: '',
      status: 'PENDING',
      nextAttemptAt: new Date().toISOString(),
    }
    this._data.events.push(row)
    this._persist()
    return row
  }

  listDue(limit = 50) {
    const now = Date.now()
    return this._data.events
      .filter((e) => e.status === 'PENDING' && new Date(e.nextAttemptAt || 0).getTime() <= now)
      .slice(0, limit)
  }

  listByStatus(status) {
    return this._data.events.filter((e) => e.status === status)
  }

  count() {
    const c = { PENDING: 0, SENDING: 0, SENT: 0, FAILED: 0 }
    for (const e of this._data.events) {
      if (c[e.status] != null) c[e.status] += 1
    }
    return c
  }

  markSending(eventId) {
    const ev = this._data.events.find((e) => e.eventId === eventId)
    if (!ev) return null
    ev.status = 'SENDING'
    ev.attempts = Number(ev.attempts || 0) + 1
    ev.lastAttemptAt = new Date().toISOString()
    this._persist()
    return ev
  }

  markSent(eventId) {
    const ev = this._data.events.find((e) => e.eventId === eventId)
    if (!ev) return null
    ev.status = 'SENT'
    ev.lastError = ''
    ev.nextAttemptAt = null
    this._persist()
    return ev
  }

  markFailed(eventId, errorMessage) {
    const ev = this._data.events.find((e) => e.eventId === eventId)
    if (!ev) return null
    ev.lastError = String(errorMessage || 'unknown error').slice(0, 500)
    if (ev.attempts >= MAX_ATTEMPTS) {
      ev.status = 'FAILED'
      ev.nextAttemptAt = null
    } else {
      ev.status = 'PENDING'
      const backoff = Math.min(BASE_BACKOFF_MS * 2 ** Math.max(ev.attempts - 1, 0), MAX_BACKOFF_MS)
      ev.nextAttemptAt = new Date(Date.now() + backoff).toISOString()
    }
    this._persist()
    return ev
  }

  /** Test helper: reopen same path (simulates process restart). */
  static reopen(opts) {
    return new DurableOutbox(opts)
  }
}

module.exports = {
  DurableOutbox,
  STATUSES,
  MAX_ATTEMPTS,
  BASE_BACKOFF_MS,
  MAX_BACKOFF_MS,
}
