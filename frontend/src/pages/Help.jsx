import { useState, useEffect, useRef } from 'react'

// ─── manual content ───────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: 'overview',
    title: '1. System Overview',
    content: () => (
      <>
        <P>EVCSIMS is the management software for DC fast-chargers at Simple Charge, Kigali. It connects to chargers in real time using the OCPP 1.6J protocol and lets operators start and stop charging sessions, track energy consumption, manage agent quotas, and produce invoices — all from a web browser.</P>
        <Callout color='#38bdf8'>
          <strong>How it all connects:</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {[
              { icon: '🔌', label: 'Physical Charger', sub: 'Hardware on-site' },
              { arrow: '→ OCPP WebSocket :8887 →' },
              { icon: '🖥', label: 'This Server', sub: 'Backend on this machine' },
              { arrow: '→ REST API :3001 →' },
              { icon: '📊', label: 'Dashboard', sub: 'Your browser' },
            ].map((item, i) =>
              item.arrow ? (
                <span key={i} style={{ color: '#475569', fontSize: 11 }}>{item.arrow}</span>
              ) : (
                <div key={i} style={{ background: '#0f1623', border: '1px solid #1e293b', borderRadius: 6, padding: '8px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20 }}>{item.icon}</div>
                  <div style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 600, marginTop: 4 }}>{item.label}</div>
                  <div style={{ color: '#475569', fontSize: 10 }}>{item.sub}</div>
                </div>
              )
            )}
          </div>
        </Callout>
        <H3>Default hardware registered</H3>
        <Table
          headers={['Unit', 'Machine ID', 'Guns', 'Serial Number']}
          rows={[
            ['Charger 1 — Bay A', 'KIGALI-DC160-001', 'A + B', '20251218007'],
            ['Charger 2 — Bay B', 'KIGALI-DC160-002', 'A + B', '20251218008'],
          ]}
        />
        <P>You can register additional charger machines at any time through the <strong>Settings</strong> page.</P>
      </>
    ),
  },
  {
    id: 'roles',
    title: '2. Roles & Permissions',
    content: () => (
      <>
        <P>Every account has one of three roles that controls which pages and actions are available.</P>
        <Table
          headers={['Feature', 'Admin', 'Accountant', 'Agent']}
          rows={[
            ['Dashboard & live status', '✓', '✓', '✓'],
            ['Setup guide & Help', '✓', '✓', '✓'],
            ['Start / stop sessions', '✓', '—', '✓ (own quota)'],
            ['View sessions', '✓ all', '✓ all', 'Own only'],
            ['Generate & download invoices', '✓', '✓', 'Own only'],
            ['Monthly reports', '✓', '✓', '—'],
            ['Manage operators', '✓', '—', '—'],
            ['Manage kWh allocations', '✓', '—', '—'],
            ['Settings — charger config', '✓', '—', '—'],
          ]}
        />
        <Callout color='#f59e0b'>Admin is the only role that can register charger machines, create users, and assign kWh quotas. Always keep at least one active admin account.</Callout>
      </>
    ),
  },
  {
    id: 'login',
    title: '3. Logging In',
    content: () => (
      <>
        <Steps steps={[
          'Open a web browser and go to the system URL.',
          'Enter your email address and password.',
          'Click Sign In.',
        ]} />
        <P>Your login token is stored in the browser and stays valid for <strong>8 hours</strong>. After that you are automatically redirected to the login page.</P>
        <H3>Default admin account</H3>
        <Table
          headers={['Email', 'Password']}
          rows={[['admin@simplecharge.rw', 'Admin@1234']]}
        />
        <Callout color='#ef4444'>
          <strong>Change the default password immediately</strong> after first login. Go to <strong>Operators → Admin account → Edit</strong> and set a strong new password. The default credential is publicly known and must not remain in production.
        </Callout>
      </>
    ),
  },
  {
    id: 'setup',
    title: '4. First-Time Setup Guide',
    content: () => (
      <>
        <P>When you log in for the first time, the Dashboard shows a <strong>Getting Started</strong> panel that walks through six steps. Steps are detected automatically — as you complete each one it turns green and the next step becomes active.</P>
        <Table
          headers={['Step', 'What to do', 'How it is detected']}
          rows={[
            ['1', 'System is running', 'Always complete — you are logged in'],
            ['2', 'Configure charger OCPP URL', 'At least one charger has a server IP saved in Settings'],
            ['3', 'Create an agent account', 'At least one active user with role = agent'],
            ['4', 'Allocate kWh quota', 'At least one allocation record exists'],
            ['5', 'Connect the charger hardware', 'At least one charger shows Online'],
            ['6', 'Start your first session', 'At least one session has been created'],
          ]}
        />
        <P>Each step expands with numbered instructions and a direct navigation button. The guide rechecks every 15 seconds. Once all six steps are complete the panel becomes a <strong>Quick Reference</strong> tile grid. You can collapse or dismiss the guide at any time.</P>
      </>
    ),
  },
  {
    id: 'dashboard',
    title: '5. Dashboard',
    content: () => (
      <>
        <P>The Dashboard is the primary operational view. It auto-refreshes every 15 seconds.</P>
        <H3>Summary metrics</H3>
        <Table
          headers={['Metric', 'Description']}
          rows={[
            ['Sessions This Month', 'Total completed sessions in the current calendar month'],
            ['Total Energy Sold', 'kWh delivered to vehicles this month'],
            ['Total Revenue', 'RWF collected this month'],
            ['Online Chargers', 'X / Y — chargers currently connected out of total registered'],
          ]}
        />
        <H3>Charger card</H3>
        <P>One card per physical charger machine. Each card shows:</P>
        <ul style={{ color: '#94a3b8', fontSize: 13, lineHeight: 2, paddingLeft: 20 }}>
          <li><strong style={{ color: '#e2e8f0' }}>Online / Offline badge</strong> — green dot when connected, red "Offline" badge when not</li>
          <li><strong style={{ color: '#e2e8f0' }}>Last heartbeat</strong> — relative time ("Just now", "2m ago"). Turns <span style={{ color: '#ef4444' }}>red</span> when &gt; 3 minutes old</li>
          <li><strong style={{ color: '#e2e8f0' }}>Offline warning banner</strong> — appears when the charger has lost its connection; sessions cannot be started</li>
          <li><strong style={{ color: '#e2e8f0' }}>Gun A and Gun B rows</strong> — status dot, label, live kWh/RWF/time when active, Start or Stop button</li>
        </ul>
        <Callout color='#22c55e'>The <strong>Start</strong> button only appears when the gun is <strong>Available</strong> and the charger is <strong>Online</strong>. For all other states a reason label is shown instead (e.g. "Charger offline", "Gun unavailable").</Callout>
      </>
    ),
  },
  {
    id: 'start',
    title: '6. Starting a Session',
    content: () => (
      <>
        <P>Sessions are started from the Dashboard. The Start button only appears when the gun is <strong>Available</strong> and the charger is <strong>Online</strong>.</P>
        <Steps steps={[
          'On the Dashboard, find a charger card with an Online indicator (green dot).',
          'Locate a gun showing Available status (green dot).',
          'Click Start.',
          'In the modal: select the Operator / Agent (whose kWh quota will be used) and optionally enter a Budget in RWF.',
          'Click Start Charging.',
          'The gun status changes: Available → Preparing → Charging (amber, pulsing).',
          'A live counter appears showing kWh · RWF · elapsed time, updating every 30 seconds.',
        ]} />
        <H3>Possible errors</H3>
        <Table
          headers={['Error', 'Cause', 'Fix']}
          rows={[
            ['Insufficient kWh quota', 'Agent has zero kWh remaining', 'Add an allocation — Section 11'],
            ['Charger rejected start command', 'Charger hardware declined', 'Check physical state of the charger'],
            ['Charger not connected', 'No OCPP connection active', 'Verify OCPP URL in Settings'],
          ]}
        />
      </>
    ),
  },
  {
    id: 'stop',
    title: '7. Stopping a Session',
    content: () => (
      <>
        <Steps steps={[
          'On the Dashboard, find the gun showing Charging (amber, pulsing).',
          'Click Stop.',
          'The system sends RemoteStopTransaction to the charger.',
          'The charger finalises the meter reading and the session is marked completed.',
          'The gun returns to Available.',
        ]} />
        <Callout color='#38bdf8'><strong>Automatic stop:</strong> If a budget (RWF) was set at session start, the system checks meter values continuously and triggers a remote stop when the threshold is reached.</Callout>
      </>
    ),
  },
  {
    id: 'sessions',
    title: '8. Sessions Page',
    content: () => (
      <>
        <P>The Sessions page shows a paginated table of all charging sessions (50 per page).</P>
        <H3>Columns</H3>
        <Table
          headers={['Column', 'Description']}
          rows={[
            ['ID', 'Internal session ID'],
            ['Charger', 'Charger unit ID'],
            ['Gun', 'A or B'],
            ['Operator', 'Agent who ran the session'],
            ['Start', 'Session start time'],
            ['End', 'End time (blank if still active)'],
            ['kWh', 'Energy delivered'],
            ['FRW', 'Cost charged'],
            ['Status', 'pending / active / completed / faulted'],
          ]}
        />
        <H3>Filters</H3>
        <ul style={{ color: '#94a3b8', fontSize: 13, lineHeight: 2, paddingLeft: 20 }}>
          <li><strong style={{ color: '#e2e8f0' }}>From / To</strong> — filter by session start date</li>
          <li><strong style={{ color: '#e2e8f0' }}>Charger</strong> — type a charger ID</li>
          <li><strong style={{ color: '#e2e8f0' }}>Status</strong> — All / Active / Completed / Pending / Faulted</li>
        </ul>
        <Callout color='#475569'>Agents see only their own sessions. Admins and Accountants see all sessions.</Callout>
        <H3>Generating an invoice</H3>
        <P>On any <strong>completed</strong> row, click <strong>Invoice</strong>. Enter the customer name and click <strong>Generate &amp; Download PDF</strong>.</P>
      </>
    ),
  },
  {
    id: 'invoices',
    title: '9. Invoices',
    content: () => (
      <>
        <P>The Invoices page lists every PDF invoice generated. Click <strong>PDF</strong> on any row to open or re-download it.</P>
        <Table
          headers={['Column', 'Description']}
          rows={[
            ['Invoice #', 'Zero-padded number, e.g. #000003'],
            ['Session', 'Linked session ID'],
            ['Customer', 'Name on the invoice'],
            ['Operator', 'Agent who ran the session'],
            ['Date', 'Invoice creation date'],
            ['kWh', 'Energy billed'],
            ['Total (RWF)', 'Amount billed'],
          ]}
        />
        <P>Each PDF invoice contains: charger ID, gun, start/end time, operator name, customer name, kWh, price per kWh, and total in RWF. PDFs are stored on the server and can always be re-downloaded.</P>
        <Callout color='#f59e0b'>Invoices can only be generated for sessions with status <strong>completed</strong>.</Callout>
      </>
    ),
  },
  {
    id: 'operators',
    title: '10. Operators',
    content: () => (
      <>
        <P><em>Admin only.</em> The Operators page lists all user accounts and lets you create or deactivate them.</P>
        <H3>Adding an operator</H3>
        <Steps steps={[
          'Click + Add Operator.',
          'Fill in: Full Name, Email, Password, Role (admin / agent / accountant).',
          'Click Create Operator — the user can log in immediately.',
        ]} />
        <H3>Role badge colours</H3>
        <Table
          headers={['Role', 'Badge colour']}
          rows={[
            ['Admin', 'Blue'],
            ['Agent', 'Green'],
            ['Accountant', 'Amber'],
          ]}
        />
        <H3>Activating / Deactivating</H3>
        <P>Click <strong>Deactivate</strong> to block login (session data is preserved). Click <strong>Activate</strong> to restore access. You cannot deactivate your own account.</P>
      </>
    ),
  },
  {
    id: 'allocations',
    title: '11. Allocations',
    content: () => (
      <>
        <P><em>Admin only.</em> Each agent must have at least one allocation before they can start a session. An allocation records kWh purchased and the price per kWh, and tracks usage over time.</P>
        <H3>Reading an allocation card</H3>
        <div style={{ background: '#0f1623', border: '1px solid #1e293b', borderRadius: 8, padding: 16, marginBottom: 16, fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#e2e8f0', fontWeight: 700 }}>Agent Name</span>
            <span style={{ color: '#38bdf8' }}>145.000 kWh left · 350 RWF/kWh</span>
          </div>
          <div style={{ color: '#475569', fontSize: 11, marginBottom: 8 }}>agent@simplecharge.rw</div>
          <div style={{ background: '#1e293b', borderRadius: 4, height: 6, marginBottom: 6 }}>
            <div style={{ width: '62%', height: '100%', borderRadius: 4, background: '#f59e0b' }} />
          </div>
          <div>Assigned: 380.000 kWh · Used: 235.000 kWh · Value remaining: 50,750 RWF</div>
        </div>
        <P>Progress bar: <span style={{ color: '#22c55e' }}>green</span> = &lt;60% used · <span style={{ color: '#f59e0b' }}>amber</span> = 60–90% · <span style={{ color: '#ef4444' }}>red</span> = &gt;90%.</P>
        <H3>Adding a top-up allocation</H3>
        <Steps steps={[
          'Click + Add Allocation.',
          'Select the agent from the dropdown.',
          'Enter kWh to Allocate and Price per kWh (RWF, default 350).',
          'Click Allocate kWh.',
        ]} />
        <Callout color='#38bdf8'>Each allocation is a separate record. New top-ups can use a different price per kWh without affecting the existing balance.</Callout>
      </>
    ),
  },
  {
    id: 'reports',
    title: '12. Reports',
    content: () => (
      <>
        <P><em>Admin and Accountant only.</em> Two tabs: Monthly Sales and Inventory.</P>
        <H3>Monthly Sales</H3>
        <P>Select year, month, and optionally an agent. Shows: sessions count · total kWh · total revenue in RWF · daily bar chart (kWh + sessions per day) · per-agent breakdown table.</P>
        <H3>Inventory</H3>
        <Table
          headers={['Row', 'Description']}
          rows={[
            ['Total Purchased', 'Sum of all kWh allocation top-ups'],
            ['Total Sold', 'Sum of all completed session energy'],
            ['Remaining Stock', 'Purchased minus sold, valued at average purchase price'],
          ]}
        />
        <P>The Recent Transactions table shows the last 100 inventory entries (purchases and sales).</P>
      </>
    ),
  },
  {
    id: 'settings',
    title: '13. Settings',
    content: () => (
      <>
        <P><em>Admin only.</em> The Settings page has two labelled parts: <strong>A — This Server</strong> and <strong>B — Your Physical Charger Machines</strong>.</P>
        <H3>Part A — This Server</H3>
        <P>Shows the OCPP server status running on this machine: port 8887, protocol (ws:// or wss://), chargers online now, and this machine's IP address. Only physical WiFi/Ethernet addresses are shown as "Use this one" — VPN tunnels are collapsed with an explanation.</P>
        <Callout color='#0ea5e9'>This section is read-only. The server is already running. You just need the IP address shown here to type into each charger's touchscreen.</Callout>
        <H3>Part B — Physical Charger Machines</H3>
        <P>One card per physical charger box on-site. A machine with 2 guns can charge 2 vehicles simultaneously. Add one card per machine you own — there is no limit.</P>
        <H3>Registering a new charger machine</H3>
        <Steps steps={[
          'Click + Register New Charger Machine.',
          'Enter Machine ID (must match what the charger sends in its OCPP URL), Display Name, Location, number of guns.',
          'Under "How the charger connects": select LAN or 4G SIM, then pick the server IP from the dropdown.',
          'The OCPP URL is generated live as you type — copy it.',
          'Click Register Charger.',
          'On the charger touchscreen: open Back Office, go to Network/OCPP Settings, paste the URL, set Station ID and Protocol (OCPP1.6J), save and reboot.',
          'The card shows Online within 30 seconds.',
        ]} />
        <H3>The charger card</H3>
        <ul style={{ color: '#94a3b8', fontSize: 13, lineHeight: 2, paddingLeft: 20 }}>
          <li><strong style={{ color: '#e2e8f0' }}>📱 Type this into the charger's touchscreen</strong> — shows 6 numbered steps and the exact URL to paste into the Back Office</li>
          <li><strong style={{ color: '#e2e8f0' }}>Online / Offline badge</strong> — updates every 10 seconds</li>
          <li><strong style={{ color: '#e2e8f0' }}>Show technical details</strong> — port, protocol, APN, heartbeat interval, last heartbeat</li>
          <li><strong style={{ color: '#e2e8f0' }}>Edit config</strong> — change any setting; URL regenerates live</li>
          <li><strong style={{ color: '#e2e8f0' }}>Remove</strong> — blocked while the charger is online</li>
        </ul>
      </>
    ),
  },
  {
    id: 'status',
    title: '14. Charger Status Reference',
    content: () => (
      <>
        <Table
          headers={['Status', 'Colour', 'Start button?', 'Meaning']}
          rows={[
            ['Available', '🟢 Green', 'Yes', 'Gun is ready — a session can be started'],
            ['Preparing', '🔵 Blue', 'No', 'Start command sent; charger is setting up'],
            ['Charging', '🟡 Amber (pulsing)', 'No', 'Vehicle is actively charging'],
            ['Finishing', '🟣 Purple', 'No', 'Session ending; final meter reading in progress'],
            ['Reserved', '🟣 Purple', 'No', 'Gun reserved (Phase 2)'],
            ['Unavailable', '⚫ Gray', 'No', 'Gun offline or disabled on the charger'],
            ['Faulted', '🔴 Red', 'No', 'Charger has reported an error'],
          ]}
        />
        <Callout color='#22c55e'>The <strong>Start</strong> button only appears when the gun is <strong>Available AND the charger is Online</strong>. For all other combinations, a reason label appears instead (e.g. "Charger offline", "Gun faulted").</Callout>
        <H3>Heartbeat display</H3>
        <P>Shown as relative time: "Just now" · "2m ago" · etc. Turns <span style={{ color: '#ef4444' }}>red</span> when more than 3 minutes have passed — this indicates a connectivity problem. "Never" means the charger has not connected since the server started.</P>
      </>
    ),
  },
  {
    id: 'troubleshooting',
    title: '15. Troubleshooting',
    content: () => (
      <>
        {[
          {
            q: 'Cannot log in',
            a: 'Check email spelling and Caps Lock. Ask an admin to confirm the account is active on the Operators page. If locked out of all admin accounts, re-run npm run db:seed on the server to restore the default admin.',
          },
          {
            q: 'Dashboard shows a charger as Offline',
            a: 'The charger has lost its OCPP WebSocket connection. Check: charger power supply · 4G SIM connectivity · the OCPP URL configured on the charger touchscreen (go to Settings to verify the URL matches the current server IP).',
          },
          {
            q: 'Start button is not showing on a gun',
            a: 'The gun must be Available and the charger must be Online. If the charger is offline a red warning banner covers the card. If the gun has a different status (Unavailable, Faulted, etc.) a reason label appears instead of the button.',
          },
          {
            q: '"Insufficient kWh quota" error',
            a: 'The selected agent has zero remaining kWh. An admin must add a new allocation on the Allocations page.',
          },
          {
            q: '"Charger not connected" error',
            a: 'The OCPP WebSocket is not active for that charger. Go to Settings, verify the OCPP URL matches the server\'s current IP and port 8887.',
          },
          {
            q: 'Session stays "active" after stopping',
            a: 'The charger lost connectivity before sending StopTransaction. Contact the system administrator to close the session manually in the database.',
          },
          {
            q: 'Invoice PDF does not open',
            a: 'Browser may be blocking pop-ups — allow pop-ups for this site. Session must be completed before an invoice can be generated. Verify the uploads/invoices/ directory is writable on the server.',
          },
          {
            q: 'Live kWh counter is frozen',
            a: 'The charger may not be sending MeterValues messages. Check the MeterValueSampleInterval setting in the charger back office. The counter also only updates every 30 seconds even when working normally.',
          },
          {
            q: 'Online Chargers shows wrong count',
            a: 'The metric shows X / Y (online / total registered). If it shows 0 / 2 both chargers are offline. Verify the OCPP server is running (npm run dev in the backend folder) and the chargers have the correct OCPP URL.',
          },
        ].map(({ q, a }) => (
          <div key={q} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #1e293b' }}>
            <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>❓ {q}</div>
            <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.7 }}>{a}</div>
          </div>
        ))}
      </>
    ),
  },
  {
    id: 'quickref',
    title: '16. Quick Reference',
    content: () => (
      <>
        <Table
          headers={['Task', 'Where', 'Who']}
          rows={[
            ['Change default password', 'Operators → Admin → Edit', 'Admin'],
            ['First-time setup walkthrough', 'Dashboard → Getting Started panel', 'Admin'],
            ['Start a session', 'Dashboard → Gun row → Start', 'Admin, Agent'],
            ['Stop a session', 'Dashboard → Gun row → Stop', 'Admin, Agent'],
            ['View session history', 'Sessions page', 'All (agents: own only)'],
            ['Generate invoice PDF', 'Sessions → Invoice button', 'All (agents: own only)'],
            ['Download saved invoice', 'Invoices → PDF button', 'All (agents: own only)'],
            ['Add a new operator', 'Operators → + Add Operator', 'Admin'],
            ['Deactivate a user', 'Operators → Deactivate button', 'Admin'],
            ['Add kWh quota', 'Allocations → + Add Allocation', 'Admin'],
            ['Monthly revenue report', 'Reports → Monthly Sales tab', 'Admin, Accountant'],
            ['Inventory stock balance', 'Reports → Inventory tab', 'Admin, Accountant'],
            ['Register a new charger', 'Settings → + Register New Charger Machine', 'Admin'],
            ['Get charger OCPP URL', 'Settings → charger card → copy URL', 'Admin'],
            ['Open this manual', 'Help (left sidebar)', 'All'],
            ['Sign out', 'Sidebar → Sign Out', 'All'],
          ]}
        />
      </>
    ),
  },
]

