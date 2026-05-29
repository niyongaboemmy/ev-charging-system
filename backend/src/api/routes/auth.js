const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const db = require('../../db/pool')

const router = express.Router()

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' })
  }

  const [rows] = await db.query(
    `SELECT id, name, email, password_hash, role, is_active FROM users WHERE email=?`,
    [email],
  )
  const user = rows[0]
  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

  const token = jwt.sign(
    { userId: user.id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '8h' },
  )
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
})

module.exports = router
