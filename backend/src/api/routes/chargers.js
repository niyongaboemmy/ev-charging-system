const express = require('express')
const db = require('../../db/pool')
const authenticate = require('../middleware/authenticate')
const authorize = require('../middleware/authorize')
const { changeConfig, connectedChargers } = require('../../ocpp/commands')

const router = express.Router()
router.use(authenticate)

const CONFIG_COLS = `
  charger_id, display_name, location, network_type,
  server_host, server_port, tls_enabled, apn,
  heartbeat_interval, connector_count, back_office_pass, notes,
  last_seen, status_a, status_b, created_at`

// List all chargers (runtime status + config)
router.get('/', async (req, res) => {
  const [rows] = await db.query(
    `SELECT ${CONFIG_COLS} FROM charger_units ORDER BY charger_id`,
  )
  // Annotate with live connection state
  const data = rows.map((r) => ({
    ...r,
    connected: connectedChargers.has(r.charger_id),
  }))
  res.json(data)
})

// Get single charger
router.get('/:id', async (req, res) => {
  const [rows] = await db.query(
    `SELECT ${CONFIG_COLS} FROM charger_units WHERE charger_id=?`,
    [req.params.id],
  )
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  res.json({ ...rows[0], connected: connectedChargers.has(rows[0].charger_id) })
})

// Create new charger device (admin only)
router.post('/', authorize('admin'), async (req, res) => {
  const {
    charger_id, display_name, location, network_type,
    server_host, server_port, tls_enabled, apn,
    heartbeat_interval, connector_count, back_office_pass, notes,
  } = req.body

  if (!charger_id) return res.status(400).json({ error: 'charger_id is required' })

  await db.query(
    `INSERT INTO charger_units
       (charger_id, display_name, location, network_type,
        server_host, server_port, tls_enabled, apn,
        heartbeat_interval, connector_count, back_office_pass, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      charger_id.trim(),
      display_name || null,
      location || null,
      network_type || 'lan',
      server_host || null,
      server_port || 8887,
      tls_enabled ? 1 : 0,
      apn || null,
      heartbeat_interval || 60,
      connector_count || 2,
      back_office_pass || null,
      notes || null,
    ],
  )
  res.status(201).json({ ok: true })
})

// Update charger config (admin only)
router.put('/:id', authorize('admin'), async (req, res) => {
  const {
    display_name, location, network_type,
    server_host, server_port, tls_enabled, apn,
    heartbeat_interval, connector_count, back_office_pass, notes,
  } = req.body

  await db.query(
    `UPDATE charger_units SET
       display_name=?, location=?, network_type=?,
       server_host=?, server_port=?, tls_enabled=?, apn=?,
       heartbeat_interval=?, connector_count=?, back_office_pass=?, notes=?
     WHERE charger_id=?`,
    [
      display_name || null,
      location || null,
      network_type || 'lan',
      server_host || null,
      server_port || 8887,
      tls_enabled ? 1 : 0,
      apn || null,
      heartbeat_interval || 60,
      connector_count || 2,
      back_office_pass || null,
      notes || null,
      req.params.id,
    ],
  )
  res.json({ ok: true })
})

// Delete charger (admin only) — blocks if active sessions exist
router.delete('/:id', authorize('admin'), async (req, res) => {
  const [active] = await db.query(
    `SELECT id FROM sessions WHERE charger_id=? AND status='active' LIMIT 1`,
    [req.params.id],
  )
  if (active.length) {
    return res.status(409).json({ error: 'Charger has an active session — stop it first' })
  }
  await db.query(`DELETE FROM charger_units WHERE charger_id=?`, [req.params.id])
  res.json({ ok: true })
})

// Push ChangeConfiguration to a live charger
router.post('/:id/config', authorize('admin'), async (req, res) => {
  const { key, value } = req.body
  if (!key || value === undefined) {
    return res.status(400).json({ error: 'key and value required' })
  }
  try {
    const result = await changeConfig(req.params.id, key, String(value))
    res.json(result)
  } catch (err) {
    res.status(503).json({ error: err.message })
  }
})

module.exports = router
