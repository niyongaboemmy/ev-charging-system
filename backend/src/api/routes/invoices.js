const express = require('express')
const path = require('path')
const fs = require('fs')
const PDFDocument = require('pdfkit')
const db = require('../../db/pool')
const authenticate = require('../middleware/authenticate')

const router = express.Router()
router.use(authenticate)

const INVOICES_DIR = path.join(__dirname, '../../../../uploads/invoices')
if (!fs.existsSync(INVOICES_DIR)) fs.mkdirSync(INVOICES_DIR, { recursive: true })

function generatePdf(invoice, session, operator) {
  return new Promise((resolve, reject) => {
    const filename = `invoice-${invoice.id}-${Date.now()}.pdf`
    const filepath = path.join(INVOICES_DIR, filename)
    const doc = new PDFDocument({ margin: 50 })
    const stream = fs.createWriteStream(filepath)

    doc.pipe(stream)

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('SIMPLE CHARGE', { align: 'center' })
    doc.fontSize(10).font('Helvetica').text('Kigali, Rwanda', { align: 'center' })
    doc.moveDown()
    doc.fontSize(16).font('Helvetica-Bold').text('CHARGING INVOICE', { align: 'center' })
    doc.moveDown()

    // Invoice details
    doc.fontSize(11).font('Helvetica')
    doc.text(`Invoice #: ${String(invoice.id).padStart(6, '0')}`)
    doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString('en-RW')}`)
    doc.text(`Session ID: ${session.id}`)
    doc.text(`Operator: ${operator}`)
    doc.text(`Customer: ${invoice.customer_name}`)
    doc.moveDown()

    // Session details
    doc.font('Helvetica-Bold').text('Charging Details')
    doc.font('Helvetica')
    doc.text(`Charger: ${session.charger_id}  |  Gun ${session.connector}`)
    doc.text(`Start: ${new Date(session.start_time).toLocaleString('en-RW')}`)
    doc.text(`End:   ${new Date(session.end_time).toLocaleString('en-RW')}`)
    doc.moveDown()

    // Amount table
    doc.font('Helvetica-Bold').text('Summary')
    doc.font('Helvetica')
    doc.text(`Energy Consumed: ${parseFloat(invoice.kwh).toFixed(3)} kWh`)
    doc.text(`Price per kWh:   ${parseFloat(invoice.price_per_kwh).toFixed(2)} RWF`)
    doc.moveDown()
    doc.font('Helvetica-Bold').fontSize(14)
    doc.text(`TOTAL:  ${parseFloat(invoice.total_frw).toLocaleString('en-RW')} RWF`)

    doc.moveDown(2)
    doc.fontSize(9).font('Helvetica').fillColor('grey')
    doc.text('Thank you for charging with Simple Charge.', { align: 'center' })

    doc.end()
    stream.on('finish', () => resolve(filename))
    stream.on('error', reject)
  })
}

router.post('/', async (req, res) => {
  const { session_id, customer_name } = req.body
  if (!session_id) return res.status(400).json({ error: 'session_id required' })

  const [sessions] = await db.query(
    `SELECT s.*, u.name AS operator_name FROM sessions s
     JOIN users u ON u.id = s.user_id WHERE s.id=?`,
    [session_id],
  )
  if (!sessions.length) return res.status(404).json({ error: 'Session not found' })
  const session = sessions[0]
  if (session.status !== 'completed') {
    return res.status(400).json({ error: 'Session must be completed before invoicing' })
  }

  // Upsert invoice
  const [existing] = await db.query(`SELECT id FROM invoices WHERE session_id=?`, [session_id])
  let invoiceId

  if (existing.length) {
    invoiceId = existing[0].id
  } else {
    const [result] = await db.query(
      `INSERT INTO invoices (session_id, user_id, customer_name, kwh, price_per_kwh, total_frw)
       VALUES (?,?,?,?,?,?)`,
      [
        session_id,
        session.user_id,
        customer_name || 'Walk-in Customer',
        session.kwh_consumed,
        session.price_per_kwh,
        session.total_frw,
      ],
    )
    invoiceId = result.insertId
  }

  const [invRows] = await db.query(`SELECT * FROM invoices WHERE id=?`, [invoiceId])
  const invoice = invRows[0]

  const pdfFilename = await generatePdf(invoice, session, session.operator_name)
  await db.query(`UPDATE invoices SET pdf_path=? WHERE id=?`, [pdfFilename, invoiceId])

  res.status(201).json({ id: invoiceId, pdf_path: pdfFilename })
})

router.get('/', async (req, res) => {
  const conditions = []
  const params = []

  if (req.user.role === 'agent') {
    conditions.push('i.user_id=?')
    params.push(req.user.userId)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const [rows] = await db.query(
    `SELECT i.id, i.session_id, i.customer_name, i.kwh, i.price_per_kwh,
            i.total_frw, i.pdf_path, i.created_at, u.name AS operator_name
     FROM invoices i JOIN users u ON u.id = i.user_id
     ${where}
     ORDER BY i.created_at DESC`,
    params,
  )
  res.json(rows)
})

router.get('/:id', async (req, res) => {
  const [rows] = await db.query(
    `SELECT i.*, u.name AS operator_name FROM invoices i
     JOIN users u ON u.id = i.user_id WHERE i.id=?`,
    [req.params.id],
  )
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  if (req.user.role === 'agent' && rows[0].user_id !== req.user.userId) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  res.json(rows[0])
})

// Download PDF
router.get('/:id/pdf', async (req, res) => {
  const [rows] = await db.query(`SELECT pdf_path FROM invoices WHERE id=?`, [req.params.id])
  if (!rows.length || !rows[0].pdf_path) {
    return res.status(404).json({ error: 'PDF not found' })
  }
  const filepath = path.join(INVOICES_DIR, rows[0].pdf_path)
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'PDF file missing' })
  res.download(filepath, rows[0].pdf_path)
})

module.exports = router
