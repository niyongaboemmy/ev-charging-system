import { useState, useEffect } from 'react'
import { useLiveSession } from '../hooks/useLiveSession'
import client from '../api/client'

const STATUS_COLOR = {
  Available:   '#22c55e',
  Charging:    '#f59e0b',
  Preparing:   '#38bdf8',
  Finishing:   '#a78bfa',
  Faulted:     '#ef4444',
  Unavailable: '#475569',
  Reserved:    '#8b5cf6',
}

// Only these statuses allow a new session to be initiated
const CAN_START = new Set(['Available'])

function elapsed(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

// Returns { text, stale } — stale = true if > 3 minutes old
function heartbeatLabel(last_seen) {
  if (!last_seen) return { text: 'Never', stale: true }
  const diffMs = Date.now() - new Date(last_seen).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 10)  return { text: 'Just now', stale: false }
  if (diffSec < 60)  return { text: `${diffSec}s ago`, stale: false }
  if (diffSec < 180) return { text: `${Math.floor(diffSec / 60)}m ago`, stale: false }
  if (diffSec < 3600) return { text: `${Math.floor(diffSec / 60)}m ago`, stale: true }
  return { text: new Date(last_seen).toLocaleString('en-RW'), stale: true }
}

// ─── single gun row ──────────────────────────────────────────────────────────

