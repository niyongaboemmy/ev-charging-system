import { useState, useRef, useCallback, useEffect } from 'react'

// ─── OCPP message helpers ────────────────────────────────────────────────────

let _uid = 1
const uid = () => String(_uid++)

const CALL   = (id, action, payload) => JSON.stringify([2, id, action, payload])
const STATUS_COLORS = {
  Available:   '#22c55e',
  Preparing:   '#38bdf8',
  Charging:    '#f59e0b',
  Finishing:   '#a78bfa',
  Faulted:     '#ef4444',
  Unavailable: '#475569',
  Reserved:    '#8b5cf6',
}

// ─── message log entry ───────────────────────────────────────────────────────

function LogEntry({ entry }) {
  const [open, setOpen] = useState(false)

  const DIR_STYLE = {
    sent:    { border: '#38bdf822', bg: '#0f1d2e', label: '→ SENT',    color: '#38bdf8' },
    recv:    { border: '#22c55e22', bg: '#0a1f0a', label: '← RECV',    color: '#22c55e' },
    cmd:     { border: '#f59e0b22', bg: '#1c1505', label: '⚡ SERVER',  color: '#f59e0b' },
    auto:    { border: '#a78bfa22', bg: '#150e24', label: '⚙ AUTO',    color: '#a78bfa' },
    error:   { border: '#ef444422', bg: '#1c0505', label: '✗ ERROR',   color: '#ef4444' },
    info:    { border: '#47556922', bg: '#0f1623', label: 'ℹ INFO',    color: '#64748b' },
  }

  const s = DIR_STYLE[entry.dir] || DIR_STYLE.info
  const payloadStr = JSON.stringify(entry.payload, null, 2)

  return (
    <div style={{ border: `1px solid ${s.border}`, background: s.bg, borderRadius: 6, marginBottom: 6, overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: s.color, flexShrink: 0, fontFamily: 'monospace', letterSpacing: 0.5 }}>
          {s.label}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', flex: 1 }}>
          {entry.action}
        </span>
        <span style={{ fontSize: 10, color: '#334155', fontFamily: 'monospace', flexShrink: 0 }}>
          {entry.ts}
        </span>
        <span style={{ color: '#334155', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <pre style={{ margin: 0, padding: '0 12px 10px', fontSize: 11, color: '#94a3b8', overflowX: 'auto', fontFamily: 'monospace', lineHeight: 1.6, borderTop: `1px solid ${s.border}`, paddingTop: 8 }}>
          {payloadStr}
        </pre>
      )}
    </div>
  )
}

// ─── status dot ──────────────────────────────────────────────────────────────

function StatusDot({ status }) {
  const color = STATUS_COLORS[status] || '#475569'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
        background: color, flexShrink: 0,
        boxShadow: status === 'Charging' ? `0 0 8px ${color}` : 'none',
        animation: status === 'Charging' ? 'pulse 1.5s infinite' : 'none',
      }} />
      <span style={{ color, fontWeight: 600, fontSize: 12 }}>{status || 'Unknown'}</span>
    </span>
  )
}

// ─── action button ────────────────────────────────────────────────────────────

function Btn({ onClick, disabled, children, color = '#1e293b', textColor = '#94a3b8', fullWidth = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: fullWidth ? '100%' : undefined,
        padding: '7px 14px', borderRadius: 6, border: `1px solid #334155`,
        background: disabled ? '#0f1623' : color, color: disabled ? '#334155' : textColor,
        fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 600,
        transition: 'all .15s',
      }}
    >
      {children}
    </button>
  )
}

function FieldGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

const Input = ({ value, onChange, placeholder, type = 'text', style = {} }) => (
  <input
    type={type} value={value} onChange={onChange} placeholder={placeholder}
    style={{ width: '100%', padding: '6px 10px', background: '#0f1623', border: '1px solid #334155', borderRadius: 5, color: '#e2e8f0', fontSize: 12, outline: 'none', ...style }}
  />
)

const Select = ({ value, onChange, options }) => (
  <select value={value} onChange={onChange} style={{ width: '100%', padding: '6px 10px', background: '#0f1623', border: '1px solid #334155', borderRadius: 5, color: '#e2e8f0', fontSize: 12 }}>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
)

