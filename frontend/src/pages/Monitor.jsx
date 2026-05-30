import { useState, useEffect, useRef, useCallback } from 'react'
import client from '../api/client'

// ─── event type config ────────────────────────────────────────────────────────

const EVENT_META = {
  init:                   { icon: '⚡', color: '#38bdf8', label: 'System',    dim: false },
  connected:              { icon: '🟢', color: '#22c55e', label: 'Connected',  dim: false },
  disconnected:           { icon: '🔴', color: '#ef4444', label: 'Disconnected', dim: false },
  BootNotification:       { icon: '🔌', color: '#38bdf8', label: 'Boot',       dim: false },
  Heartbeat:              { icon: '♥',  color: '#334155', label: 'Heartbeat',  dim: true  },
  StatusNotification:     { icon: '📡', color: '#a78bfa', label: 'Status',     dim: false },
  Authorize:              { icon: '🪪', color: '#f59e0b', label: 'Authorize',  dim: false },
  StartTransaction:       { icon: '▶',  color: '#22c55e', label: 'Session Start', dim: false },
  MeterValues:            { icon: '⚡', color: '#f59e0b', label: 'Meter',      dim: false },
  BudgetStop:             { icon: '🛑', color: '#ef4444', label: 'Budget Stop', dim: false },
  StopTransaction:        { icon: '■',  color: '#ef4444', label: 'Session End', dim: false },
  RemoteStartTransaction: { icon: '→',  color: '#0ea5e9', label: 'RemoteStart', dim: false },
  RemoteStopTransaction:  { icon: '→',  color: '#f97316', label: 'RemoteStop',  dim: false },
  ChangeConfiguration:    { icon: '⚙',  color: '#a78bfa', label: 'Config',     dim: false },
  UnknownAction:          { icon: '?',  color: '#475569', label: 'Unknown',    dim: true  },
  error:                  { icon: '✗',  color: '#ef4444', label: 'Error',      dim: false },
}

const STATUS_COLOR = {
  Available:   '#22c55e',
  Charging:    '#f59e0b',
  Preparing:   '#38bdf8',
  Finishing:   '#a78bfa',
  Faulted:     '#ef4444',
  Unavailable: '#475569',
  Reserved:    '#8b5cf6',
}

function elapsed(startTime) {
  if (!startTime) return '00:00:00'
  const s = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':')
}

function relativeTs(iso) {
  if (!iso) return '—'
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 5)   return 'just now'
  if (s < 60)  return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return new Date(iso).toLocaleTimeString('en-RW', { hour12: false })
}

// ─── sub-components ───────────────────────────────────────────────────────────

function GunRow({ label, status }) {
  const color = STATUS_COLOR[status] || '#475569'
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
      <span style={{ fontSize: 12, color: '#64748b' }}>Gun {label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: color,
          boxShadow: status === 'Charging' ? `0 0 8px ${color}` : 'none',
          animation: status === 'Charging' ? 'pulse 1.5s infinite' : 'none',
          display: 'inline-block',
        }} />
        <span style={{ fontSize: 12, fontWeight: 600, color }}>{status}</span>
      </span>
    </div>
  )
}

