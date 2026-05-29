const express = require('express')
const bcrypt = require('bcryptjs')
const db = require('../../db/pool')
const authenticate = require('../middleware/authenticate')
const authorize = require('../middleware/authorize')

const router = express.Router()
router.use(authenticate, authorize('admin'))

router.get('/', async (req, res) => {
  const [rows] = await db.query(
    `SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC`,
  )
  res.json(rows)
})

router.post('/', async (req, res) => {
  const { name, email, password, role } = req.body
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password and role required' })
  }
  const hash = await bcrypt.hash(password, 10)
  const [result] = await db.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)`,
    [name, email, hash, role],
  )
  res.status(201).json({ id: result.insertId })
})

router.patch('/:id', async (req, res) => {
  const { name, email, role, is_active, password } = req.body
  const updates = []
  const params = []

  if (name !== undefined) { updates.push('name=?'); params.push(name) }
  if (email !== undefined) { updates.push('email=?'); params.push(email) }
  if (role !== undefined) { updates.push('role=?'); params.push(role) }
  if (is_active !== undefined) { updates.push('is_active=?'); params.push(is_active) }
  if (password) {
    updates.push('password_hash=?')
    params.push(await bcrypt.hash(password, 10))
  }

  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' })

  params.push(req.params.id)
  await db.query(`UPDATE users SET ${updates.join(',')} WHERE id=?`, params)
  res.json({ ok: true })
})

module.exports = router
