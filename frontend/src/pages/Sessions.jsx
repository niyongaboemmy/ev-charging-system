import { useState, useEffect, useCallback } from 'react'
import SessionRow from '../components/SessionRow'
import client from '../api/client'

export default function Sessions() {
  const [sessions, setSessions] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ start: '', end: '', charger_id: '', status: '' })
  const [loading, setLoading] = useState(false)
  const [invoiceModal, setInvoiceModal] = useState(null)
  const [customerName, setCustomerName] = useState('')
  const [invoiceLoading, setInvoiceLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page, limit: 50 })
    if (filters.start) params.set('start', filters.start)
    if (filters.end) params.set('end', filters.end)
    if (filters.charger_id) params.set('charger_id', filters.charger_id)
    if (filters.status) params.set('status', filters.status)
    const { data } = await client.get(`/sessions?${params}`)
    setSessions(data.rows)
    setTotal(data.total)
    setLoading(false)
  }, [page, filters])

  useEffect(() => { load() }, [load])

  async function handlePrintInvoice(session) {
    setInvoiceModal(session)
    setCustomerName('')
  }

  async function createInvoice() {
    setInvoiceLoading(true)
    try {
      const { data } = await client.post('/invoices', {
        session_id: invoiceModal.id,
        customer_name: customerName || 'Walk-in Customer',
      })
      window.open(`/api/invoices/${data.id}/pdf`, '_blank')
      setInvoiceModal(null)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create invoice')
    } finally {
      setInvoiceLoading(false)
    }
  }

  const LIMIT = 50
  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div>
      <h1 style={h1}>Charging Sessions</h1>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: 'start', label: 'From', type: 'date' },
          { key: 'end', label: 'To', type: 'date' },
        ].map(({ key, label, type }) => (
          <div key={key}>
            <label style={labelStyle}>{label}</label>
            <input
              type={type}
              value={filters[key]}
              onChange={(e) => { setFilters((f) => ({ ...f, [key]: e.target.value })); setPage(1) }}
              style={inputStyle}
            />
          </div>
        ))}
        <div>
          <label style={labelStyle}>Charger</label>
          <input
            value={filters.charger_id}
            onChange={(e) => { setFilters((f) => ({ ...f, charger_id: e.target.value })); setPage(1) }}
            placeholder="KIGALI-DC160-001"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select
            value={filters.status}
            onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1) }}
            style={inputStyle}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="faulted">Faulted</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              {['ID', 'Charger', 'Gun', 'Operator', 'Start', 'End', 'kWh', 'FRW', 'Status', ''].map((h) => (
                <th key={h} style={{
                  padding: '8px 12px', textAlign: 'left', fontSize: 11,
                  color: '#475569', fontWeight: 600, textTransform: 'uppercase',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={10} style={{ padding: 20, color: '#475569', textAlign: 'center' }}>Loading…</td></tr>
            )}
            {!loading && sessions.length === 0 && (
              <tr><td colSpan={10} style={{ padding: 20, color: '#475569', textAlign: 'center' }}>No sessions found</td></tr>
            )}
            {sessions.map((s) => (
              <SessionRow key={s.id} session={s} onPrintInvoice={handlePrintInvoice} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={pageBtn}>‹</button>
          <span style={{ color: '#64748b', fontSize: 12 }}>Page {page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pageBtn}>›</button>
        </div>
      )}

      {/* Invoice modal */}
      {invoiceModal && (
        <div style={overlay}>
          <div style={modal}>
            <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>Generate Invoice — Session #{invoiceModal.id}</h3>
            <label style={labelStyle}>Customer Name</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Walk-in Customer"
              style={{ ...inputStyle, width: '100%', marginBottom: 20 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={createInvoice} disabled={invoiceLoading} style={primaryBtn}>
                {invoiceLoading ? 'Generating…' : 'Generate & Download PDF'}
              </button>
              <button onClick={() => setInvoiceModal(null)} style={cancelBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const h1 = { color: '#e2e8f0', fontSize: 22, fontWeight: 700, marginBottom: 20 }
const labelStyle = { display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }
const inputStyle = {
  padding: '7px 12px', background: '#111827', border: '1px solid #334155',
  borderRadius: 4, color: '#e2e8f0', fontSize: 12,
}
const pageBtn = {
  background: '#1e293b', border: '1px solid #334155', color: '#94a3b8',
  borderRadius: 4, padding: '4px 12px', cursor: 'pointer',
}
const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
}
const modal = {
  background: '#1e293b', borderRadius: 12, padding: 28,
  width: 400, border: '1px solid #334155',
}
const primaryBtn = {
  flex: 1, background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 4,
  padding: '9px 0', fontSize: 13, cursor: 'pointer', fontWeight: 600,
}
const cancelBtn = {
  flex: 1, background: 'none', color: '#94a3b8', border: '1px solid #334155',
  borderRadius: 4, padding: '9px 0', fontSize: 13, cursor: 'pointer',
}