// ─── shared sub-components ────────────────────────────────────────────────────

function P({ children }) {
  return <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.8, marginBottom: 14 }}>{children}</p>
}

function H3({ children }) {
  return <h3 style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 700, margin: '20px 0 10px', paddingBottom: 6, borderBottom: '1px solid #1e293b' }}>{children}</h3>
}

function Callout({ children, color = '#38bdf8' }) {
  return (
    <div style={{ background: color + '11', border: `1px solid ${color}33`, borderLeft: `3px solid ${color}`, borderRadius: 6, padding: '12px 14px', marginBottom: 14, fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
      {children}
    </div>
  )
}

function Steps({ steps }) {
  return (
    <ol style={{ margin: '0 0 16px', padding: '0 0 0 0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {steps.map((step, i) => (
        <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#0ea5e9', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
            {i + 1}
          </div>
          <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.7, paddingTop: 2 }}>{step}</div>
        </li>
      ))}
    </ol>
  )
}

function Table({ headers, rows }) {
  return (
    <div style={{ overflowX: 'auto', marginBottom: 16 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#475569', fontWeight: 600, textTransform: 'uppercase', fontSize: 10, letterSpacing: 1, borderBottom: '1px solid #1e293b', background: '#0f1623' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: '1px solid #1e293b' }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: '9px 12px', color: ci === 0 ? '#e2e8f0' : '#94a3b8', verticalAlign: 'top', lineHeight: 1.6 }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── main Help page ───────────────────────────────────────────────────────────

export default function Help() {
  const [active, setActive] = useState(SECTIONS[0].id)
  const [search, setSearch] = useState('')
  const contentRef = useRef(null)
  const sectionRefs = useRef({})

  // Scrollspy: update active section based on scroll position
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    function onScroll() {
      let current = SECTIONS[0].id
      for (const sec of SECTIONS) {
        const ref = sectionRefs.current[sec.id]
        if (ref && ref.getBoundingClientRect().top <= 120) {
          current = sec.id
        }
      }
      setActive(current)
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  function scrollTo(id) {
    const ref = sectionRefs.current[id]
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActive(id)
    }
  }

  const filtered = search.trim()
    ? SECTIONS.filter((s) => s.title.toLowerCase().includes(search.toLowerCase()))
    : SECTIONS

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 80px)', overflow: 'hidden' }}>

      {/* ── Left: Table of Contents ── */}
      <aside style={{ width: 230, flexShrink: 0, background: '#0f1623', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '20px 16px 12px' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>User Manual</div>
          <div style={{ color: '#475569', fontSize: 11 }}>EVCSIMS v1.1 · May 2026</div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sections…"
            style={{ width: '100%', marginTop: 12, padding: '6px 10px', background: '#111827', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 12, outline: 'none' }}
          />
        </div>
        <nav style={{ flex: 1, padding: '4px 8px 20px' }}>
          {filtered.map((sec) => (
            <button
              key={sec.id}
              onClick={() => scrollTo(sec.id)}
              style={{
                width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 6,
                background: active === sec.id ? '#1e293b' : 'none',
                border: 'none',
                borderLeft: active === sec.id ? '2px solid #38bdf8' : '2px solid transparent',
                color: active === sec.id ? '#38bdf8' : '#64748b',
                fontSize: 12, cursor: 'pointer', lineHeight: 1.4,
                transition: 'all .15s',
              }}
            >
              {sec.title}
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{ color: '#475569', fontSize: 12, padding: '8px 10px' }}>No sections match</div>
          )}
        </nav>
      </aside>

      {/* ── Right: Content ── */}
      <main ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
        <div style={{ maxWidth: 780 }}>

          {/* Header */}
          <div style={{ marginBottom: 36, paddingBottom: 24, borderBottom: '1px solid #1e293b' }}>
            <h1 style={{ color: '#e2e8f0', fontSize: 24, fontWeight: 800, marginBottom: 6 }}>
              EVCSIMS User Manual
            </h1>
            <div style={{ color: '#475569', fontSize: 13 }}>
              EV Charging Station Intelligent Management System · Simple Charge, Kigali, Rwanda · Version 1.1 · May 2026
            </div>
          </div>

          {/* Sections */}
          {SECTIONS.map((sec) => (
            <section
              key={sec.id}
              ref={(el) => { sectionRefs.current[sec.id] = el }}
              style={{ marginBottom: 52, scrollMarginTop: 80 }}
            >
              <h2 style={{ color: '#e2e8f0', fontSize: 17, fontWeight: 700, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ background: '#1e293b', color: '#38bdf8', fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: 600, flexShrink: 0 }}>
                  §
                </span>
                {sec.title}
              </h2>
              <sec.content />
            </section>
          ))}

          <div style={{ borderTop: '1px solid #1e293b', paddingTop: 20, color: '#334155', fontSize: 11, textAlign: 'center' }}>
            EVCSIMS User Manual · Simple Charge, Kigali, Rwanda · May 2026 · v1.1 · For technical support contact your system administrator.
          </div>
        </div>
      </main>
    </div>
  )
}
