require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const bcrypt = require('bcryptjs')
const pool = require('./pool')

async function seed() {
  const hash = await bcrypt.hash('Admin@1234', 10)
  await pool.query(
    `INSERT IGNORE INTO users (name, email, password_hash, role)
     VALUES (?, ?, ?, 'admin')`,
    ['Admin', 'admin@simplecharge.rw', hash],
  )
  console.log('[SEED] Admin user upserted: admin@simplecharge.rw / Admin@1234')
  await pool.end()
}

seed().catch((err) => {
  console.error('[SEED] Error:', err.message)
  process.exit(1)
})
