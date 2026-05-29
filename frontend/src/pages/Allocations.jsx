import { useState, useEffect } from 'react'
import client from '../api/client'

export default function Allocations() {
  const [allocations, setAllocations] = useState([])
  const [users, setUsers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ user_id: '', kwh_assigned: '', price_per_kwh: '350' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const [{ data: allocs }, { data: usrs }] = await Promise.all([
      client.get('/allocations'),
      client.get('/users'),
    ])
    setAllocations(allocs)
    setUsers(usrs.filter((u) => u.role === 'agent'))
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await client.post('/allocations', form)
      setForm({ user_id: '', kwh_assigned: '', price_per_kwh: '350' })
      setShowForm(false)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create allocation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ color: '#e2e8f0', fontSize: 22, fontWeight: 700 }}>kWh Allocations</h1>
        <button
          onClick={() => setShowForm(true)}
          style={{ background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
        >
          + Add Allocation
        </button>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {allocations.map((a) => {
          const pct = a.kwh_assigned > 0
            ? Math.min(100, (a.kwh_used / a.kwh_assigned) * 100)
            : 0
          return (
            <div key={a.id} style={{
              background: '#111827', border: '1px solid #1e293b',
              borderRadius: 10, padding: '20px 24px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{a.name}</div>
                  <div style={{ color: '#475569', fontSize: 12 }}>{a.email}</div>
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                  <div style={{ color: '#38bdf8', fontSize: 16, fontWeight: 700 }}>
                    {parseFloat(a.kwh_remaining).toFixed(3)} kWh left
                  </div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>
                    {parseFloat(a.price_per_kwh).toFixed(0)} RWF/kWh
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ background: '#1e293b', borderRadius: 4, height: 6, marginBottom: 8 }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  width: `${pct}%`,
                  background: pct > 90 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#22c55e',
                  transition: 'width .3s',
                }} />
              </div>

              <div style={{ display: 'flex', gap: 24, fontSize: 11, color: '#64748b' }}>
                <span>Assigned: <strong style={{ color: '#94a3b8' }}>{parseFloat(a.kwh_assigned).toFixed(3)} kWh</strong></span>
                <span>Used: <strong style={{ color: '#94a3b8' }}>{parseFloat(a.kwh_used).toFixed(3)} kWh</strong></span>
                <span>Value remaining: <strong style={{ color: '#94a3b8' }}>
                  {(parseFloat(a.kwh_remaining) * parseFloat(a.price_per_kwh)).toLocaleString()} RWF
                </strong></span>
              </div>
            </div>
          )
        })}
        {allocations.length === 0 && (
          <div style={{ color: '#475569', textAlign: 'center', padding: 40 }}>
            No allocations yet. Add one to give an agent charging quota.
          </div>
        )}
      </div>

      {showForm && (
        <div style={overlay}>
          <div style={modal}>
            <h3 style={{ color: '#e2e8f0', marginBottom: 20 }}>Add Allocation</h3>
            <form onSubmit={handleCreate}>
              <label style={labelStyle}>Agent</label>
              <select
                value={form.user_id}
                onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}
                required
                style={{ ...inputStyle, width: '100%', marginBottom: 14 }}
              >
                <option value="">— Select agent —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>

              <label style={labelStyle}>kWh to Allocate</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={form.kwh_assigned}
                onChange={(e) => setForm((f) => ({ ...f, kwh_assigned: e.target.value }))}
                required
                style={{ ...inputStyle, width: '100%', marginBottom: 14 }}
              />

              <label style={labelStyle}>Price per kWh (RWF)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.price_per_kwh}
                onChange={(e) => setForm((f) => ({ ...f, price_per_kwh: e.target.value }))}
                required
                style={{ ...inputStyle, width: '100%', marginBottom: 20 }}
              />

              {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={loading} style={primaryBtn}>
                  {loading ? 'Saving…' : 'Allocate kWh'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} style={cancelBtn}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }
const inputStyle = {
  padding: '8px 12px', background: '#0f1623', border: '1px solid #334155',
  borderRadius: 4, color: '#e2e8f0', fontSize: 13,
}
const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
}
const modal = {
  background: '#1e293b', borderRadius: 12, padding: 28, width: 400, border: '1px solid #334155',
}
const primaryBtn = {
  flex: 1, background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 4,
  padding: '9px 0', fontSize: 13, cursor: 'pointer', fontWeight: 600,
}
const cancelBtn = {
  flex: 1, background: 'none', color: '#94a3b8', border: '1px solid #334155',
  borderRadius: 4, padding: '9px 0', fontSize: 13, cursor: 'pointer',
}
