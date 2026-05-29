import { useState, useEffect, useCallback } from 'react'
import client from '../api/client'

// ─── tiny helpers ─────────────────────────────────────────────────────────────

function buildOcppUrl({ tls_enabled, server_host, server_port, charger_id }) {
  if (!server_host) return null
  const scheme = tls_enabled ? 'wss' : 'ws'
  return `${scheme}://${server_host}:${server_port}/ocpp/${charger_id}`
}

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1800)
        })
      }}
      style={copyBtn}
    >
      {copied ? '✓ Copied!' : label}
    </button>
  )
}

function Badge({ children, color = '#64748b', bg }) {
  return (
    <span style={{
      fontSize: 10, padding: '2px 9px', borderRadius: 10, fontWeight: 600,
      color, background: bg || color + '22',
    }}>
      {children}
    </span>
  )
}

// ─── "How it works" explainer ─────────────────────────────────────────────────

function HowItWorks() {
  const [open, setOpen] = useState(true)

  return (
    <div style={{ background: '#0d1f35', border: '1px solid #1e3a5f', borderRadius: 12, marginBottom: 32, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>💡</span>
          <span style={{ color: '#93c5fd', fontWeight: 700, fontSize: 14 }}>How does this work? (read this first)</span>
        </div>
        <span style={{ color: '#475569', fontSize: 12 }}>{open ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 20px 20px' }}>

          {/* Flow diagram */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 20, flexWrap: 'wrap' }}>
            {[
              { icon: '🔌', title: 'Physical Charger', sub: 'The hardware machine\n(Ningbo Yuyue 160 kW)', color: '#f59e0b' },
              { arrow: true, label: 'OCPP 1.6J\nWebSocket' },
              { icon: '🖥', title: 'This Server', sub: 'Runs on this computer\nListens on port 8887', color: '#0ea5e9' },
              { arrow: true, label: 'REST API' },
              { icon: '📊', title: 'Dashboard', sub: 'What you see\nin your browser', color: '#22c55e' },
            ].map((item, i) =>
              item.arrow ? (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 8px' }}>
                  <div style={{ color: '#475569', fontSize: 18, lineHeight: 1 }}>→</div>
                  <div style={{ color: '#334155', fontSize: 10, textAlign: 'center', whiteSpace: 'pre', marginTop: 2 }}>{item.label}</div>
                </div>
              ) : (
                <div key={i} style={{ background: '#111827', border: `1px solid ${item.color}44`, borderRadius: 8, padding: '12px 16px', minWidth: 140, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{item.icon}</div>
                  <div style={{ color: item.color, fontWeight: 700, fontSize: 12 }}>{item.title}</div>
                  <div style={{ color: '#475569', fontSize: 11, marginTop: 4, whiteSpace: 'pre' }}>{item.sub}</div>
                </div>
              )
            )}
          </div>

          {/* Two concepts explained */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#111827', borderRadius: 8, padding: '14px 16px', borderLeft: '3px solid #0ea5e9' }}>
              <div style={{ color: '#0ea5e9', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Part A — This Server (section below)</div>
              <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.7 }}>
                This is <strong style={{ color: '#e2e8f0' }}>your side</strong> — the software running on this computer that listens for charger connections.
                It automatically detects this machine's IP address. <strong style={{ color: '#e2e8f0' }}>You don't configure this</strong> — it's already running.
                You only need to know this IP so you can type it into the charger.
              </div>
            </div>
            <div style={{ background: '#111827', borderRadius: 8, padding: '14px 16px', borderLeft: '3px solid #f59e0b' }}>
              <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Part B — Physical Chargers (section below)</div>
              <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.7 }}>
                This is <strong style={{ color: '#e2e8f0' }}>the charger's side</strong> — each physical machine must be told where to connect.
                For each charger, this page generates the exact URL you go and type on that charger's touchscreen.
                Once configured, the charger calls your server automatically.
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, background: '#111827', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ color: '#64748b', fontSize: 12, lineHeight: 1.7 }}>
              <strong style={{ color: '#94a3b8' }}>The URL on each charger card is the link between both sides.</strong>{' '}
              It contains the server IP (Part A) and the charger's unique ID (Part B) — formatted as:{' '}
              <code style={{ color: '#38bdf8' }}>ws://&lt;server-ip&gt;:8887/ocpp/&lt;charger-id&gt;</code>.
              Every charger gets its own unique URL because each has a different ID at the end.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── interface classification ─────────────────────────────────────────────────

const IF_META = {
  ethernet: {
    label: 'WiFi / Ethernet',
    color: '#22c55e',
    tip: 'Physical network interface. Use this when the charger is on the same router or switch as this machine.',
    recommended: true,
  },
  vpn: {
    label: 'VPN tunnel',
    color: '#f59e0b',
    tip: 'Virtual interface from a VPN client (WireGuard, OpenVPN, etc.). The charger cannot reach this unless it is also inside the same VPN — almost never the case for physical hardware.',
    recommended: false,
  },
  virtual: {
    label: 'System virtual',
    color: '#475569',
    tip: 'System-managed virtual interface (AirDrop, Docker, etc.). Cannot be reached by external devices.',
    recommended: false,
  },
  container: {
    label: 'Container bridge',
    color: '#475569',
    tip: 'Docker / container network bridge. Not accessible from physical devices on your LAN.',
    recommended: false,
  },
}

// ─── Part A: OCPP Server status ───────────────────────────────────────────────

function ServerSection({ serverInfo }) {
  const [showOthers, setShowOthers] = useState(false)
  const { interfaces = [], port, scheme, connected_chargers, connected_count } = serverInfo
  const usable = interfaces.filter((i) => i.usable)
  const others = interfaces.filter((i) => !i.usable)

  return (
    <section style={{ marginBottom: 36 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>A</div>
        <div style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 700 }}>This Server — what chargers connect to</div>
      </div>
      <div style={{ color: '#475569', fontSize: 12, marginBottom: 16, paddingLeft: 34 }}>
        This software is already running and listening. Nothing to configure here — just note the IP address below so you can type it into each charger.
      </div>

      <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>

        {/* Status row */}
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #1e293b' }}>
          <div>
            <div style={statLabel}>Status</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
              <span style={{ ...statVal, color: '#22c55e' }}>Running</span>
            </div>
          </div>
          <div>
            <div style={statLabel}>Listens on port</div>
            <div style={{ ...statVal, fontFamily: 'monospace' }}>{port}</div>
          </div>
          <div>
            <div style={statLabel}>Protocol</div>
            <div style={{ ...statVal, fontFamily: 'monospace' }}>{scheme}://</div>
          </div>
          <div>
            <div style={statLabel}>Chargers online now</div>
            <div style={{ ...statVal, color: connected_count > 0 ? '#22c55e' : '#64748b' }}>
              {connected_count}
              {connected_count === 0 && <span style={{ fontSize: 12, color: '#475569', fontWeight: 400, marginLeft: 6 }}>none connected</span>}
            </div>
          </div>
        </div>

        {/* Currently connected */}
        {connected_chargers.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={subLabel}>Chargers currently connected</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {connected_chargers.map((id) => (
                <span key={id} style={{ background: '#22c55e22', color: '#22c55e', fontSize: 12, padding: '4px 12px', borderRadius: 20, fontFamily: 'monospace' }}>
                  ● {id}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* IP addresses */}
        <div>
          <div style={subLabel}>
            This machine's IP address
            <span style={{ color: '#334155', fontWeight: 400, marginLeft: 8 }}>— auto-detected, updates automatically</span>
          </div>

          {usable.length === 0 && (
            <div style={{ color: '#f59e0b', fontSize: 12, padding: '12px 14px', background: '#1c1a0b', borderRadius: 8, border: '1px solid #3d3000', marginTop: 10 }}>
              ⚠ No WiFi or Ethernet connection detected. Connect this machine to the network before configuring chargers.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {usable.map((iface) => {
              const meta = IF_META[iface.type] || IF_META.ethernet
              return (
                <div key={iface.name} style={{ background: '#0f1623', border: '1px solid #22c55e33', borderRadius: 8, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Badge color={meta.color}>{meta.label}</Badge>
                    <Badge color='#0ea5e9'>Use this one</Badge>
                    <span style={{ color: '#64748b', fontSize: 12, fontFamily: 'monospace' }}>{iface.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                    <span style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: 18, fontWeight: 700 }}>{iface.address}</span>
                    <CopyButton text={iface.address} label='Copy IP' />
                  </div>
                  <div style={{ color: '#475569', fontSize: 11, marginTop: 6 }}>{meta.tip}</div>
                </div>
              )
            })}
          </div>

          {others.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <button
                onClick={() => setShowOthers((v) => !v)}
                style={{ background: 'none', border: 'none', color: '#334155', fontSize: 12, cursor: 'pointer', padding: 0 }}
              >
                {showOthers ? '▲ Hide' : '▼ Show'} {others.length} other interface{others.length > 1 ? 's' : ''} (not recommended for chargers)
              </button>
              {showOthers && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {others.map((iface) => {
                    const meta = IF_META[iface.type] || IF_META.virtual
                    return (
                      <div key={iface.name} style={{ background: '#0f1623', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 14px', opacity: 0.65 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Badge color={meta.color}>{meta.label}</Badge>
                          <span style={{ color: '#475569', fontSize: 12, fontFamily: 'monospace' }}>{iface.name} · {iface.address}</span>
                        </div>
                        <div style={{ color: '#475569', fontSize: 11 }}>{meta.tip}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ─── charger device card ──────────────────────────────────────────────────────

function ChargerDeviceCard({ charger, serverInfo, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const ocppUrl = buildOcppUrl({
    tls_enabled: charger.tls_enabled,
    server_host: charger.server_host,
    server_port: charger.server_port,
    charger_id: charger.charger_id,
  })

  async function handleDelete() {
    if (!window.confirm(`Remove "${charger.display_name || charger.charger_id}" from the system?`)) return
    setDeleting(true)
    try {
      await client.delete(`/chargers/${charger.charger_id}`)
      onRefresh()
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  if (editing) {
    return (
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>
          Edit — {charger.display_name || charger.charger_id}
        </div>
        <ChargerForm
          initial={{
            ...charger,
            server_port: String(charger.server_port),
            heartbeat_interval: String(charger.heartbeat_interval),
            connector_count: String(charger.connector_count),
            tls_enabled: !!charger.tls_enabled,
            server_host: charger.server_host || '',
            apn: charger.apn || '',
            back_office_pass: charger.back_office_pass || '',
            notes: charger.notes || '',
          }}
          serverInfo={serverInfo}
          editMode
          onSave={() => { setEditing(false); onRefresh() }}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  const guns = charger.connector_count === 1 ? ['A'] : ['A', 'B']

  return (
    <div style={{ ...card, borderColor: charger.connected ? '#22c55e33' : '#1e293b' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
            background: charger.connected ? '#22c55e' : '#475569',
            boxShadow: charger.connected ? '0 0 10px #22c55e' : 'none',
          }} />
          <div>
            <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 16 }}>
              {charger.display_name || charger.charger_id}
            </div>
            {charger.location && (
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{charger.location}</div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Badge color={charger.connected ? '#22c55e' : '#64748b'}>
            {charger.connected ? 'Online' : 'Offline'}
          </Badge>
          <Badge color={charger.network_type === '4g' ? '#f59e0b' : '#38bdf8'}>
            {charger.network_type === '4g' ? '4G SIM' : 'LAN'}
          </Badge>
          <Badge color='#94a3b8'>
            {guns.length} gun{guns.length > 1 ? `s (Gun A + Gun B)` : ' (Gun A)'}
          </Badge>
        </div>
      </div>

      {/* ── Machine ID ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '8px 12px', background: '#0f1623', borderRadius: 6 }}>
        <div>
          <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>Machine ID (used in the URL)</div>
          <code style={{ color: '#94a3b8', fontSize: 13 }}>{charger.charger_id}</code>
        </div>
      </div>

      {/* ── The key section: URL to configure on the charger ── */}
      {ocppUrl ? (
        <div style={{ background: '#0a1628', border: '1px solid #0ea5e944', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 15 }}>📱</span>
            <div style={{ color: '#93c5fd', fontWeight: 700, fontSize: 13 }}>
              Type this into the charger's touchscreen
            </div>
          </div>

          {/* Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {[
              'On the charger touchscreen, enter the Back Office menu (hold top-right corner or enter the back-office password).',
              'Go to Network Settings → OCPP Settings.',
              'Paste the URL below into the "OCPP Server URL" field.',
              `Set "Station ID" to: ${charger.charger_id}`,
              'Set "Protocol" to: OCPP1.6J',
              'Save and reboot. The charger will appear Online above within 30 seconds.',
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#1e3a5f', color: '#93c5fd', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  {i + 1}
                </div>
                <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.6 }}>{step}</div>
              </div>
            ))}
          </div>

          {/* The URL itself — prominent */}
          <div style={{ background: '#0f1623', border: '1px solid #1e3a5f', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              OCPP URL — copy and paste this into the charger
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <code style={{ color: '#38bdf8', fontSize: 13, flex: 1, wordBreak: 'break-all', fontWeight: 600 }}>
                {ocppUrl}
              </code>
              <CopyButton text={ocppUrl} label='Copy URL' />
            </div>
          </div>

          {charger.connected && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
              <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 600 }}>
                This charger is already connected — configuration is working correctly.
              </span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: '#1c1a0b', border: '1px solid #3d3000', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ color: '#f59e0b', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
            ⚠ Server IP not set — the URL cannot be generated yet
          </div>
          <div style={{ color: '#92400e', fontSize: 12 }}>
            Click "Edit config" below, then under "Network / Connection" select the server IP. The URL will be generated automatically.
          </div>
        </div>
      )}

      {/* ── Expandable technical details ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{ background: 'none', border: 'none', color: '#475569', fontSize: 12, cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 4 }}
      >
        {expanded ? '▲' : '▼'} {expanded ? 'Hide' : 'Show'} technical details
      </button>

      {expanded && (
        <div style={{ marginTop: 12, background: '#0f1623', borderRadius: 8, padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px 24px' }}>
          {[
            ['Server IP configured', charger.server_host || '—'],
            ['Port', charger.server_port],
            ['Protocol', charger.tls_enabled ? 'wss:// (TLS)' : 'ws:// (plain)'],
            ['Heartbeat interval', `${charger.heartbeat_interval}s`],
            ['APN (4G SIM)', charger.apn || '—'],
            ['Back office password', charger.back_office_pass ? '••••••' : 'Not saved'],
            ['Last heartbeat', charger.last_seen ? new Date(charger.last_seen).toLocaleString('en-RW') : 'Never'],
            ['Connection type', charger.network_type === '4g' ? '4G SIM card' : 'LAN / Ethernet'],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>{k}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>{v}</div>
            </div>
          ))}
          {charger.notes && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>Notes</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3, whiteSpace: 'pre-wrap' }}>{charger.notes}</div>
            </div>
          )}
        </div>
      )}

      {/* ── Actions ── */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid #1e293b' }}>
        <button onClick={() => setEditing(true)} style={ghostBtn}>Edit config</button>
        <button
          onClick={handleDelete}
          disabled={deleting || charger.connected}
          title={charger.connected ? 'Cannot delete — charger is currently online' : ''}
          style={{ ...ghostBtn, color: '#ef4444', borderColor: '#ef444422', opacity: charger.connected ? 0.35 : 1 }}
        >
          {deleting ? 'Removing…' : 'Remove'}
        </button>
      </div>
    </div>
  )
}

// ─── charger form ─────────────────────────────────────────────────────────────

const BLANK = {
  charger_id: '', display_name: '', location: '',
  network_type: 'lan', server_host: '', server_port: '8887',
  tls_enabled: false, apn: '', heartbeat_interval: '60',
  connector_count: '2', back_office_pass: '', notes: '',
}

function ChargerForm({ initial = BLANK, serverInfo, onSave, onCancel, editMode = false }) {
  const [form, setForm] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  useEffect(() => {
    if (!editMode && !form.server_host && serverInfo?.lan_ips?.length) {
      setForm((f) => ({ ...f, server_host: serverInfo.lan_ips[0].address }))
    }
  }, [serverInfo, editMode])

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (editMode) {
        await client.put(`/chargers/${initial.charger_id}`, form)
      } else {
        await client.post('/chargers', form)
      }
      onSave()
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  const previewUrl = buildOcppUrl({
    tls_enabled: form.tls_enabled,
    server_host: form.server_host,
    server_port: form.server_port || 8887,
    charger_id: form.charger_id || '{CHARGER_ID}',
  })

  return (
    <form onSubmit={submit}>
      <div style={formSection}>About this machine</div>
      <div style={grid2}>
        <div>
          <label style={lbl}>Machine ID (Charger ID) <span style={req}>*</span></label>
          <input
            value={form.charger_id} onChange={set('charger_id')} required disabled={editMode}
            placeholder="KIGALI-DC160-001"
            style={{ ...inp, opacity: editMode ? 0.6 : 1 }}
          />
          <div style={hint}>The ID you will also set as "Station ID" in the charger's back office. Must be unique per machine.</div>
        </div>
        <div>
          <label style={lbl}>Display name</label>
          <input value={form.display_name} onChange={set('display_name')} placeholder="Charger 1 — Bay A" style={inp} />
        </div>
        <div>
          <label style={lbl}>Physical location</label>
          <input value={form.location} onChange={set('location')} placeholder="Simple Charge, Kigali" style={inp} />
        </div>
        <div>
          <label style={lbl}>Number of guns (charging points)</label>
          <select value={form.connector_count} onChange={set('connector_count')} style={inp}>
            <option value="1">1 gun — single connector</option>
            <option value="2">2 guns — dual connector (Gun A + Gun B)</option>
          </select>
          <div style={hint}>One gun = one vehicle can charge at a time. Most 160 kW units have 2 guns.</div>
        </div>
      </div>

      <div style={{ ...formSection, marginTop: 24 }}>How the charger connects to this server</div>
      <div style={grid2}>
        <div>
          <label style={lbl}>Connection type</label>
          <select value={form.network_type} onChange={set('network_type')} style={inp}>
            <option value="lan">LAN — same WiFi/router as this machine (testing)</option>
            <option value="4g">4G SIM — connects over mobile internet (production)</option>
          </select>
        </div>
        <div>
          <label style={lbl}>
            {form.network_type === '4g' ? 'Public IP or domain name of this server' : 'IP address of this machine (server)'} <span style={req}>*</span>
          </label>
          {serverInfo?.lan_ips?.length > 0 && form.network_type === 'lan' ? (
            <select value={form.server_host} onChange={set('server_host')} style={inp}>
              <option value="">— select —</option>
              {serverInfo.lan_ips.map((ip) => (
                <option key={ip.address} value={ip.address}>{ip.address}  ({ip.name})</option>
              ))}
              <option value="custom">Enter manually…</option>
            </select>
          ) : (
            <input value={form.server_host} onChange={set('server_host')}
              placeholder={form.network_type === '4g' ? 'e.g. evcsims.yourdomain.rw or 197.157.155.19' : '192.168.1.107'}
              style={inp} />
          )}
          {form.server_host === 'custom' && (
            <input value='' onChange={(e) => setForm((f) => ({ ...f, server_host: e.target.value }))}
              placeholder="Enter IP or hostname" style={{ ...inp, marginTop: 6 }} autoFocus />
          )}
        </div>
        <div>
          <label style={lbl}>OCPP port</label>
          <input type="number" value={form.server_port} onChange={set('server_port')} placeholder="8887" style={inp} />
          <div style={hint}>Default is 8887. Only change if you modified the server config.</div>
        </div>
        {form.network_type === '4g' && (
          <div>
            <label style={lbl}>SIM card APN</label>
            <input value={form.apn} onChange={set('apn')}
              placeholder="internet (MTN Rwanda) or web.airtel.rw" style={inp} />
            <div style={hint}>Ask MTN or Airtel Rwanda for the correct APN value.</div>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <input type="checkbox" id="tls" checked={form.tls_enabled} onChange={set('tls_enabled')} style={{ width: 16, height: 16 }} />
          <label htmlFor="tls" style={{ color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>
            Use TLS (<code style={{ color: '#38bdf8' }}>wss://</code>) — required for live/production deployments
          </label>
        </div>
      </div>

      {/* Live URL preview */}
      {previewUrl && (
        <div style={{ margin: '20px 0', background: '#0a1628', border: '1px solid #0ea5e944', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Generated URL — this is what you will type into the charger touchscreen
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <code style={{ color: '#38bdf8', fontSize: 13, flex: 1, wordBreak: 'break-all', fontWeight: 600 }}>{previewUrl}</code>
            <CopyButton text={previewUrl} label='Copy URL' />
          </div>
        </div>
      )}

      <div style={{ ...formSection, marginTop: 20 }}>Optional reference info (stored for your records)</div>
      <div style={grid2}>
        <div>
          <label style={lbl}>Heartbeat interval (seconds)</label>
          <input type="number" value={form.heartbeat_interval} onChange={set('heartbeat_interval')} placeholder="60" style={inp} />
        </div>
        <div>
          <label style={lbl}>Back office password</label>
          <input type="password" value={form.back_office_pass} onChange={set('back_office_pass')} placeholder="e.g. 000000" style={inp} />
          <div style={hint}>Saved here for reference only — not sent to the charger.</div>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <label style={lbl}>Notes</label>
        <textarea value={form.notes} onChange={set('notes')} rows={3}
          placeholder="e.g. SIM serial: RW-MTN-4492, APN confirmed 2026-05-30, bay is next to the main entrance…"
          style={{ ...inp, width: '100%', resize: 'vertical' }} />
      </div>

      {error && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button type="submit" disabled={loading} style={primaryBtn}>
          {loading ? 'Saving…' : editMode ? 'Save Changes' : 'Register Charger'}
        </button>
        <button type="button" onClick={onCancel} style={cancelBtn}>Cancel</button>
      </div>
    </form>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function Settings() {
  const [serverInfo, setServerInfo] = useState(null)
  const [chargers, setChargers] = useState([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [{ data: srv }, { data: chg }] = await Promise.all([
      client.get('/settings/server'),
      client.get('/chargers'),
    ])
    setServerInfo(srv)
    setChargers(chg)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 10000)
    return () => clearInterval(id)
  }, [load])

  if (loading) return <div style={{ color: '#64748b', marginTop: 40 }}>Loading…</div>

  return (
    <div style={{ maxWidth: 960 }}>
      <h1 style={{ color: '#e2e8f0', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Settings</h1>
      <p style={{ color: '#475569', fontSize: 13, marginBottom: 28 }}>
        Connect your physical charger machines to this system
      </p>

      <HowItWorks />

      <ServerSection serverInfo={serverInfo} />

      {/* ── Part B: Physical chargers ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>B</div>
          <div style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 700 }}>Your Physical Charger Machines</div>
        </div>
        <div style={{ color: '#475569', fontSize: 12, marginBottom: 16, paddingLeft: 34 }}>
          Each card below represents <strong style={{ color: '#94a3b8' }}>one physical charger machine</strong> (one box on-site).
          A machine with 2 guns can charge 2 vehicles at the same time — each gun is listed separately on the Dashboard.
          Add one card per machine you own.
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 18px' }}>
            <div style={statLabel}>Total machines</div>
            <div style={{ ...statVal, fontSize: 20 }}>{chargers.length}</div>
          </div>
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 18px' }}>
            <div style={statLabel}>Online now</div>
            <div style={{ ...statVal, fontSize: 20, color: '#22c55e' }}>{chargers.filter((c) => c.connected).length}</div>
          </div>
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 18px' }}>
            <div style={statLabel}>Total charging points (guns)</div>
            <div style={{ ...statVal, fontSize: 20 }}>{chargers.reduce((s, c) => s + c.connector_count, 0)}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              style={{ background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontWeight: 700 }}
            >
              {showAddForm ? '✕ Cancel' : '+ Register New Charger Machine'}
            </button>
          </div>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div style={{ ...card, marginBottom: 24, border: '1px solid #0ea5e944' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <span style={{ fontSize: 18 }}>🔌</span>
              <div>
                <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15 }}>Register a New Charger Machine</div>
                <div style={{ color: '#475569', fontSize: 12, marginTop: 2 }}>Fill in the details below. The OCPP URL will be generated automatically.</div>
              </div>
            </div>
            <ChargerForm
              serverInfo={serverInfo}
              onSave={() => { setShowAddForm(false); load() }}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        )}

        {/* Charger list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {chargers.length === 0 && !showAddForm && (
            <div style={{ textAlign: 'center', padding: '48px 24px', background: '#111827', border: '1px dashed #334155', borderRadius: 12 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔌</div>
              <div style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: 8 }}>No charger machines registered yet</div>
              <div style={{ color: '#475569', fontSize: 13, marginBottom: 20 }}>
                Click "Register New Charger Machine" to add your first charger.
              </div>
            </div>
          )}
          {chargers.map((c) => (
            <ChargerDeviceCard key={c.charger_id} charger={c} serverInfo={serverInfo} onRefresh={load} />
          ))}
        </div>
      </section>
    </div>
  )
}

// ─── shared styles ─────────────────────────────────────────────────────────────

const statLabel = { fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }
const statVal = { fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: '#e2e8f0' }
const subLabel = { fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }
const formSection = { fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #1e293b', paddingBottom: 6, marginBottom: 12 }
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }
const lbl = { display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }
const req = { color: '#ef4444' }
const hint = { fontSize: 11, color: '#475569', marginTop: 4 }
const inp = {
  width: '100%', padding: '8px 12px', background: '#0f1623',
  border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0',
  fontSize: 13, outline: 'none',
}
const card = { background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }
const primaryBtn = {
  background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 6,
  padding: '9px 20px', fontSize: 13, cursor: 'pointer', fontWeight: 600,
}
const cancelBtn = {
  background: 'none', color: '#94a3b8', border: '1px solid #334155',
  borderRadius: 6, padding: '9px 20px', fontSize: 13, cursor: 'pointer',
}
const ghostBtn = {
  background: 'none', border: '1px solid #334155', color: '#94a3b8',
  borderRadius: 4, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
}
const copyBtn = {
  background: '#1e293b', border: '1px solid #334155', color: '#94a3b8',
  borderRadius: 4, padding: '5px 14px', fontSize: 11, cursor: 'pointer',
  whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 600,
}
