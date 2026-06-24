const { EventEmitter } = require('events')
const { publish, subscribe } = require('./sharedCoordination')

const bus = new EventEmitter()
bus.setMaxListeners(200)
const INSTANCE_ID = `${process.pid}-${Math.random().toString(36).slice(2)}`
const REALTIME_CHANNEL = 'realtime-events'
let sharedSubscriptionStarted = false

function startSharedRealtimeSubscription() {
  if (sharedSubscriptionStarted) return
  sharedSubscriptionStarted = true
  subscribe(REALTIME_CHANNEL, (message = {}) => {
    if (message.origin === INSTANCE_ID) return
    if (message.event) bus.emit('event', message.event)
  }).catch((err) => {
    console.warn('[realtimeBus] shared subscription unavailable', err.message)
  })
}

const publishRealtimeEvent = (payload = {}) => {
  const event = {
    type: String(payload.type || '').trim() || 'unknown',
    tenant: String(payload.tenant || '').trim().toLowerCase() || 'default',
    time: new Date().toISOString(),
    data: payload.data || {},
  }
  bus.emit('event', event)
  startSharedRealtimeSubscription()
  publish(REALTIME_CHANNEL, { origin: INSTANCE_ID, event }).catch((err) => {
    console.warn('[realtimeBus] shared publish unavailable', err.message)
  })
}

startSharedRealtimeSubscription()

module.exports = {
  bus,
  publishRealtimeEvent,
  startSharedRealtimeSubscription,
}
