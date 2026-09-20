const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { DurableOutbox } = require('./DurableOutbox')

test('outbox persists across reopen (restart simulation)', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-outbox-'))
  const gatewayId = 'MG-GATEWAY-001'

  const a = new DurableOutbox({ dataDir, gatewayId })
  const row = a.enqueue({
    eventId: 'evt-restart-1',
    deviceId: 'MG-SCALE-001',
    deviceType: 'weighing_scale',
    eventType: 'SCALE_READING',
    payload: { reading: { scaleId: 'MG-SCALE-001', weight: 12.5, stable: true } },
  })
  assert.equal(row.status, 'PENDING')
  assert.equal(a.count().PENDING, 1)

  const b = DurableOutbox.reopen({ dataDir, gatewayId })
  const pending = b.listByStatus('PENDING')
  assert.equal(pending.length, 1)
  assert.equal(pending[0].eventId, 'evt-restart-1')
  assert.equal(pending[0].payload.reading.weight, 12.5)

  b.markSending('evt-restart-1')
  b.markSent('evt-restart-1')
  const c = DurableOutbox.reopen({ dataDir, gatewayId })
  assert.equal(c.count().SENT, 1)
  assert.equal(c.count().PENDING, 0)

  fs.rmSync(dataDir, { recursive: true, force: true })
})

test('outbox duplicate eventId is idempotent', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-outbox-'))
  const box = new DurableOutbox({ dataDir, gatewayId: 'MG-GATEWAY-001' })
  box.enqueue({ eventId: 'dup-1', deviceId: 'S1', deviceType: 'scale', eventType: 'SCALE_READING', payload: {} })
  box.enqueue({ eventId: 'dup-1', deviceId: 'S1', deviceType: 'scale', eventType: 'SCALE_READING', payload: {} })
  assert.equal(box.listByStatus('PENDING').length, 1)
  fs.rmSync(dataDir, { recursive: true, force: true })
})

test('SENDING recovers to PENDING on reopen', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-outbox-'))
  const box = new DurableOutbox({ dataDir, gatewayId: 'MG-GATEWAY-001' })
  box.enqueue({ eventId: 'crash-1', deviceId: 'S1', deviceType: 'scale', eventType: 'SCALE_READING', payload: {} })
  box.markSending('crash-1')
  const reopened = DurableOutbox.reopen({ dataDir, gatewayId: 'MG-GATEWAY-001' })
  assert.equal(reopened.listByStatus('PENDING').length, 1)
  assert.equal(reopened.listByStatus('SENDING').length, 0)
  fs.rmSync(dataDir, { recursive: true, force: true })
})
