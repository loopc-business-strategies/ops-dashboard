const { EventEmitter } = require('events')

const bus = new EventEmitter()
bus.setMaxListeners(200)

const publishRealtimeEvent = (payload = {}) => {
  const event = {
    type: String(payload.type || '').trim() || 'unknown',
    tenant: String(payload.tenant || '').trim().toLowerCase() || 'default',
    time: new Date().toISOString(),
    data: payload.data || {},
  }
  bus.emit('event', event)
}

module.exports = {
  bus,
  publishRealtimeEvent,
}
