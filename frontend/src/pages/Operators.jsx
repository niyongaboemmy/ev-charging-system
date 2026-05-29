import { useState, useEffect } from 'react'
import client from '../api/client'

const ROLES = ['admin', 'agent', 'accountant']

const ROLE_COLOR = {
  admin: '#38bdf8',
  agent: '#22c55e',
  accountant: '#f59e0b',
}

export default function Operators() {
  const [users, setUsers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'agent' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await client.get('/users')
    setUsers(data)
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await client.post('/users', form)
      setForm({ name: '', email: '', password: '', role: 'agent' })
      setShowForm(false)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  async function toggleActive(user) {
    await client.patch(`/users/${user.id}`, { is_active: user.is_active ? 0 : 1 })
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ color: '#e2e8f0', fontSize: 22, fontWeight: 700 }}>Operators</h1>
        <button
          onClick={() => setShowForm(true)}
          style={{ background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
        >
          + Add Operator
        </button>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {users.map((u) => (
          <div key={u.id} style={{
            background: '#111827', border: '1px solid #1e293b', borderRadius: 10,
            padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', background: '#1e293b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#e2e8f0', fontWeight: 700, fontSize: 16,
              }}>
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{u.name}</div>
                <div style={{ color: '#475569', fontSize: 12 }}>{u.email}</div>
              </div>
              <span style={{
                background: ROLE_COLOR[u.role] + '22',
                color: ROLE_COLOR[u.role],
                padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
              }}>
                {u.role}
              </span>
              {!u.is_active && (
                <span style={{ background: '#ef444422', color: '#ef4444', padding: '3px 10px', borderRadius: 12, fontSize: 11 }}>
                  Inactive
                </span>
              )}
            </div>
            <button
              onClick={() => toggleActive(u)}
              style={{
                background: 'none', border: '1px solid #334155', borderRadius: 4,
                color: u.is_active ? '#ef4444' : '#22c55e', padding: '6px 14px',
                fontSize: 12, cursor: 'pointer',
              }}
            >
              {u.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        ))}
      </div>

      {showForm && (
        <div style={overlay}>
          <div style={modal}>
            <h3 style={{ color: '#e2e8f0', marginBottom: 20 }}>Add Operator</h3>
            <form onSubmit={handleCreate}>
              {[
                { key: 'name', label: 'Full Name', type: 'text' },
                { key: 'email', label: 'Email', type: 'email' },
                { key: 'password', label: 'Password', type: 'password' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    required
                    style={{ ...inputStyle, width: '100%', marginBottom: 14 }}
                  />
                </div>
              ))}
              <label style={labelStyle}>Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                style={{ ...inputStyle, width: '100%', marginBottom: 20 }}
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>

              {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={loading} style={primaryBtn}>
                  {loading ? 'Creating…' : 'Create Operator'}
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
  background: '#1e293b', borderRadius: 12, padding: 28, width: 420, border: '1px solid #334155',
}
const primaryBtn = {
  flex: 1, background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 4,
  padding: '9px 0', fontSize: 13, cursor: 'pointer', fontWeight: 600,
}
const cancelBtn = {
  flex: 1, background: 'none', color: '#94a3b8', border: '1px solid #334155',
  borderRadius: 4, padding: '9px 0', fontSize: 13, cursor: 'pointer',
}
