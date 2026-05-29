const express = require('express')
const cors = require('cors')

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/auth', require('./routes/auth'))
app.use('/api/users', require('./routes/users'))
app.use('/api/chargers', require('./routes/chargers'))
app.use('/api/sessions', require('./routes/sessions'))
app.use('/api/allocations', require('./routes/allocations'))
app.use('/api/invoices', require('./routes/invoices'))
app.use('/api/reports', require('./routes/reports'))
app.use('/api/settings', require('./routes/settings'))

// Global error handler
app.use((err, req, res, next) => {
  console.error('[API] Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

const PORT = process.env.PORT_API || 3000
app.listen(PORT, () => console.log(`[API] REST server listening on :${PORT}`))
