import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'

// ─── step definitions ────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 'system',
    title: 'System is running',
    summary: 'Backend server and database are up.',
    done: () => true, // always true if the UI loaded
    instructions: [
      'The EVCSIMS backend is running on port 3001 (REST API) and port 8887 (OCPP WebSocket).',
      'The MySQL database is connected and all tables are ready.',
      'You are logged in and authenticated — this step is always complete.',
    ],
  },
  {
    id: 'charger_configured',
    title: 'Configure charger connection',
    summary: 'Set the server IP each charger should connect to.',
    action: { label: 'Open Settings', path: '/settings' },
    instructions: [
      'Go to Settings → Charger Devices.',
      'Click "Edit config" on each charger row.',
      'Under "Network / Connection", select the server IP from the dropdown (your LAN IP is pre-filled).',
      'Save — the OCPP URL is generated automatically.',
      'This URL is what you will type into the charger\'s Back Office touchscreen.',
    ],
    detail: 'The OCPP URL tells the charger hardware where to connect. It must match the IP of this machine on your network.',
  },
  {
    id: 'agent_created',
    title: 'Create an agent account',
    summary: 'Add at least one operator who will run charging sessions.',
    action: { label: 'Manage Operators', path: '/operators' },
    instructions: [
      'Go to Operators → click "+ Add Operator".',
      'Fill in: Full Name, Email address, Password, Role = "agent".',
      'Click "Create Operator". The agent can log in immediately.',
      'Repeat for each staff member who will operate the chargers.',
    ],
    detail: 'Agents are the people who physically start and stop sessions. Each agent gets their own kWh quota so usage can be tracked per person.',
  },
  {
    id: 'quota_allocated',
    title: 'Allocate kWh quota to agent',
    summary: 'Give at least one agent a charging quota before sessions can start.',
    action: { label: 'Manage Allocations', path: '/allocations' },
    instructions: [
      'Go to Allocations → click "+ Add Allocation".',
      'Select the agent from the dropdown.',
      'Enter kWh to allocate (e.g. 100) and price per kWh (e.g. 350 RWF).',
      'Click "Allocate kWh". The agent\'s quota is now active.',
      'The progress bar on their card will track usage vs. the quota in real time.',
    ],
    detail: 'A session cannot start if the selected agent has zero remaining kWh. Top up allocations any time.',
  },
  {
    id: 'charger_online',
    title: 'Connect the charger hardware',
    summary: 'The charger should appear Online once its OCPP URL is configured and it reboots.',
    action: { label: 'Check Settings', path: '/settings' },
    instructions: [
      'On the charger touchscreen, enter the Back Office (hold the top-right corner or enter your back-office password).',
      'Navigate to Network Settings → OCPP Settings.',
      'Paste the OCPP URL from the Settings page (e.g. ws://192.168.1.107:8887/ocpp/KIGALI-DC160-001).',
      'Set Protocol to "OCPP1.6J" and Station ID to "KIGALI-DC160-001".',
      'Save and reboot the charger.',
      'After 10–30 seconds, the charger card on the Dashboard will show a green "Online" dot.',
      'The Status Notification will update Gun A and Gun B to "Available".',
    ],
    detail: 'If the charger shows Unavailable after rebooting, check: (1) same LAN network, (2) correct IP and port, (3) Protocol field is "OCPP1.6J" not "OCPP1.5".',
  },
  {
    id: 'first_session',
    title: 'Start your first charging session',
    summary: 'Initiate a session from the Dashboard to verify the full flow end-to-end.',
    action: { label: 'Go to Dashboard', path: '/dashboard' },
    instructions: [
      'On the Dashboard, find the charger with an "Available" gun (green dot).',
      'Click the "Start" button next to Gun A or Gun B.',
      'Select the agent from the dropdown, optionally set a budget in RWF.',
      'Click "Start Charging" — the system sends a RemoteStart command to the charger.',
      'The gun status changes: Available → Preparing → Charging (amber, pulsing).',
      'A live counter appears showing kWh consumed, total RWF, and elapsed time.',
      'To stop: click "Stop" on the same gun. The session completes and is ready for invoicing.',
    ],
    detail: 'The first session confirms the full OCPP flow: RemoteStart → StartTransaction → MeterValues → StopTransaction.',
  },
]

// ─── operations guide (shown once all setup steps are done) ─────────────────