function ConnectorRow({ chargerId, connector, connectorId, status, users, onRefresh, chargerOnline }) {
  const live = useLiveSession(chargerId, connector)
  const [showModal, setShowModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState('')
  const [budget, setBudget] = useState('')
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (live?.status === 'active') {
      const id = setInterval(() => setTick((t) => t + 1), 1000)
      return () => clearInterval(id)
    }
  }, [live?.status])

  const isCharging = status === 'Charging' || live?.status === 'active'
  const canStart   = chargerOnline && CAN_START.has(status) && !isCharging

  async function startSession() {
    if (!selectedUser) return
    setLoading(true)
    try {
      await client.post('/sessions/start', {
        charger_id: chargerId,
        connector_id: connectorId,
        user_id: selectedUser,
        budget_frw: budget || null,
      })
      setShowModal(false)
      setTimeout(onRefresh, 2000)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to start session')
    } finally {
      setLoading(false)
    }
  }

  async function stopSession() {
    if (!live?.transaction_id) return
    setLoading(true)
    try {
      await client.post('/sessions/stop', {
        charger_id: chargerId,
        transaction_id: live.transaction_id,
      })
      setTimeout(onRefresh, 2000)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to stop session')
    } finally {
      setLoading(false)
    }
  }

  const liveSeconds = live?.elapsed_seconds ? live.elapsed_seconds + tick : 0
  const liveKwh = live?.kwh_consumed ? parseFloat(live.kwh_consumed) : 0
  const liveFrw  = live?.total_frw    ? parseFloat(live.total_frw)    : 0

  // Reason the Start button is unavailable (shown as a dimmed label instead)
  function unavailableReason() {
    if (!chargerOnline)             return 'Charger offline'
    if (status === 'Unavailable')   return 'Gun unavailable'
    if (status === 'Faulted')       return 'Gun faulted'
    if (status === 'Reserved')      return 'Reserved'
    if (status === 'Preparing')     return 'Preparing…'
    if (status === 'Finishing')     return 'Finishing…'
    return null
  }

  const reason = (!canStart && !isCharging) ? unavailableReason() : null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px', background: '#1e293b', borderRadius: 8, marginBottom: 8,
    }}>
      {/* Left: status dot + name + live counter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
          background: STATUS_COLOR[status] || '#475569',
          boxShadow: status === 'Charging' ? `0 0 8px ${STATUS_COLOR.Charging}` : 'none',
          animation: status === 'Charging' ? 'pulse 1.5s infinite' : 'none',
        }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>Gun {connector}</div>
          <div style={{ fontSize: 11, color: STATUS_COLOR[status] || '#94a3b8', fontWeight: 500 }}>
            {status || 'Unavailable'}
          </div>
        </div>
        {live?.status === 'active' && (
          <div style={{ marginLeft: 16, fontFamily: 'monospace', fontSize: 12 }}>
            <span style={{ color: '#38bdf8' }}>{liveKwh.toFixed(3)} kWh</span>
            <span style={{ color: '#64748b', margin: '0 6px' }}>·</span>
            <span style={{ color: '#f59e0b' }}>{liveFrw.toLocaleString()} RWF</span>
            <span style={{ color: '#64748b', margin: '0 6px' }}>·</span>
            <span style={{ color: '#94a3b8' }}>{elapsed(liveSeconds)}</span>
            {live.operator_name && (
              <span style={{ color: '#64748b', marginLeft: 8 }}>@ {live.operator_name}</span>
            )}
          </div>
        )}
      </div>

      {/* Right: action */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {reason && (
          <span style={{ fontSize: 11, color: '#334155', fontStyle: 'italic' }}>{reason}</span>
        )}
        {canStart && (
          <button
            onClick={() => setShowModal(true)}
            style={{
              background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 4,
              padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
            }}
          >
            Start
          </button>
        )}
        {isCharging && (
          <button
            onClick={stopSession}
            disabled={loading}
            style={{
              background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4,
              padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
              opacity: loading ? 0.7 : 1,
            }}
          >
            Stop
          </button>
        )}
      </div>

      {/* Start session modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{
            background: '#1e293b', borderRadius: 12, padding: 28,
            width: 360, border: '1px solid #334155',
          }}>
            <h3 style={{ color: '#e2e8f0', marginBottom: 4, fontSize: 16 }}>
              Start Session — Gun {connector}
            </h3>
            <div style={{ color: '#475569', fontSize: 12, marginBottom: 20 }}>
              {chargerId}
            </div>
            <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>
              Operator / Agent
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', background: '#0f1623',
                border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0',
                marginBottom: 16, fontSize: 13,
              }}
            >
              <option value="">— Select operator —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
            <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>
              Budget (RWF) — optional
            </label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Leave blank for no limit"
              style={{
                width: '100%', padding: '8px 12px', background: '#0f1623',
                border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0',
                marginBottom: 20, fontSize: 13,
              }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={startSession}
                disabled={loading || !selectedUser}
                style={{
                  flex: 1, background: '#0ea5e9', color: '#fff', border: 'none',
                  borderRadius: 4, padding: '9px 0', fontSize: 13,
                  cursor: 'pointer', fontWeight: 600, opacity: (loading || !selectedUser) ? 0.6 : 1,
                }}
              >
                {loading ? 'Starting…' : 'Start Charging'}
              </button>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1, background: 'none', color: '#94a3b8',
                  border: '1px solid #334155', borderRadius: 4, padding: '9px 0',
                  fontSize: 13, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── charger card ─────────────────────────────────────────────────────────────

export default function ChargerCard({ charger, users, onRefresh }) {
  const { charger_id, display_name, status_a, status_b, last_seen, connected } = charger
  const { text: heartbeatText, stale } = heartbeatLabel(last_seen)

  return (
    <div style={{
      background: '#111827', borderRadius: 12, padding: 24,
      border: `1px solid ${connected ? '#22c55e33' : '#1e293b'}`, flex: 1,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: connected ? '#22c55e' : '#475569',
              boxShadow: connected ? '0 0 7px #22c55e' : 'none',
            }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
              {display_name}
            </h2>
            {!connected && (
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 10,
                background: '#ef444422', color: '#ef4444', fontWeight: 600,
              }}>
                Offline
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>
            {charger_id}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#334155', textTransform: 'uppercase', letterSpacing: 1 }}>Last heartbeat</div>
          <div style={{ fontSize: 12, color: stale ? '#ef4444' : '#64748b', marginTop: 2, fontWeight: stale ? 600 : 400 }}>
            {heartbeatText}
          </div>
          {stale && connected === false && (
            <div style={{ fontSize: 10, color: '#7f1d1d', marginTop: 2 }}>Check charger power &amp; network</div>
          )}
        </div>
      </div>

      {/* Offline banner */}
      {!connected && (
        <div style={{
          background: '#1c0a0a', border: '1px solid #7f1d1d', borderRadius: 6,
          padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#fca5a5',
        }}>
          This charger is not connected to the OCPP server. Sessions cannot be started until it reconnects.
          Go to <strong>Settings</strong> to verify its OCPP URL.
        </div>
      )}

      <ConnectorRow
        chargerId={charger_id} connector="A" connectorId={1}
        status={status_a} users={users} onRefresh={onRefresh}
        chargerOnline={!!connected}
      />
      <ConnectorRow
        chargerId={charger_id} connector="B" connectorId={2}
        status={status_b} users={users} onRefresh={onRefresh}
        chargerOnline={!!connected}
      />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
