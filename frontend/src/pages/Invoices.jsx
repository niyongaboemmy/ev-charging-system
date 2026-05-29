import { useState, useEffect } from 'react'
import client from '../api/client'

export default function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.get('/invoices').then(({ data }) => {
      setInvoices(data)
      setLoading(false)
    })
  }, [])

  async function downloadPdf(id) {
    window.open(`/api/invoices/${id}/pdf`, '_blank')
  }

  return (
    <div>
      <h1 style={{ color: '#e2e8f0', fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Invoices</h1>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              {['Invoice #', 'Session', 'Customer', 'Operator', 'Date', 'kWh', 'Total (RWF)', ''].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} style={{ padding: 20, color: '#475569', textAlign: 'center' }}>Loading…</td></tr>
            )}
            {!loading && invoices.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 20, color: '#475569', textAlign: 'center' }}>No invoices yet</td></tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} style={{ borderBottom: '1px solid #1e293b' }}>
                <td style={tdStyle}>
                  <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>
                    #{String(inv.id).padStart(6, '0')}
                  </span>
                </td>
                <td style={tdStyle}>{inv.session_id}</td>
                <td style={tdStyle}>{inv.customer_name}</td>
                <td style={tdStyle}>{inv.operator_name}</td>
                <td style={tdStyle}>{new Date(inv.created_at).toLocaleDateString('en-RW')}</td>
                <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{parseFloat(inv.kwh).toFixed(3)}</td>
                <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{parseFloat(inv.total_frw).toLocaleString()}</td>
                <td style={tdStyle}>
                  {inv.pdf_path && (
                    <button
                      onClick={() => downloadPdf(inv.id)}
                      style={{
                        background: 'none', border: '1px solid #334155', color: '#38bdf8',
                        borderRadius: 4, padding: '4px 12px', fontSize: 11, cursor: 'pointer',
                      }}
                    >
                      PDF
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const thStyle = {
  padding: '8px 12px', textAlign: 'left', fontSize: 11,
  color: '#475569', fontWeight: 600, textTransform: 'uppercase',
}
const tdStyle = { padding: '10px 12px', fontSize: 12, color: '#94a3b8', verticalAlign: 'middle' }