const OPS_TIPS = [
  {
    icon: '⚡',
    title: 'Live Dashboard',
    body: 'The Dashboard auto-refreshes every 15 s. Gun status, live kWh counters, and heartbeat timestamps update automatically — no page reload needed.',
  },
  {
    icon: '🧾',
    title: 'Generating invoices',
    body: 'After a session completes, go to Sessions, find the row and click "Invoice". Enter the customer name and click "Generate & Download PDF". The PDF is stored on the server for re-download any time.',
  },
  {
    icon: '📊',
    title: 'Monthly reports',
    body: 'Go to Reports → Monthly Sales. Select year and month to see kWh sold, revenue, sessions per day chart, and breakdown per agent. The Inventory tab shows remaining kWh stock.',
  },
  {
    icon: '🔋',
    title: 'Topping up quota',
    body: 'When an agent\'s progress bar turns red (>90% used), go to Allocations and add a new allocation. Sessions are blocked automatically when quota reaches zero.',
  },
  {
    icon: '📡',
    title: 'Adding more chargers',
    body: 'Go to Settings → Add Charger. Enter the charger ID, display name, and network type. The OCPP URL is generated instantly. Configure it on the new charger\'s back office to bring it online.',
  },
  {
    icon: '🔴',
    title: 'Charger goes offline',
    body: 'If a charger drops offline mid-session, the session stays "active" in the DB. Once connectivity is restored, the charger will send a StopTransaction. If it doesn\'t, contact the system administrator to close the session manually.',
  },
]

// ─── helpers ─────────────────────────────────────────────────────────────────

