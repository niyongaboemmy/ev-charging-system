const mysql = require('mysql2/promise')

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'evcsims',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
}
if (process.env.DB_SOCKET) config.socketPath = process.env.DB_SOCKET

const pool = mysql.createPool(config)

module.exports = pool