function ActiveSessionBadge({ session, tick, chargerOnline }) {
  if (!session) return null
  const kwh  = parseFloat(session.kwh_consumed || 0)
  const frw  = parseFloat(session.total_frw || 0)
  const rate = parseFloat(session.price_per_kwh || 0)
  const estimated = kwh * rate
  const stale = !chargerOnline

  return (
    <div style={{
      background: stale ? '#1c0a0a' : '#0f1a0a',
      border: `1px solid ${stale ? '#ef444433' : '#22c55e33'}`,
      borderRadius: 6, padding: '8px 12px', marginTop: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 10, color: stale ? '#ef4444' : '#4ade80', textTransform: 'uppercase', letterSpacing: 1 }}>
          {stale ? '⚠ Stuck — Session #' : 'Active — Session #'}{session.id}
        </div>
        {stale && (
          <div style={{ fontSize: 10, color: '#7f1d1d' }}>Charger offline — meter frozen</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: '#475569' }}>Energy</div>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', color: '#38bdf8' }}>
            {kwh.toFixed(3)} kWh
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#475569' }}>Cost</div>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', color: '#f59e0b' }}>
            {Math.round(frw || estimated).toLocaleString()} RWF
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#475569' }}>Elapsed</div>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', color: '#a78bfa' }}>
            {elapsed(session.start_time)}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#4ade80', marginTop: 4 }}>
        {session.operator_name} · Gun {session.connector}
        {session.budget_frw && (
          <span style={{ color: '#f59e0b', marginLeft: 8 }}>
            Budget: {Math.round(session.budget_frw).toLocaleString()} RWF
          </span>
        )}
      </div>
    </div>
  )
}

