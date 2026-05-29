const WebSocket = require('ws')
const db = require('../db/pool')
const handlers = require('./handlers')
const { connectedChargers } = require('./commands')

const wss = new WebSocket.Server({ port: process.env.PORT_OCPP || 8887 })

wss.on('connection', (ws, req) => {
  const parts = req.url.split('/')
  const chargerId = parts[parts.length - 1]

  const proto = req.headers['sec-websocket-protocol'] || ''
  if (!proto.includes('ocpp1.6')) {
    ws.close(1002, 'Unsupported protocol')
    return
  }

  connectedChargers.set(chargerId, ws)
  console.log(`[OCPP] Connected: ${chargerId}`)

  ws.on('message', async (raw) => {
    let msg
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }

    const [type, uid, action, payload] = msg
    if (type !== 2) return

    const respond = (body) => {
      ws.send(JSON.stringify([3, uid, body]))
    }

    try {
      switch (action) {
        case 'BootNotification':
          await handlers.bootNotification(chargerId, payload, respond)
          break
        case 'Heartbeat':
          await handlers.heartbeat(chargerId, respond)
          break
        case 'StatusNotification':
          await handlers.statusNotification(chargerId, payload, respond)
          break
        case 'Authorize':
          await handlers.authorize(chargerId, payload, respond)
          break
        case 'StartTransaction':
          await handlers.startTransaction(chargerId, payload, respond)
          break
        case 'StopTransaction':
          await handlers.stopTransaction(chargerId, payload, respond)
          break
        case 'MeterValues':
          await handlers.meterValues(chargerId, payload, respond)
          break
        default:
          respond({})
      }
    } catch (err) {
      console.error(`[OCPP] Handler error on ${chargerId}/${action}:`, err)
      respond({})
    }
  })

  ws.on('close', async () => {
    connectedChargers.delete(chargerId)
    await db.query(
      `UPDATE charger_units SET status_a='Unavailable', status_b='Unavailable' WHERE charger_id=?`,
      [chargerId],
    )
    console.log(`[OCPP] Disconnected: ${chargerId}`)
  })

  ws.on('error', (err) =>
    console.error(`[OCPP] Error (${chargerId}):`, err.message),
  )
})

console.log(`[OCPP] WebSocket server listening on :${process.env.PORT_OCPP || 8887}`)