function StepIcon({ status }) {
  if (status === 'done') {
    return (
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>✓</span>
      </div>
    )
  }
  if (status === 'current') {
    return (
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 10px #0ea5e966' }}>
        <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>→</span>
      </div>
    )
  }
  return (
    <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#334155' }} />
    </div>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export default function SetupGuide() {
  const navigate = useNavigate()
  const [completion, setCompletion] = useState({})
  const [expanded, setExpanded] = useState(null)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('guide_collapsed') === '1')
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('guide_dismissed') === '1')
  const [loading, setLoading] = useState(true)

  const checkSteps = useCallback(async () => {
    try {
      const [chargersRes, usersRes, allocRes, sessionsRes] = await Promise.all([
        client.get('/chargers'),
        client.get('/users'),
        client.get('/allocations'),
        client.get('/sessions?limit=1'),
      ])

      const chargers = chargersRes.data
      const users = usersRes.data
      const allocs = allocRes.data
      const sessions = sessionsRes.data

      setCompletion({
        system: true,
        charger_configured: chargers.some((c) => c.server_host),
        agent_created: users.some((u) => u.role === 'agent' && u.is_active),
        quota_allocated: allocs.length > 0,
        charger_online: chargers.some((c) => c.connected),
        first_session: sessions.total > 0,
      })
    } catch (_) {}
    setLoading(false)
  }, [])

  useEffect(() => {
    checkSteps()
    const id = setInterval(checkSteps, 15000)
    return () => clearInterval(id)
  }, [checkSteps])

  if (loading) return null

  const allDone = STEPS.every((s) => completion[s.id])

  // Find the first incomplete step index to mark as "current"
  const currentIdx = STEPS.findIndex((s) => !completion[s.id])

  function getStatus(step, idx) {
    if (completion[step.id]) return 'done'
    if (idx === currentIdx) return 'current'
    return 'pending'
  }

  const doneCount = STEPS.filter((s) => completion[s.id]).length
  const pct = Math.round((doneCount / STEPS.length) * 100)

  if (dismissed && allDone) return null

  // ── "All done" operations guide ──────────────────────────────────────────
  if (allDone) {
    return (
      <div style={guideCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ color: '#22c55e', fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
              ✓ Setup complete
            </div>
            <div style={{ color: '#e2e8f0', fontSize: 17, fontWeight: 700 }}>
              Quick reference — daily operations
            </div>
          </div>
          <button
            onClick={() => { setDismissed(true); localStorage.setItem('guide_dismissed', '1') }}
            style={dimBtn}
          >
            Dismiss
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {OPS_TIPS.map((tip) => (
            <div key={tip.title} style={{ background: '#0f1623', border: '1px solid #1e293b', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>{tip.icon}</div>
              <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{tip.title}</div>
              <div style={{ color: '#64748b', fontSize: 12, lineHeight: 1.6 }}>{tip.body}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Setup steps guide ────────────────────────────────────────────────────
  return (
    <div style={guideCard}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: collapsed ? 0 : 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 700 }}>
              Getting started — setup guide
            </div>
            <span style={{ background: '#0ea5e922', color: '#0ea5e9', fontSize: 11, padding: '2px 10px', borderRadius: 12, fontWeight: 600 }}>
              {doneCount}/{STEPS.length} done
            </span>
          </div>
          {!collapsed && (
            <div style={{ color: '#475569', fontSize: 12, marginTop: 4 }}>
              Complete each step below to go from zero to a live charging session.
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
          <button
            onClick={() => { const v = !collapsed; setCollapsed(v); localStorage.setItem('guide_collapsed', v ? '1' : '0') }}
            style={dimBtn}
          >
            {collapsed ? 'Expand ▼' : 'Collapse ▲'}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {!collapsed && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ background: '#1e293b', borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #0ea5e9, #22c55e)', borderRadius: 4, transition: 'width .4s ease' }} />
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>{pct}% complete</div>
        </div>
      )}

      {/* Step list */}
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {STEPS.map((step, idx) => {
            const status = getStatus(step, idx)
            const isExpanded = expanded === step.id
            const isCurrent = status === 'current'

            return (
              <div
                key={step.id}
                style={{
                  border: `1px solid ${isCurrent ? '#0ea5e944' : '#1e293b'}`,
                  borderRadius: 8,
                  background: isCurrent ? '#0ea5e908' : 'transparent',
                  overflow: 'hidden',
                  transition: 'border-color .2s',
                }}
              >
                {/* Step header row */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : step.id)}
                  disabled={status === 'pending' && !isExpanded}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', background: 'none', border: 'none',
                    cursor: status === 'pending' ? 'default' : 'pointer', textAlign: 'left',
                  }}
                >
                  <StepIcon status={status} />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600,
                      color: status === 'done' ? '#64748b' : status === 'current' ? '#e2e8f0' : '#475569',
                      textDecoration: status === 'done' ? 'line-through' : 'none',
                    }}>
                      Step {idx + 1}: {step.title}
                    </div>
                    {!isExpanded && (
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{step.summary}</div>
                    )}
                  </div>
                  {(status === 'done' || status === 'current') && (
                    <span style={{ color: '#475569', fontSize: 12, flexShrink: 0 }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  )}
                </button>

                {/* Expanded instructions */}
                {isExpanded && (
                  <div style={{ padding: '0 14px 16px 54px' }}>
                    {step.detail && (
                      <div style={{ fontSize: 12, color: '#64748b', background: '#0f1623', border: '1px solid #1e293b', borderRadius: 6, padding: '10px 12px', marginBottom: 14, lineHeight: 1.6 }}>
                        {step.detail}
                      </div>
                    )}
                    <ol style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {step.instructions.map((line, i) => (
                        <li key={i} style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.6 }}>
                          {line}
                        </li>
                      ))}
                    </ol>
                    {step.action && status !== 'done' && (
                      <button
                        onClick={() => navigate(step.action.path)}
                        style={{
                          marginTop: 14, background: '#0ea5e9', color: '#fff',
                          border: 'none', borderRadius: 6, padding: '8px 18px',
                          fontSize: 12, cursor: 'pointer', fontWeight: 600,
                        }}
                      >
                        {step.action.label} →
                      </button>
                    )}
                    {status === 'done' && (
                      <div style={{ marginTop: 12, color: '#22c55e', fontSize: 12, fontWeight: 600 }}>
                        ✓ This step is complete
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Footer hint */}
      {!collapsed && !allDone && (
        <div style={{ marginTop: 16, fontSize: 11, color: '#334155', textAlign: 'right' }}>
          This guide auto-updates as you complete each step.
        </div>
      )}
    </div>
  )
}

const guideCard = {
  background: '#111827',
  border: '1px solid #1e293b',
  borderRadius: 12,
  padding: 24,
  marginBottom: 28,
}

const dimBtn = {
  background: 'none',
  border: '1px solid #1e293b',
  borderRadius: 6,
  color: '#475569',
  fontSize: 12,
  padding: '5px 12px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