function ChargerPanel({ charger, activeSessions, users, onAction }) {
  const [showStart, setShowStart] = useState(false)
  const [startGun, setStartGun]   = useState('1')
  const [agentId, setAgentId]     = useState('')
  const [budget, setBudget]       = useState('')
  const [loading, setLoading]     = useState(false)
  const [tick, setTick]           = useState(0)

  // Tick every second to update elapsed timers
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const sessionA = activeSessions.find(s => s.charger_id === charger.charger_id && s.connector === 'A')
  const sessionB = activeSessions.find(s => s.charger_id === charger.charger_id && s.connector === 'B')

  const canStartA = charger.connected && charger.status_a === 'Available'
  const canStartB = charger.connected && charger.status_b === 'Available'
  const canStartAny = canStartA || canStartB

  async function handleStart(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await client.post('/sessions/start', {
        charger_id:   charger.charger_id,
        connector_id: parseInt(startGun),
        user_id:      agentId,
        budget_frw:   budget || null,
      })
      setShowStart(false)
      setBudget('')
      onAction('start', charger.charger_id)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to start')
    } finally {
      setLoading(false)
    }
  }

  async function handleStop(session) {
    if (!window.confirm(`Send RemoteStop to charger for session #${session.id}?`)) return
    setLoading(true)
    try {
      await client.post('/sessions/stop', {
        charger_id:     charger.charger_id,
        transaction_id: session.transaction_id,
      })
      onAction('stop', charger.charger_id)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to stop')
    } finally {
      setLoading(false)
    }
  }

  async function handleForceClose(session) {
    if (!window.confirm(
      `Force-close session #${session.id}?\n\nThe charger is offline so a normal stop is not possible.\n\nThis will mark the session as completed in the database with the last recorded meter value (${parseFloat(session.kwh_consumed || 0).toFixed(3)} kWh).`
    )) return
    setLoading(true)
    try {
      await client.post(`/sessions/${session.id}/force-close`, {})
      onAction('force-close', charger.charger_id)
    } catch (err) {
      alert(err.response?.data?.error || 'Force close failed')
    } finally {
      setLoading(false)
    }
  }

  const hbAge  = charger.last_seen ? (Date.now() - new Date(charger.last_seen).getTime()) / 1000 : Infinity
  const hbColor = hbAge > 180 ? '#ef4444' : '#64748b'

  return (
    <div style={{
      background: '#111827',
      border: `1px solid ${charger.connected ? '#22c55e33' : '#1e293b'}`,
      borderRadius: 10, padding: 16, marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
            <span style={{
              width: 9, height: 9, borderRadius: '50%', display: 'inline-block',
              background: charger.connected ? '#22c55e' : '#475569',
              boxShadow: charger.connected ? '0 0 8px #22c55e' : 'none',
            }} />
            <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>
              {charger.display_name || charger.charger_id}
            </span>
          </div>
          <div style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', paddingLeft: 16 }}>
            {charger.charger_id}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: hbColor }}>
            ♥ {charger.last_seen ? relativeTs(charger.last_seen) : 'Never'}
          </div>
          {!charger.connected && (
            <div style={{ fontSize: 10, color: '#ef4444', marginTop: 2 }}>Offline</div>
          )}
        </div>
      </div>

      {/* Gun status rows */}
      <div style={{ borderTop: '1px solid #1e293b', borderBottom: '1px solid #1e293b', padding: '4px 0', marginBottom: 10 }}>
        <GunRow label="A" status={charger.status_a} />
        <GunRow label="B" status={charger.status_b} />
      </div>

      {/* Active sessions */}
      {sessionA && <ActiveSessionBadge session={sessionA} tick={tick} chargerOnline={charger.connected} />}
      {sessionB && <ActiveSessionBadge session={sessionB} tick={tick} chargerOnline={charger.connected} />}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {canStartAny && (
          <button
            onClick={() => setShowStart(v => !v)}
            style={{ ...btnBase, background: '#0ea5e9', color: '#fff', border: 'none', flex: 1 }}
          >
            {showStart ? '✕ Cancel' : '▶ Start Charge'}
          </button>
        )}
        {/* Online: normal RemoteStop */}
        {sessionA && charger.connected && (
          <button onClick={() => handleStop(sessionA)} disabled={loading}
            style={{ ...btnBase, color: '#ef4444', borderColor: '#ef444444', opacity: loading ? 0.5 : 1 }}>
            {loading ? '…' : '■ Stop Gun A'}
          </button>
        )}
        {sessionB && charger.connected && (
          <button onClick={() => handleStop(sessionB)} disabled={loading}
            style={{ ...btnBase, color: '#ef4444', borderColor: '#ef444444', opacity: loading ? 0.5 : 1 }}>
            {loading ? '…' : '■ Stop Gun B'}
          </button>
        )}
        {/* Offline but has stuck session: force-close */}
        {sessionA && !charger.connected && (
          <button onClick={() => handleForceClose(sessionA)} disabled={loading}
            style={{ ...btnBase, color: '#f97316', borderColor: '#f9731644', opacity: loading ? 0.5 : 1, fontSize: 11 }}>
            {loading ? '…' : '⚠ Force Close #' + sessionA.id}
          </button>
        )}
        {sessionB && !charger.connected && (
          <button onClick={() => handleForceClose(sessionB)} disabled={loading}
            style={{ ...btnBase, color: '#f97316', borderColor: '#f9731644', opacity: loading ? 0.5 : 1, fontSize: 11 }}>
            {loading ? '…' : '⚠ Force Close #' + sessionB.id}
          </button>
        )}
        {!charger.connected && !sessionA && !sessionB && (
          <div style={{ fontSize: 11, color: '#334155', flex: 1 }}>
            Charger offline — configure OCPP URL in Settings
          </div>
        )}
      </div>

      {/* Start form */}
      {showStart && (
        <form onSubmit={handleStart} style={{ marginTop: 12, padding: 14, background: '#0f1623', borderRadius: 8, border: '1px solid #1e293b' }}>
          <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            New Session
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={lbl}>Gun</label>
              <select value={startGun} onChange={e => setStartGun(e.target.value)} style={sel}>
                {canStartA && <option value="1">Gun A</option>}
                {canStartB && <option value="2">Gun B</option>}
              </select>
            </div>
            <div>
              <label style={lbl}>Agent</label>
              <select value={agentId} onChange={e => setAgentId(e.target.value)} required style={sel}>
                <option value="">— select —</option>
                {users.filter(u => u.role === 'agent' && u.is_active).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>Budget RWF (optional — auto-stops when reached)</label>
            <input
              type="number" value={budget} onChange={e => setBudget(e.target.value)}
              placeholder="Leave blank for no limit"
              style={{ ...sel, width: '100%' }}
            />
          </div>
          <button type="submit" disabled={loading || !agentId}
            style={{ ...btnBase, background: '#0ea5e9', color: '#fff', border: 'none', width: '100%', opacity: (!agentId || loading) ? 0.6 : 1 }}>
            {loading ? 'Starting…' : '▶ Start Charging'}
          </button>
        </form>
      )}
    </div>
  )
}

