const { EventEmitter } = require('events')

const ocppEvents = new EventEmitter()
ocppEvents.setMaxListeners(200) // support many concurrent SSE clients

/**
 * Emit a structured event. All consumers (SSE clients) receive identical payloads.
 *
 * @param {string} type   - event type key (e.g. 'BootNotification', 'connected')
 * @param {object} data   - arbitrary context; always includes chargerId + ts
 */
function emit(type, data) {
  ocppEvents.emit('event', {
    type,
    ts: new Date().toISOString(),
    ...data,
  })
}

module.exports = { ocppEvents, emit }
