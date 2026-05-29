import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import client from '../api/client'

export default function Reports() {
  const [tab, setTab] = useState('monthly')
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [userId, setUserId] = useState('')
  const [users, setUsers] = useState([])
  const [monthly, setMonthly] = useState(null)
  const [inventory, setInventory] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    client.get('/users').then(({ data }) => setUsers(data))
    loadInventory()
  }, [])

  useEffect(() => {
    if (tab === 'monthly') loadMonthly()
  }, [tab, year, month, userId])

  async function loadMonthly() {
    setLoading(true)
    const params = new URLSearchParams({ year, month })
    if (userId) params.set('user_id', userId)
    try {
      const { data } = await client.get(`/reports/monthly?${params}`)
      setMonthly(data)
    } catch (_) {}
    setLoading(false)
  }

  async function loadInventory() {
    const { data } = await client.get('/reports/inventory')
    setInventory(data)
  }

  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ]

  const chartData = monthly?.by_day?.map((d) => ({
    day: `Day ${d.day}`,
    kWh: parseFloat(d.kwh).toFixed(2),
    Sessions: d.session_count,
    RWF: parseFloat(d.frw).toFixed(0),
  })) || []

  return (
    <div>
      <h1 style={{ color: '#e2e8f0', fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Reports</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 28, borderBottom: '1px solid #1e293b' }}>
        {['monthly', 'inventory'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 24px', background: 'none', border: 'none',
              borderBottom: tab === t ? '2px solid #38bdf8' : '2px solid transparent',
              color: tab === t ? '#38bdf8' : '#64748b', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, textTransform: 'capitalize',
            }}
          >
            {t === 'monthly' ? 'Monthly Sales' : 'Inventory'}
          </button>
        ))}
      </div>

      {tab === 'monthly' && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 28, alignItems: 'flex-end' }}>
            <div>
              <label style={labelStyle}>Year</label>
              <select value={year} onChange={(e) => setYear(e.target.value)} style={inputStyle}>
                {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Month</label>
              <select value={month} onChange={(e) => setMonth(e.target.value)} style={inputStyle}>
                {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Agent (optional)</label>
              <select value={userId} onChange={(e) => setUserId(e.target.value)} style={inputStyle}>
                <option value="">All agents</option>
                {users.filter((u) => u.role === 'agent').map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          {loading && <div style={{ color: '#475569' }}>Loading…</div>}

          {monthly && !loading && (
            <>
              {/* Summary cards */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
                {[
                  { label: 'Total Sessions', value: monthly.summary.session_count },
                  { label: 'Energy Sold', value: `${parseFloat(monthly.summary.total_kwh).toFixed(2)} kWh` },
                  { label: 'Revenue', value: `${parseFloat(monthly.summary.total_frw).toLocaleString()} RWF` },
                ].map((m) => (
                  <div key={m.label} style={{
                    flex: 1, background: '#111827', border: '1px solid #1e293b',
                    borderRadius: 10, padding: '16px 20px',
                  }}>
                    <div style={{ fontSize: 11, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                      {m.label}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: '#38bdf8' }}>
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bar chart — daily */}
              {chartData.length > 0 && (
                <div style={{ background: '#111827', borderRadius: 10, padding: '20px 16px', marginBottom: 28 }}>
                  <div style={{ color: '#64748b', fontSize: 12, marginBottom: 16 }}>
                    Daily Energy (kWh) · {months[month - 1]} {year}
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6 }}
                        labelStyle={{ color: '#e2e8f0' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="kWh" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Sessions" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Per-agent breakdown */}
              {monthly.by_agent.length > 0 && (
                <div>
                  <div style={{ color: '#64748b', fontSize: 12, marginBottom: 12 }}>Per Agent Breakdown</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1e293b' }}>
                        {['Agent', 'Sessions', 'kWh', 'Revenue (RWF)'].map((h) => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {monthly.by_agent.map((a) => (
                        <tr key={a.user_id} style={{ borderBottom: '1px solid #1e293b' }}>
                          <td style={tdStyle}>{a.name}</td>
                          <td style={tdStyle}>{a.session_count}</td>
                          <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{parseFloat(a.kwh).toFixed(3)}</td>
                          <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{parseFloat(a.frw).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'inventory' && inventory && (
        <div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
            {[
              { label: 'Total Purchased', value: `${parseFloat(inventory.purchased.kwh).toFixed(3)} kWh`, sub: `${parseFloat(inventory.purchased.frw).toLocaleString()} RWF` },
              { label: 'Total Sold', value: `${parseFloat(inventory.sold.kwh).toFixed(3)} kWh`, sub: `${parseFloat(inventory.sold.frw).toLocaleString()} RWF` },
              { label: 'Remaining Stock', value: `${parseFloat(inventory.remaining.kwh).toFixed(3)} kWh`, sub: `${parseFloat(inventory.remaining.frw).toLocaleString()} RWF` },
            ].map((m) => (
              <div key={m.label} style={{
                flex: 1, background: '#111827', border: '1px solid #1e293b',
                borderRadius: 10, padding: '16px 20px',
              }}>
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: '#38bdf8' }}>
                  {m.value}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{m.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ color: '#64748b', fontSize: 12, marginBottom: 12 }}>Recent Transactions</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b' }}>
                {['Type', 'User', 'kWh', 'Price/kWh', 'Total (RWF)', 'Note', 'Date'].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inventory.log.map((row) => (
                <tr key={row.id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={tdStyle}>
                    <span style={{
                      color: row.type === 'purchase' ? '#22c55e' : '#f59e0b',
                      fontWeight: 600, fontSize: 11,
                    }}>
                      {row.type}
                    </span>
                  </td>
                  <td style={tdStyle}>{row.user_name || '—'}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{parseFloat(row.kwh).toFixed(3)}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{parseFloat(row.price_per_kwh).toFixed(2)}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{parseFloat(row.total_frw).toLocaleString()}</td>
                  <td style={tdStyle}>{row.note || '—'}</td>
                  <td style={tdStyle}>{new Date(row.created_at).toLocaleDateString('en-RW')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }
const inputStyle = {
  padding: '7px 12px', background: '#111827', border: '1px solid #334155',
  borderRadius: 4, color: '#e2e8f0', fontSize: 12,
}
const thStyle = {
  padding: '8px 12px', textAlign: 'left', fontSize: 11,
  color: '#475569', fontWeight: 600, textTransform: 'uppercase',
}
const tdStyle = { padding: '10px 12px', fontSize: 12, color: '#94a3b8', verticalAlign: 'middle' }