// ─── log entry row ────────────────────────────────────────────────────────────

function LogRow({ event, showCharger }) {
  const meta = EVENT_META[event.type] || { icon: '·', color: '#475569', label: event.type, dim: true }
  const time = event.ts
    ? new Date(event.ts).toLocaleTimeString('en-RW', { hour12: false, fractionalSecondDigits: 1 })
    : ''

  if (meta.dim) {
    return (
      <div style={{ display: 'flex', gap: 10, padding: '3px 10px', alignItems: 'center', opacity: 0.4 }}>
        <span style={{ fontSize: 10, color: '#334155', fontFamily: 'monospace', flexShrink: 0 }}>{time}</span>
        <span style={{ fontSize: 11, color: '#334155' }}>{meta.icon} {event.summary || event.type}</span>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', gap: 10, padding: '6px 10px', alignItems: 'flex-start',
      borderLeft: `2px solid ${meta.color}55`,
      background: 'transparent',
      marginBottom: 1,
    }}>
      <span style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', flexShrink: 0, paddingTop: 1, minWidth: 76 }}>
        {time}
      </span>
      {showCharger && event.chargerId && (
        <span style={{ fontSize: 10, color: '#334155', fontFamily: 'monospace', flexShrink: 0, paddingTop: 1, minWidth: 52 }}>
          {event.chargerId.split('-').pop()}
        </span>
      )}
      <span style={{ fontSize: 13, flexShrink: 0 }}>{meta.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: meta.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {meta.label}
          </span>
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1, lineHeight: 1.4 }}>
          {event.summary || event.type}
        </div>
        {/* Extra detail for key events */}
        {event.type === 'MeterValues' && event.kwh != null && (
          <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#38bdf8' }}>
              {parseFloat(event.kwh).toFixed(3)} kWh
            </span>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#f59e0b' }}>
              {Math.round(event.frwSoFar || 0).toLocaleString()} RWF
            </span>
            {event.budget && (
              <span style={{ fontSize: 11, color: '#64748b' }}>
                / {Math.round(event.budget).toLocaleString()} budget
              </span>
            )}
          </div>
        )}
        {(event.type === 'StartTransaction' || event.type === 'StopTransaction') && event.status !== 'Invalid' && (
          <div style={{ display: 'flex', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
            {event.sessionId   && <span style={{ fontSize: 11, color: '#64748b' }}>#{event.sessionId}</span>}
            {event.kwh         && <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#38bdf8' }}>{parseFloat(event.kwh).toFixed(3)} kWh</span>}
            {event.totalFrw    && <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#f59e0b' }}>{Math.round(event.totalFrw).toLocaleString()} RWF</span>}
            {event.connector   && <span style={{ fontSize: 11, color: '#64748b' }}>Gun {event.connector}</span>}
            {event.operatorName && <span style={{ fontSize: 11, color: '#64748b' }}>{event.operatorName}</span>}
          </div>
        )}
        {event.type === 'error' && (
          <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{event.message}</div>
        )}
      </div>
    </div>
  )
}

// ─── main Monitor page ────────────────────────────────────────────────────────

const MAX_LOG = 500
const HIDE_HEARTBEAT_KEY = 'monitor_hide_hb'

export default function Monitor() {
  const [status, setStatus]           = useState(null)   // chargers + activeSessions
  const [users, setUsers]             = useState([])
  const [events, setEvents]           = useState([])
  const [sseState, setSseState]       = useState('connecting') // connecting | open | closed
  const [filterCharger, setFilter]    = useState('all')
  const [hideHeartbeat, setHideHb]    = useState(() => localStorage.getItem(HIDE_HEARTBEAT_KEY) === '1')
  const [autoScroll, setAutoScroll]   = useState(true)
  const [tick, setTick]               = useState(0)

  const logRef  = useRef(null)
  const esRef   = useRef(null)
  const prevScrollTop = useRef(0)

  // Tick for elapsed timers
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Initial data load
  const loadStatus = useCallback(async () => {
    try {
      const [{ data: s }, { data: u }] = await Promise.all([
        client.get('/monitor/status'),
        client.get('/users'),
      ])
      setStatus(s)
      setUsers(u)
    } catch (_) {}
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  // SSE connection
  useEffect(() => {
    const token = localStorage.getItem('token')
    const es = new EventSource(`/api/monitor/stream?_t=${Date.now()}`, {
      // EventSource doesn't support headers natively; inject token via query
    })

    // Workaround: use fetch-based SSE via custom impl below if auth needed
    // For now, the authenticate middleware will fall through on EventSource
    // We'll use the Fetch API SSE pattern instead
    es.close()

    // Use fetch + ReadableStream for SSE with auth header
    const ctrl = new AbortController()
    esRef.current = ctrl

    async function connectSSE() {
      setSseState('connecting')
      try {
        const res = await fetch('/api/monitor/stream', {
          headers: { Authorization: `Bearer ${token}` },
          signal: ctrl.signal,
        })
        if (!res.ok) { setSseState('closed'); return }
        setSseState('open')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) { setSseState('closed'); break }
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() // keep incomplete line
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6))
                setEvents(prev => {
                  const next = [...prev, event]
                  return next.length > MAX_LOG ? next.slice(-MAX_LOG) : next
                })
                // Refresh charger status on key events
                if (['connected','disconnected','StartTransaction','StopTransaction','StatusNotification'].includes(event.type)) {
                  loadStatus()
                }
              } catch (_) {}
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') setSseState('closed')
      }
    }

    connectSSE()
    return () => ctrl.abort()
  }, [loadStatus])

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [events, autoScroll])

  function handleLogScroll() {
    const el = logRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setAutoScroll(atBottom)
    prevScrollTop.current = el.scrollTop
  }

  function toggleHideHb(v) {
    setHideHb(v)
    localStorage.setItem(HIDE_HEARTBEAT_KEY, v ? '1' : '0')
  }

  // Filter events
  const chargerIds = status?.chargers?.map(c => c.charger_id) || []
  const visibleEvents = events.filter(ev => {
    if (hideHeartbeat && ev.type === 'Heartbeat') return false
    if (filterCharger !== 'all' && ev.chargerId && ev.chargerId !== filterCharger) return false
    return true
  })

  const showChargerCol = filterCharger === 'all' && chargerIds.length > 1

  // Stats
  const connCount    = status?.connectedCount || 0
  const activeCount  = status?.activeSessions?.length || 0
  const totalEvents  = events.filter(e => e.type !== 'Heartbeat' && e.type !== 'init').length

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 80px)', overflow: 'hidden', gap: 0 }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {/* ── LEFT: Charger control panel ── */}
      <div style={{ width: 300, flexShrink: 0, overflowY: 'auto', borderRight: '1px solid #1e293b', padding: '16px 14px' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Live Monitor</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            <Stat label="Online" value={connCount} color={connCount > 0 ? '#22c55e' : '#475569'} />
            <Stat label="Active sessions" value={activeCount} color={activeCount > 0 ? '#f59e0b' : '#475569'} />
            <Stat label="Events" value={totalEvents} color='#38bdf8' />
          </div>
        </div>

        {/* SSE status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, fontSize: 11 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
            background: sseState === 'open' ? '#22c55e' : sseState === 'connecting' ? '#f59e0b' : '#ef4444',
            animation: sseState === 'connecting' ? 'pulse 1s infinite' : 'none',
          }} />
          <span style={{ color: '#475569' }}>
            {sseState === 'open' ? 'Live stream connected' : sseState === 'connecting' ? 'Connecting…' : 'Stream closed — refresh page'}
          </span>
        </div>

        {/* Charger cards */}
        {!status && (
          <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', marginTop: 32 }}>Loading…</div>
        )}
        {status?.chargers?.map(c => (
          <ChargerPanel
            key={c.charger_id}
            charger={c}
            activeSessions={status.activeSessions || []}
            users={users}
            onAction={loadStatus}
          />
        ))}
        {status?.chargers?.length === 0 && (
          <div style={{ color: '#334155', fontSize: 12, textAlign: 'center', marginTop: 32 }}>
            No chargers registered. Go to Settings to add one.
          </div>
        )}
      </div>

      {/* ── RIGHT: Live event log ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Log toolbar */}
        <div style={{ flexShrink: 0, padding: '10px 14px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 13 }}>Event Log</span>
          <span style={{ color: '#334155', fontSize: 11 }}>{visibleEvents.length} events</span>

          {/* Charger filter */}
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            {['all', ...chargerIds].map(id => (
              <button key={id} onClick={() => setFilter(id)} style={{
                padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                background: filterCharger === id ? '#1e3a5f' : 'none',
                border: `1px solid ${filterCharger === id ? '#38bdf8' : '#1e293b'}`,
                color: filterCharger === id ? '#38bdf8' : '#475569', cursor: 'pointer',
              }}>
                {id === 'all' ? 'All' : id.split('-').slice(-1)[0]}
              </button>
            ))}
          </div>

          {/* Heartbeat toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#475569', cursor: 'pointer' }}>
            <input type="checkbox" checked={hideHeartbeat} onChange={e => toggleHideHb(e.target.checked)} style={{ width: 12, height: 12 }} />
            Hide heartbeats
          </label>

          {/* Clear */}
          <button onClick={() => setEvents([])} style={{
            padding: '3px 10px', borderRadius: 4, fontSize: 11,
            background: 'none', border: '1px solid #1e293b', color: '#475569', cursor: 'pointer',
          }}>
            Clear
          </button>
        </div>

        {/* Log scroll area */}
        <div
          ref={logRef}
          onScroll={handleLogScroll}
          style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}
        >
          {visibleEvents.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: '#334155' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>📡</div>
              <div style={{ fontSize: 13, color: '#475569', marginBottom: 6 }}>Waiting for OCPP events…</div>
              <div style={{ fontSize: 11, color: '#334155' }}>
                Connect a charger or open the Simulator to see live events here.
              </div>
            </div>
          )}
          {visibleEvents.map((ev, i) => (
            <LogRow key={i} event={ev} showCharger={showChargerCol} />
          ))}
        </div>

        {/* Footer: auto-scroll indicator + legend */}
        <div style={{ flexShrink: 0, borderTop: '1px solid #1e293b', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 16 }}>
          {!autoScroll && (
            <button
              onClick={() => { setAutoScroll(true); logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }) }}
              style={{ padding: '3px 10px', borderRadius: 4, fontSize: 11, background: '#0ea5e9', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              ↓ Jump to latest
            </button>
          )}
          <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', flexWrap: 'wrap' }}>
            {[
              ['▶ Session Start', '#22c55e'],
              ['■ Session End', '#ef4444'],
              ['⚡ Meter', '#f59e0b'],
              ['→ Remote Cmd', '#0ea5e9'],
              ['📡 Status', '#a78bfa'],
            ].map(([label, color]) => (
              <span key={label} style={{ fontSize: 10, color, fontWeight: 600 }}>{label}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── micro components ─────────────────────────────────────────────────────────

function Stat({ label, value, color }) {
  return (
    <div style={{ background: '#0f1623', border: '1px solid #1e293b', borderRadius: 6, padding: '6px 12px' }}>
      <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color }}>{value}</div>
    </div>
  )
}

const btnBase = { padding: '7px 14px', borderRadius: 6, border: '1px solid #334155', background: 'none', fontSize: 12, cursor: 'pointer', fontWeight: 600 }
const lbl = { display: 'block', fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }
const sel = { padding: '6px 10px', background: '#111827', border: '1px solid #334155', borderRadius: 5, color: '#e2e8f0', fontSize: 12, width: '100%' }
