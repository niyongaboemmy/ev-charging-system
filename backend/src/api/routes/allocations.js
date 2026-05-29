const express = require('express')
const db = require('../../db/pool')
const authenticate = require('../middleware/authenticate')
const authorize = require('../middleware/authorize')

const router = express.Router()
router.use(authenticate, authorize('admin'))

router.get('/:userId', async (req, res) => {
  const [rows] = await db.query(
    `SELECT a.id, a.user_id, a.kwh_assigned, a.kwh_used,
            (a.kwh_assigned - a.kwh_used) AS kwh_remaining,
            a.price_per_kwh, a.created_at,
            u.name, u.email
     FROM kwh_allocations a JOIN users u ON u.id = a.user_id
     WHERE a.user_id=? ORDER BY a.created_at DESC`,
    [req.params.userId],
  )
  res.json(rows)
})

router.get('/', async (req, res) => {
  const [rows] = await db.query(
    `SELECT a.id, a.user_id, a.kwh_assigned, a.kwh_used,
            (a.kwh_assigned - a.kwh_used) AS kwh_remaining,
            a.price_per_kwh, a.created_at,
            u.name, u.email
     FROM kwh_allocations a JOIN users u ON u.id = a.user_id
     ORDER BY u.name`,
  )
  res.json(rows)
})

router.post('/', async (req, res) => {
  const { user_id, kwh_assigned, price_per_kwh } = req.body
  if (!user_id || !kwh_assigned) {
    return res.status(400).json({ error: 'user_id and kwh_assigned required' })
  }

  const price = price_per_kwh || 350.00
  const totalFrw = kwh_assigned * price

  const [result] = await db.query(
    `INSERT INTO kwh_allocations (user_id, kwh_assigned, price_per_kwh) VALUES (?,?,?)`,
    [user_id, kwh_assigned, price],
  )

  await db.query(
    `INSERT INTO inventory_log (type, user_id, kwh, price_per_kwh, total_frw, note)
     VALUES ('purchase', ?, ?, ?, ?, 'Allocation top-up')`,
    [user_id, kwh_assigned, price, totalFrw],
  )

  res.status(201).json({ id: result.insertId })
})

module.exports = router
