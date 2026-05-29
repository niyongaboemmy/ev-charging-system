import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f1623 0%, #111827 100%)',
    }}>
      <div style={{
        background: '#111827', border: '1px solid #1e293b', borderRadius: 16,
        padding: 40, width: 400,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#38bdf8', letterSpacing: 2 }}>
            EVCSIMS
          </div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
            Simple Charge · Kigali, Rwanda
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            style={inputStyle}
            placeholder="admin@simplecharge.rw"
          />
          <label style={labelStyle}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />

          {error && (
            <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 16 }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '11px 0', background: '#0ea5e9', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700,
              cursor: 'pointer', opacity: loading ? 0.7 : 1, transition: 'opacity .2s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 500,
}
const inputStyle = {
  width: '100%', padding: '10px 14px', background: '#0f1623',
  border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0',
  fontSize: 14, marginBottom: 18, outline: 'none',
}