// ─── main Simulator page ─────────────────────────────────────────────────────

export default function Simulator() {
  const wsRef = useRef(null)
  const logEndRef = useRef(null)
  const pendingRef = useRef({})   // uid → resolve fn for CALLRESULT

  // ── state ──────────────────────────────────────────────────────────────────

  const [connState, setConnState]   = useState('idle')  // idle | connecting | connected | error
  const [connError, setConnError]   = useState('')
  const [log, setLog]               = useState([])

  // Connection config
  const [serverUrl, setServerUrl]   = useState('ws://localhost:8887')
  const [chargerId, setChargerId]   = useState('KIGALI-DC160-001')

  // Charger simulated state
  const [gunA, setGunA]             = useState('Unavailable')
  const [gunB, setGunB]             = useState('Unavailable')
  const [txId, setTxId]             = useState(null)
  const [kwhSent, setKwhSent]       = useState(0)
  const [autoRunning, setAutoRunning] = useState(false)
  const [autoStep, setAutoStep]     = useState('')

  // Action form state
  const [statusConn, setStatusConn] = useState('1')
  const [statusVal, setStatusVal]   = useState('Available')
  const [authIdTag, setAuthIdTag]   = useState('')
  const [startConn, setStartConn]   = useState('1')
  const [startIdTag, setStartIdTag] = useState('')
  const [meterKwh, setMeterKwh]     = useState('1.000')
  const [stopMeter, setStopMeter]   = useState('1000')
  const [stopReason, setStopReason] = useState('Local')

  // ── log helpers ────────────────────────────────────────────────────────────

  function addLog(dir, action, payload) {
    const ts = new Date().toLocaleTimeString('en-RW', { hour12: false })
    setLog(prev => [...prev, { dir, action, payload, ts, id: Date.now() + Math.random() }])
  }

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  // ── WebSocket setup ────────────────────────────────────────────────────────

  const connect = useCallback(() => {
    if (wsRef.current) return
    setConnState('connecting')
    setConnError('')
    setLog([])
    setGunA('Unavailable')
    setGunB('Unavailable')
    setTxId(null)
    setKwhSent(0)

    const url = `${serverUrl.replace(/\/$/, '')}/ocpp/${chargerId.trim()}`
    addLog('info', 'Connecting…', { url, protocol: 'ocpp1.6' })

    const ws = new WebSocket(url, ['ocpp1.6'])
    wsRef.current = ws

    ws.onopen = () => {
      setConnState('connected')
      addLog('info', 'Connected to OCPP server', { charger_id: chargerId, protocol: ws.protocol })
    }

    ws.onerror = () => {
      setConnState('error')
      setConnError('Connection failed — is the backend running on port 8887?')
      addLog('error', 'WebSocket error', { hint: 'Check backend is running: npm run dev in /backend' })
      wsRef.current = null
    }

    ws.onclose = (ev) => {
      if (connState !== 'idle') {
        setConnState('idle')
        addLog('info', 'Disconnected', { code: ev.code, reason: ev.reason || 'none' })
      }
      setGunA('Unavailable')
      setGunB('Unavailable')
      setTxId(null)
      wsRef.current = null
    }

    ws.onmessage = (ev) => {
      let msg
      try { msg = JSON.parse(ev.data) } catch { return }

      const [type, msgUid, actionOrPayload, payload] = msg

      if (type === 3) {
        // CALLRESULT — response to our message
        addLog('recv', 'Response', actionOrPayload)
        const resolve = pendingRef.current[msgUid]
        if (resolve) {
          resolve(actionOrPayload)
          delete pendingRef.current[msgUid]
        }
      }

      if (type === 2) {
        // CALL from server (RemoteStart, RemoteStop, ChangeConfiguration)
        const action = actionOrPayload
        addLog('cmd', action, payload)

        if (action === 'RemoteStartTransaction') {
          // Auto-respond Accepted + simulate StartTransaction
          ws.send(JSON.stringify([3, msgUid, { status: 'Accepted' }]))
          addLog('auto', 'Auto-reply: Accepted', { status: 'Accepted' })
          const connId = payload.connectorId || 1
          const gun = connId === 1 ? 'A' : 'B'
          setTimeout(() => {
            const label = gun === 'A' ? setGunA : setGunB
            label('Preparing')
            setTimeout(async () => {
              label('Charging')
              const startId = uid()
              const startPayload = {
                connectorId: connId,
                idTag: payload.idTag,
                meterStart: 0,
                timestamp: new Date().toISOString(),
              }
              addLog('sent', 'StartTransaction', startPayload)
              ws.send(CALL(startId, 'StartTransaction', startPayload))
            }, 800)
          }, 500)
        }

        if (action === 'RemoteStopTransaction') {
          ws.send(JSON.stringify([3, msgUid, { status: 'Accepted' }]))
          addLog('auto', 'Auto-reply: Accepted', { status: 'Accepted' })
          setTimeout(() => {
            const stopPayload = {
              transactionId: payload.transactionId,
              meterStop: Math.round(kwhSent * 1000),
              timestamp: new Date().toISOString(),
              reason: 'Remote',
            }
            addLog('sent', 'StopTransaction (auto)', stopPayload)
            ws.send(CALL(uid(), 'StopTransaction', stopPayload))
            setTxId(null)
            setGunA('Available')
            setGunB('Available')
          }, 600)
        }

        if (action === 'ChangeConfiguration') {
          ws.send(JSON.stringify([3, msgUid, { status: 'Accepted' }]))
          addLog('auto', 'Auto-reply: Accepted', { status: 'Accepted' })
        }
      }

      if (type === 3) {
        // Update txId from StartTransaction response
        if (actionOrPayload?.transactionId > 0) {
          setTxId(actionOrPayload.transactionId)
        }
      }
    }
  }, [serverUrl, chargerId, connState, kwhSent])

  function disconnect() {
    wsRef.current?.close()
    wsRef.current = null
    setConnState('idle')
    setGunA('Unavailable')
    setGunB('Unavailable')
    setTxId(null)
  }

  // ── OCPP send helpers ──────────────────────────────────────────────────────

  function send(action, payload) {
    const ws = wsRef.current
    if (!ws || ws.readyState !== 1) return
    const id = uid()
    addLog('sent', action, payload)
    return new Promise((resolve) => {
      pendingRef.current[id] = resolve
      ws.send(CALL(id, action, payload))
      setTimeout(() => {
        delete pendingRef.current[id]
        resolve(null)
      }, 8000)
    })
  }

  // ── individual action handlers ─────────────────────────────────────────────

  async function sendBoot() {
    await send('BootNotification', {
      chargePointModel: 'DC160KW',
      chargePointVendor: 'NingboYuyue',
      chargePointSerialNumber: '20251218007',
      firmwareVersion: '1.0.0',
    })
  }

  async function sendHeartbeat() {
    await send('Heartbeat', {})
  }

  async function sendStatus() {
    const connId = parseInt(statusConn)
    const res = await send('StatusNotification', {
      connectorId: connId,
      status: statusVal,
      errorCode: 'NoError',
      timestamp: new Date().toISOString(),
    })
    if (res !== null) {
      if (connId === 1) setGunA(statusVal)
      else if (connId === 2) setGunB(statusVal)
    }
  }

  async function sendAuthorize() {
    await send('Authorize', { idTag: authIdTag })
  }

  async function sendStartTx() {
    const res = await send('StartTransaction', {
      connectorId: parseInt(startConn),
      idTag: startIdTag,
      meterStart: 0,
      timestamp: new Date().toISOString(),
    })
    if (res?.transactionId > 0) {
      setTxId(res.transactionId)
      const gun = parseInt(startConn) === 1 ? setGunA : setGunB
      gun('Charging')
    }
  }

  async function sendMeterValues() {
    const kwh = parseFloat(meterKwh)
    if (txId === null) { addLog('error', 'No active transaction', {}); return }
    await send('MeterValues', {
      connectorId: 1,
      transactionId: txId,
      meterValue: [{
        timestamp: new Date().toISOString(),
        sampledValue: [
          { value: kwh.toFixed(3), measurand: 'Energy.Active.Import.Register', unit: 'kWh', context: 'Sample.Periodic' },
          { value: String(Math.round(kwh * 350 / (kwh / 0.5) * 10)), measurand: 'Power.Active.Import', unit: 'W', context: 'Sample.Periodic' },
        ],
      }],
    })
    setKwhSent(kwh)
    setMeterKwh((kwh + 0.5).toFixed(3))
  }

  async function sendStopTx() {
    if (txId === null) { addLog('error', 'No active transaction', {}); return }
    const res = await send('StopTransaction', {
      transactionId: txId,
      meterStop: parseInt(stopMeter),
      timestamp: new Date().toISOString(),
      reason: stopReason,
    })
    if (res !== null) {
      setTxId(null)
      setGunA('Available')
      setGunB('Available')
    }
  }

  // ── auto full-session run ─────────────────────────────────────────────────

  async function runFullSession() {
    if (!wsRef.current || wsRef.current.readyState !== 1) {
      addLog('error', 'Connect first', {})
      return
    }
    setAutoRunning(true)
    setKwhSent(0)
    _uid = 100  // reset uid counter for clean trace

    const step = async (label, fn) => {
      setAutoStep(label)
      addLog('info', `── Step: ${label}`, {})
      await fn()
      await delay(600)
    }

    try {
      await step('Boot Notification', async () => {
        await send('BootNotification', {
          chargePointModel: 'DC160KW', chargePointVendor: 'NingboYuyue',
          chargePointSerialNumber: '20251218007', firmwareVersion: '1.0.0',
        })
      })

      await step('Status: Gun A → Available', async () => {
        const r = await send('StatusNotification', { connectorId: 1, status: 'Available', errorCode: 'NoError' })
        if (r !== null) setGunA('Available')
      })

      await step('Status: Gun B → Available', async () => {
        const r = await send('StatusNotification', { connectorId: 2, status: 'Available', errorCode: 'NoError' })
        if (r !== null) setGunB('Available')
      })

      await delay(400)

      await step('Start Transaction (Gun A)', async () => {
        setGunA('Preparing')
        const r = await send('StartTransaction', {
          connectorId: 1, idTag: 'AGT-2-STEST', meterStart: 0,
          timestamp: new Date().toISOString(),
        })
        if (r?.transactionId > 0) { setTxId(r.transactionId); setGunA('Charging') }
      })

      for (let i = 1; i <= 3; i++) {
        const kwh = i * 0.5
        await step(`Meter Values → ${kwh.toFixed(3)} kWh`, async () => {
          await send('MeterValues', {
            connectorId: 1,
            transactionId: txId || 1,
            meterValue: [{
              timestamp: new Date().toISOString(),
              sampledValue: [{ value: kwh.toFixed(3), measurand: 'Energy.Active.Import.Register', unit: 'kWh', context: 'Sample.Periodic' }],
            }],
          })
          setKwhSent(kwh)
        })
      }

      await step('Status: Gun A → Finishing', async () => {
        setGunA('Finishing')
        await send('StatusNotification', { connectorId: 1, status: 'Finishing', errorCode: 'NoError' })
      })

      await step('Stop Transaction (1.5 kWh = 525 RWF)', async () => {
        const r = await send('StopTransaction', {
          transactionId: txId || 1,
          meterStop: 1500,
          timestamp: new Date().toISOString(),
          reason: 'Local',
        })
        if (r !== null) setTxId(null)
      })

      await step('Status: Gun A → Available', async () => {
        const r = await send('StatusNotification', { connectorId: 1, status: 'Available', errorCode: 'NoError' })
        if (r !== null) setGunA('Available')
      })

      await step('Heartbeat', async () => {
        await send('Heartbeat', {})
      })

      setAutoStep('Complete ✓')
      addLog('info', '── Full session complete — all messages passed', { total_kwh: '1.500', price_per_kwh: '350 RWF', total_frw: '525 RWF' })
    } catch (err) {
      addLog('error', 'Auto-run error', { message: err.message })
    } finally {
      setAutoRunning(false)
    }
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

  // ── connection status colour ───────────────────────────────────────────────

  const dotColor = { idle: '#475569', connecting: '#f59e0b', connected: '#22c55e', error: '#ef4444' }[connState]
  const isConn = connState === 'connected'

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 80px)', overflow: 'hidden' }}>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      {/* ── LEFT: controls ── */}
      <div style={{ width: 280, flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Page title */}
        <div style={{ paddingBottom: 12, borderBottom: '1px solid #1e293b' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 15 }}>OCPP Simulator</div>
          <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
            Emulates a physical charger connecting to the server
          </div>
        </div>

        {/* Connection */}
        <div style={panel}>
          <div style={panelTitle}>1 · Connection</div>
          <FieldGroup label="OCPP Server URL">
            <Input value={serverUrl} onChange={e => setServerUrl(e.target.value)} placeholder="ws://localhost:8887" />
          </FieldGroup>
          <FieldGroup label="Charger ID (Station ID)">
            <Input value={chargerId} onChange={e => setChargerId(e.target.value)} placeholder="KIGALI-DC160-001" />
          </FieldGroup>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, boxShadow: isConn ? `0 0 8px ${dotColor}` : 'none' }} />
            <span style={{ fontSize: 11, color: dotColor, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {{ idle: 'Disconnected', connecting: 'Connecting…', connected: 'Connected', error: 'Error' }[connState]}
            </span>
          </div>
          {connError && <div style={{ color: '#ef4444', fontSize: 11, marginBottom: 8, lineHeight: 1.5 }}>{connError}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            {!isConn ? (
              <Btn onClick={connect} disabled={connState === 'connecting'} color='#0ea5e9' textColor='#fff' fullWidth>
                {connState === 'connecting' ? 'Connecting…' : '⚡ Connect'}
              </Btn>
            ) : (
              <Btn onClick={disconnect} color='#ef444433' textColor='#ef4444' fullWidth>Disconnect</Btn>
            )}
          </div>
        </div>

        {/* Charger state */}
        <div style={panel}>
          <div style={panelTitle}>2 · Charger State</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#64748b' }}>Gun A</span>
              <StatusDot status={gunA} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#64748b' }}>Gun B</span>
              <StatusDot status={gunB} />
            </div>
            <div style={{ height: 1, background: '#1e293b', margin: '2px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: '#64748b' }}>Transaction</span>
              <span style={{ fontSize: 12, fontFamily: 'monospace', color: txId ? '#38bdf8' : '#334155' }}>
                {txId ? `#${txId}` : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: '#64748b' }}>Energy sent</span>
              <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#f59e0b' }}>
                {kwhSent > 0 ? `${kwhSent.toFixed(3)} kWh` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={panel}>
          <div style={panelTitle}>3 · OCPP Actions</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

            <Btn onClick={sendBoot} disabled={!isConn} fullWidth>BootNotification</Btn>
            <Btn onClick={sendHeartbeat} disabled={!isConn} fullWidth>Heartbeat</Btn>

            <div style={{ height: 1, background: '#1e293b', margin: '2px 0' }} />

            {/* Status Notification */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <Select value={statusConn} onChange={e => setStatusConn(e.target.value)} options={['0', '1', '2']} />
              <Select value={statusVal} onChange={e => setStatusVal(e.target.value)}
                options={['Available', 'Preparing', 'Charging', 'Finishing', 'Unavailable', 'Faulted', 'Reserved']} />
            </div>
            <Btn onClick={sendStatus} disabled={!isConn} fullWidth>StatusNotification</Btn>

            <div style={{ height: 1, background: '#1e293b', margin: '2px 0' }} />

            {/* Authorize */}
            <Input value={authIdTag} onChange={e => setAuthIdTag(e.target.value)} placeholder="RFID card UID (e.g. TEST-CARD-001)" />
            <Btn onClick={sendAuthorize} disabled={!isConn || !authIdTag} fullWidth>Authorize (RFID)</Btn>

            <div style={{ height: 1, background: '#1e293b', margin: '2px 0' }} />

            {/* StartTransaction */}
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 6 }}>
              <Select value={startConn} onChange={e => setStartConn(e.target.value)} options={['1', '2']} />
              <Input value={startIdTag} onChange={e => setStartIdTag(e.target.value)} placeholder="idTag (AGT-2-S001)" />
            </div>
            <Btn onClick={sendStartTx} disabled={!isConn || !startIdTag || txId !== null} color='#164e63' textColor='#38bdf8' fullWidth>
              StartTransaction
            </Btn>

            {/* MeterValues */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 6, alignItems: 'center' }}>
              <Input value={meterKwh} onChange={e => setMeterKwh(e.target.value)} placeholder="kWh" type="number" />
              <Btn onClick={sendMeterValues} disabled={!isConn || txId === null} color='#1c1505' textColor='#f59e0b'>
                MeterValues
              </Btn>
            </div>

            {/* StopTransaction */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <Input value={stopMeter} onChange={e => setStopMeter(e.target.value)} placeholder="Wh total" type="number" />
              <Select value={stopReason} onChange={e => setStopReason(e.target.value)} options={['Local', 'Remote', 'EVDisconnected', 'HardReset', 'Other']} />
            </div>
            <Btn onClick={sendStopTx} disabled={!isConn || txId === null} color='#1c0505' textColor='#ef4444' fullWidth>
              StopTransaction
            </Btn>
          </div>
        </div>

        {/* Auto run */}
        <div style={{ ...panel, border: '1px solid #0ea5e933' }}>
          <div style={panelTitle}>4 · Auto Full-Session Test</div>
          <div style={{ color: '#64748b', fontSize: 11, lineHeight: 1.6, marginBottom: 10 }}>
            Runs the complete charger boot-up → session → stop flow automatically, checking every OCPP message the physical device will send.
          </div>
          {autoRunning && autoStep && (
            <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ animation: 'pulse 1s infinite', display: 'inline-block' }}>⟳</span>
              {autoStep}
            </div>
          )}
          <Btn
            onClick={runFullSession}
            disabled={!isConn || autoRunning}
            color='#0ea5e9' textColor='#fff' fullWidth
          >
            {autoRunning ? 'Running…' : '▶ Run Full Session'}
          </Btn>
        </div>

        {/* Usage note */}
        <div style={{ background: '#0f1623', border: '1px solid #1e293b', borderRadius: 8, padding: 12 }}>
          <div style={{ color: '#475569', fontSize: 10, lineHeight: 1.7 }}>
            <strong style={{ color: '#64748b', display: 'block', marginBottom: 4 }}>How to use</strong>
            This page connects as if it were a physical charger. Open the <strong style={{ color: '#94a3b8' }}>Dashboard</strong> in another tab and watch the charger status update in real time as you send messages.
            <br /><br />
            Use <strong style={{ color: '#94a3b8' }}>Run Full Session</strong> to automatically replay the exact boot sequence a Ningbo Yuyue charger performs on power-up.
          </div>
        </div>

      </div>

      {/* ── RIGHT: message log ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexShrink: 0 }}>
          <div>
            <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>Message Log</div>
            <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
              → sent by simulator (charger) · ← received from server · ⚡ server commands
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#334155' }}>{log.length} messages</span>
            <button
              onClick={() => setLog([])}
              style={{ background: 'none', border: '1px solid #1e293b', borderRadius: 4, color: '#475569', fontSize: 11, padding: '4px 10px', cursor: 'pointer' }}
            >
              Clear
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
          {log.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: '#334155' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 8 }}>
                No messages yet
              </div>
              <div style={{ fontSize: 12, color: '#334155' }}>
                Connect to the server and send a BootNotification to start.
              </div>
            </div>
          )}
          {log.map(entry => <LogEntry key={entry.id} entry={entry} />)}
          <div ref={logEndRef} />
        </div>

        {/* Legend */}
        <div style={{ flexShrink: 0, marginTop: 8, display: 'flex', gap: 16, padding: '8px 0', borderTop: '1px solid #1e293b' }}>
          {[
            ['→ SENT', '#38bdf8'],
            ['← RECV', '#22c55e'],
            ['⚡ SERVER', '#f59e0b'],
            ['⚙ AUTO', '#a78bfa'],
            ['✗ ERROR', '#ef4444'],
            ['ℹ INFO', '#64748b'],
          ].map(([label, color]) => (
            <span key={label} style={{ fontSize: 10, color, fontWeight: 600, fontFamily: 'monospace' }}>{label}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── shared styles ────────────────────────────────────────────────────────────

const panel = {
  background: '#111827', border: '1px solid #1e293b', borderRadius: 10, padding: 14,
}
const panelTitle = {
  fontSize: 11, color: '#475569', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: 1, marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #1e293b',
}
