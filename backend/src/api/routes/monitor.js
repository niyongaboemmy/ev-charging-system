const express = require('express')
const { ocppEvents } = require('../../ocpp/events')
const { connectedChargers } = require('../../ocpp/commands')
const authenticate = require('../middleware/authenticate')

const router = express.Router()
router.use(authenticate)

// GET /api/monitor/stream  — Server-Sent Events, one event per OCPP action
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection',    'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // disable Nginx buffering in production
  res.flushHeaders()

  // Keep-alive ping every 25s (prevents proxy/browser timeouts)
  const ping = setInterval(() => res.write(': ping\n\n'), 25000)

  function send(data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  // Send current connected chargers immediately on connect
  send({
    type: 'init',
    connectedChargers: [...connectedChargers.keys()],
    ts: new Date().toISOString(),
    summary: 'Monitor connected',
  })

  function onEvent(data) { send(data) }

  ocppEvents.on('event', onEvent)

  req.on('close', () => {
    clearInterval(ping)
    ocppEvents.off('event', onEvent)
  })
})

// GET /api/monitor/status — snapshot of current state (for initial page load)
router.get('/status', async (req, res) => {
  const db = require('../../db/pool')
  const [chargers] = await db.query(
    `SELECT charger_id, display_name, location, status_a, status_b, last_seen
     FROM charger_units ORDER BY charger_id`,
  )
  const [activeSessions] = await db.query(
    `SELECT s.id, s.charger_id, s.connector, s.transaction_id,
            s.kwh_consumed, s.total_frw, s.price_per_kwh, s.budget_frw, s.start_time,
            u.name AS operator_name
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.status='active'`,
  )
  res.json({
    chargers: chargers.map(c => ({
      ...c,
      connected: connectedChargers.has(c.charger_id),
    })),
    activeSessions,
    connectedCount: connectedChargers.size,
  })
})

module.exports = router
