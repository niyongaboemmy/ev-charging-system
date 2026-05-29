const express = require('express')
const db = require('../../db/pool')
const authenticate = require('../middleware/authenticate')
const authorize = require('../middleware/authorize')

const router = express.Router()
router.use(authenticate, authorize('admin', 'accountant'))

// Monthly sales: ?year=2026&month=5&user_id=1
router.get('/monthly', async (req, res) => {
  const { year, month, user_id } = req.query
  if (!year || !month) {
    return res.status(400).json({ error: 'year and month required' })
  }

  const conditions = [
    `YEAR(s.start_time) = ?`,
    `MONTH(s.start_time) = ?`,
    `s.status = 'completed'`,
  ]
  const params = [parseInt(year), parseInt(month)]

  if (user_id) { conditions.push('s.user_id = ?'); params.push(user_id) }

  const where = `WHERE ${conditions.join(' AND ')}`

  const [summary] = await db.query(
    `SELECT
       COUNT(*) AS session_count,
       COALESCE(SUM(s.kwh_consumed), 0) AS total_kwh,
       COALESCE(SUM(s.total_frw), 0)    AS total_frw
     FROM sessions s ${where}`,
    params,
  )

  const [byAgent] = await db.query(
    `SELECT u.id AS user_id, u.name,
       COUNT(*) AS session_count,
       COALESCE(SUM(s.kwh_consumed), 0) AS kwh,
       COALESCE(SUM(s.total_frw), 0)    AS frw
     FROM sessions s JOIN users u ON u.id = s.user_id
     ${where}
     GROUP BY u.id ORDER BY frw DESC`,
    params,
  )

  const [byDay] = await db.query(
    `SELECT DAY(s.start_time) AS day,
       COUNT(*) AS session_count,
       COALESCE(SUM(s.kwh_consumed), 0) AS kwh,
       COALESCE(SUM(s.total_frw), 0) AS frw
     FROM sessions s ${where}
     GROUP BY DAY(s.start_time) ORDER BY day`,
    params,
  )

  res.json({ summary: summary[0], by_agent: byAgent, by_day: byDay })
})

// Inventory summary
router.get('/inventory', async (req, res) => {
  const [[purchased]] = await db.query(
    `SELECT COALESCE(SUM(kwh), 0) AS total_kwh, COALESCE(SUM(total_frw), 0) AS total_frw
     FROM inventory_log WHERE type='purchase'`,
  )
  const [[sold]] = await db.query(
    `SELECT COALESCE(SUM(kwh), 0) AS total_kwh, COALESCE(SUM(total_frw), 0) AS total_frw
     FROM inventory_log WHERE type='sale'`,
  )
  const remaining_kwh = parseFloat(purchased.total_kwh) - parseFloat(sold.total_kwh)

  const [[avgPrice]] = await db.query(
    `SELECT COALESCE(AVG(price_per_kwh), 350) AS avg_price FROM inventory_log WHERE type='purchase'`,
  )
  const remaining_frw = remaining_kwh * parseFloat(avgPrice.avg_price)

  const [log] = await db.query(
    `SELECT il.*, u.name AS user_name FROM inventory_log il
     LEFT JOIN users u ON u.id = il.user_id
     ORDER BY il.created_at DESC LIMIT 100`,
  )

  res.json({
    purchased: { kwh: purchased.total_kwh, frw: purchased.total_frw },
    sold: { kwh: sold.total_kwh, frw: sold.total_frw },
    remaining: { kwh: remaining_kwh, frw: remaining_frw },
    log,
  })
})

module.exports = router
