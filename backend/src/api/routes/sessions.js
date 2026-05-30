const express = require('express')
const db = require('../../db/pool')
const authenticate = require('../middleware/authenticate')
const { remoteStart, remoteStop } = require('../../ocpp/commands')

const router = express.Router()

// Public: live session data for dashboard / QR polling
router.get('/live/:chargerId/:connector', async (req, res) => {
  const connector = req.params.connector.toUpperCase()
  const [rows] = await db.query(
    `SELECT s.id, s.kwh_consumed, s.total_frw, s.price_per_kwh,
            s.start_time, s.status, s.budget_frw, s.transaction_id,
            u.name AS operator_name
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.charger_id=? AND s.connector=? AND s.status='active'
     ORDER BY s.start_time DESC LIMIT 1`,
    [req.params.chargerId, connector],
  )
  if (!rows.length) return res.json(null)
  const s = rows[0]
  const elapsed = s.start_time
    ? Math.floor((Date.now() - new Date(s.start_time).getTime()) / 1000)
    : 0
  res.json({ ...s, elapsed_seconds: elapsed })
})

router.use(authenticate)

// List sessions — admin/accountant see all, agents see own
router.get('/', async (req, res) => {
  const { start, end, user_id, charger_id, status, page = 1, limit = 50 } = req.query
  const conditions = []
  const params = []

  if (req.user.role === 'agent') {
    conditions.push('s.user_id=?')
    params.push(req.user.userId)
  } else if (user_id) {
    conditions.push('s.user_id=?')
    params.push(user_id)
  }
  if (charger_id) { conditions.push('s.charger_id=?'); params.push(charger_id) }
  if (status) { conditions.push('s.status=?'); params.push(status) }
  if (start) { conditions.push('s.start_time >= ?'); params.push(start) }
  if (end) { conditions.push('s.start_time <= ?'); params.push(end) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const offset = (parseInt(page) - 1) * parseInt(limit)
  params.push(parseInt(limit), offset)

  const [rows] = await db.query(
    `SELECT s.id, s.charger_id, s.connector, s.status,
            s.kwh_consumed, s.total_frw, s.price_per_kwh,
            s.start_time, s.end_time, s.transaction_id,
            u.name AS operator_name
     FROM sessions s JOIN users u ON u.id = s.user_id
     ${where}
     ORDER BY s.start_time DESC
     LIMIT ? OFFSET ?`,
    params,
  )

  const countParams = params.slice(0, -2)
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM sessions s ${where}`,
    countParams,
  )
  res.json({ rows, total, page: parseInt(page), limit: parseInt(limit) })
})

router.get('/:id', async (req, res) => {
  const [rows] = await db.query(
    `SELECT s.*, u.name AS operator_name FROM sessions s
     JOIN users u ON u.id = s.user_id WHERE s.id=?`,
    [req.params.id],
  )
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  if (req.user.role === 'agent' && rows[0].user_id !== req.user.userId) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  res.json(rows[0])
})

// Start a session
router.post('/start', async (req, res) => {
  const { charger_id, connector_id, user_id, budget_frw } = req.body
  if (!charger_id || !connector_id || !user_id) {
    return res.status(400).json({ error: 'charger_id, connector_id and user_id required' })
  }

  const [alloc] = await db.query(
    `SELECT price_per_kwh, (kwh_assigned - kwh_used) AS remaining
     FROM kwh_allocations WHERE user_id=?`,
    [user_id],
  )
  if (!alloc.length || alloc[0].remaining <= 0) {
    return res.status(402).json({ error: 'Insufficient kWh quota' })
  }

  // Build idTag in AGT-{userId}-S{sessionRef} format (max 20 chars)
  const ref = String(Date.now()).slice(-4)
  const idTag = `AGT-${user_id}-S${ref}`.slice(0, 20)

  try {
    const result = await remoteStart(charger_id, parseInt(connector_id), idTag)
    if (result?.status !== 'Accepted') {
      return res.status(503).json({ error: 'Charger rejected start command', detail: result })
    }

    // Session row will be created by StartTransaction OCPP handler
    // Store budget if provided — update once transaction id is known via a brief poll
    res.json({ ok: true, idTag, charger_status: result.status })
  } catch (err) {
    res.status(503).json({ error: err.message })
  }
})

// Force-close a stuck session when the charger is offline
// Writes the DB directly — no OCPP connection required. Admin only.
router.post('/:id/force-close', async (req, res) => {
  const authorize = require('../middleware/authorize')
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' })
  }

  const [rows] = await db.query(
    `SELECT s.*, u.name AS operator_name FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id=? AND s.status='active'`,
    [req.params.id],
  )
  if (!rows.length) {
    return res.status(404).json({ error: 'Active session not found' })
  }

  const session = rows[0]
  const finalKwh = parseFloat(session.kwh_consumed) || 0
  const totalFrw = finalKwh * parseFloat(session.price_per_kwh)

  await db.query(
    `UPDATE sessions SET status='completed', end_time=NOW(),
     kwh_consumed=?, total_frw=? WHERE id=?`,
    [finalKwh, totalFrw, session.id],
  )

  if (finalKwh > 0) {
    await db.query(
      `UPDATE kwh_allocations SET kwh_used = kwh_used + ? WHERE user_id=?`,
      [finalKwh, session.user_id],
    )
    await db.query(
      `INSERT INTO inventory_log (type, user_id, session_id, kwh, price_per_kwh, total_frw, note)
       VALUES ('sale',?,?,?,?,?,'Force-closed by admin (charger offline)')`,
      [session.user_id, session.id, finalKwh, session.price_per_kwh, totalFrw],
    )
  }

  const { emit } = require('../../ocpp/events')
  emit('StopTransaction', {
    chargerId: session.charger_id,
    sessionId: session.id,
    connector: session.connector,
    kwh: finalKwh,
    totalFrw,
    operatorName: session.operator_name,
    reason: 'ForceClose',
    summary: `Session #${session.id} force-closed by admin — ${finalKwh.toFixed(3)} kWh — ${Math.round(totalFrw).toLocaleString()} RWF`,
  })

  res.json({ ok: true, kwh: finalKwh, total_frw: totalFrw })
})

// Stop a session
router.post('/stop', async (req, res) => {
  const { session_id, transaction_id, charger_id } = req.body
  if (!transaction_id || !charger_id) {
    return res.status(400).json({ error: 'transaction_id and charger_id required' })
  }

  try {
    const result = await remoteStop(charger_id, parseInt(transaction_id))
    res.json({ ok: true, charger_status: result })
  } catch (err) {
    res.status(503).json({ error: err.message })
  }
})

module.exports = router
