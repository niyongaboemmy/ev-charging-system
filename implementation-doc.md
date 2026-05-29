# EVCSIMS — Implementation Prompt

## OCPP 1.6J Management System · Node.js Backend · React Frontend

> Reference documents: EV-PROP-2026-001 · EV-TFS-2026-001 · Simple Charge, Kigali, Rwanda

---

## Overview

Build a full-stack EV Charging Station Intelligent Management System (EVCSIMS) for **testing and preview purposes**. The system connects to two DC fast-chargers via OCPP 1.6J (JSON over WebSocket), stores all session data in MySQL, and exposes a React dashboard showing live charger status, session data, financial summaries, and operator management.

The target hardware is two **Ningbo Yuyue 160 kW dual-gun DC fast-chargers** (S/N 20251218007 and 20251218008) with GB/T connectors, 4G communication modules, RFID readers, and RS-485 energy meters. For the testing build, simulate charger behaviour using an OCPP simulator when real hardware is not connected.

---

## Tech Stack

| Layer                 | Technology                                    |
| --------------------- | --------------------------------------------- |
| OCPP WebSocket Server | Node.js 20 LTS · `ws` library                 |
| REST API              | Node.js · Express 4                           |
| Authentication        | JWT (`jsonwebtoken`) · bcryptjs               |
| Database              | MySQL 8.0 · `mysql2` (promise API)            |
| Frontend              | React 18 · Vite · React Router v6             |
| PDF Invoices          | `pdfkit` (Node.js, server-side generation)    |
| Process Management    | PM2                                           |
| Reverse Proxy (prod)  | Nginx + Let's Encrypt (wss://)                |
| Testing simulator     | OCPP-J Simulator or a lightweight mock script |

---

## Project Structure

```
evcsims/
├── backend/
│   ├── src/
│   │   ├── ocpp/
│   │   │   ├── server.js          # WebSocket server (:8887)
│   │   │   ├── handlers/
│   │   │   │   ├── bootNotification.js
│   │   │   │   ├── heartbeat.js
│   │   │   │   ├── statusNotification.js
│   │   │   │   ├── authorize.js
│   │   │   │   ├── startTransaction.js
│   │   │   │   ├── stopTransaction.js
│   │   │   │   └── meterValues.js
│   │   │   └── commands.js        # RemoteStart, RemoteStop, ChangeConfig
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── auth.js
│   │   │   │   ├── users.js
│   │   │   │   ├── chargers.js
│   │   │   │   ├── sessions.js
│   │   │   │   ├── allocations.js
│   │   │   │   ├── invoices.js
│   │   │   │   └── reports.js
│   │   │   ├── middleware/
│   │   │   │   ├── authenticate.js  # JWT verification
│   │   │   │   └── authorize.js     # Role-based access control
│   │   │   └── app.js
│   │   ├── db/
│   │   │   ├── pool.js
│   │   │   └── schema.sql
│   │   └── index.js               # Entry point — starts both servers
│   ├── package.json
│   └── .env
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Dashboard.jsx       # Live charger status
    │   │   ├── Sessions.jsx        # Session list + start/stop
    │   │   ├── Operators.jsx       # User management
    │   │   ├── Allocations.jsx     # kWh quota management
    │   │   ├── Invoices.jsx
    │   │   └── Reports.jsx
    │   ├── components/
    │   │   ├── ChargerCard.jsx     # Live gun status widget
    │   │   ├── SessionRow.jsx
    │   │   ├── Layout.jsx
    │   │   └── ProtectedRoute.jsx
    │   ├── hooks/
    │   │   ├── useAuth.js
    │   │   └── useLiveSession.js   # Polls /api/sessions/live every 30s
    │   ├── api/
    │   │   └── client.js           # Axios instance with JWT interceptor
    │   └── main.jsx
    ├── vite.config.js
    └── package.json
```

---

## Part 1 — Database Schema

Create file `backend/src/db/schema.sql`. Run this once at project initialisation.

```sql
-- Users (operators, admins, accountants)
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(150)  UNIQUE NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  role          ENUM('admin','agent','accountant') NOT NULL DEFAULT 'agent',
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- Charger units
CREATE TABLE IF NOT EXISTS charger_units (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  charger_id    VARCHAR(50)   UNIQUE NOT NULL,
  display_name  VARCHAR(100),
  location      VARCHAR(255),
  last_seen     TIMESTAMP     NULL,
  status_a      ENUM('Available','Preparing','Charging','Finishing','Reserved','Unavailable','Faulted') DEFAULT 'Unavailable',
  status_b      ENUM('Available','Preparing','Charging','Finishing','Reserved','Unavailable','Faulted') DEFAULT 'Unavailable',
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- Seed the two chargers
INSERT IGNORE INTO charger_units (charger_id, display_name, location)
VALUES
  ('KIGALI-DC160-001', 'Charger 1 — Bay A', 'Simple Charge, Kigali'),
  ('KIGALI-DC160-002', 'Charger 2 — Bay B', 'Simple Charge, Kigali');

-- kWh allocations (quota per agent)
CREATE TABLE IF NOT EXISTS kwh_allocations (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT           NOT NULL,
  kwh_assigned    DECIMAL(10,3) NOT NULL DEFAULT 0,
  kwh_used        DECIMAL(10,3) NOT NULL DEFAULT 0,
  price_per_kwh   DECIMAL(10,2) NOT NULL DEFAULT 350.00,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user (user_id)
);

-- Charging sessions
CREATE TABLE IF NOT EXISTS sessions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT           NOT NULL,
  charger_id      VARCHAR(50)   NOT NULL,
  connector       CHAR(1)       NOT NULL,         -- 'A' or 'B'
  connector_id    TINYINT       NOT NULL,          -- 1 or 2 (OCPP)
  transaction_id  INT           NULL,
  id_tag          VARCHAR(20)   NULL,
  kwh_consumed    DECIMAL(10,3) NOT NULL DEFAULT 0,
  total_frw       DECIMAL(12,2) NOT NULL DEFAULT 0,
  price_per_kwh   DECIMAL(10,2) NOT NULL,
  budget_frw      DECIMAL(12,2) NULL,
  status          ENUM('pending','active','completed','faulted') DEFAULT 'pending',
  start_time      TIMESTAMP     NULL,
  end_time        TIMESTAMP     NULL,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_charger_status (charger_id, status),
  INDEX idx_transaction   (transaction_id),
  INDEX idx_user_time     (user_id, start_time)
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  session_id    INT           UNIQUE NOT NULL,
  user_id       INT           NOT NULL,
  customer_name VARCHAR(150)  NOT NULL DEFAULT 'Walk-in Customer',
  kwh           DECIMAL(10,3) NOT NULL,
  price_per_kwh DECIMAL(10,2) NOT NULL,
  total_frw     DECIMAL(12,2) NOT NULL,
  pdf_path      VARCHAR(255)  NULL,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (user_id)    REFERENCES users(id)
);

-- Inventory / kWh purchase log
CREATE TABLE IF NOT EXISTS inventory_log (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  type          ENUM('purchase','sale') NOT NULL,
  user_id       INT           NULL,
  session_id    INT           NULL,
  kwh           DECIMAL(10,3) NOT NULL,
  price_per_kwh DECIMAL(10,2) NOT NULL,
  total_frw     DECIMAL(12,2) NOT NULL,
  note          VARCHAR(255),
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- RFID cards (Phase 1 — ready for use)
CREATE TABLE IF NOT EXISTS rfid_cards (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT           NOT NULL,
  card_uid    VARCHAR(50)   UNIQUE NOT NULL,
  label       VARCHAR(100),
  is_active   TINYINT(1)    DEFAULT 1,
  issued_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE INDEX idx_card_uid (card_uid)
);
```

---

## Part 2 — OCPP WebSocket Server

### `backend/src/ocpp/server.js`

```js
const WebSocket = require('ws')
const db = require('../db/pool')
const handlers = require('./handlers')
const { connectedChargers } = require('./commands')

const wss = new WebSocket.Server({ port: 8887 })

wss.on('connection', (ws, req) => {
  const parts = req.url.split('/')
  const chargerId = parts[parts.length - 1]

  const proto = req.headers['sec-websocket-protocol'] || ''
  if (!proto.includes('ocpp1.6')) {
    ws.close(1002, 'Unsupported protocol')
    return
  }

  connectedChargers.set(chargerId, ws)
  console.log(`[OCPP] Connected: ${chargerId}`)

  ws.on('message', async (raw) => {
    let msg
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }

    const [type, uid, action, payload] = msg
    if (type !== 2) return // Only handle CALL messages

    const respond = (body) => {
      ws.send(JSON.stringify([3, uid, body]))
    }

    try {
      switch (action) {
        case 'BootNotification':
          await handlers.bootNotification(chargerId, payload, respond)
          break
        case 'Heartbeat':
          await handlers.heartbeat(chargerId, respond)
          break
        case 'StatusNotification':
          await handlers.statusNotification(chargerId, payload, respond)
          break
        case 'Authorize':
          await handlers.authorize(chargerId, payload, respond)
          break
        case 'StartTransaction':
          await handlers.startTransaction(chargerId, payload, respond)
          break
        case 'StopTransaction':
          await handlers.stopTransaction(chargerId, payload, respond)
          break
        case 'MeterValues':
          await handlers.meterValues(chargerId, payload, respond)
          break
        default:
          respond({})
      }
    } catch (err) {
      console.error(`[OCPP] Handler error on ${chargerId}/${action}:`, err)
      respond({})
    }
  })

  ws.on('close', async () => {
    connectedChargers.delete(chargerId)
    await db.query(
      `UPDATE charger_units SET status_a='Unavailable', status_b='Unavailable' WHERE charger_id=?`,
      [chargerId],
    )
    console.log(`[OCPP] Disconnected: ${chargerId}`)
  })

  ws.on('error', (err) =>
    console.error(`[OCPP] Error (${chargerId}):`, err.message),
  )
})

console.log('[OCPP] WebSocket server listening on :8887')
```

### `backend/src/ocpp/commands.js`

```js
const connectedChargers = new Map()

async function sendCommand(chargerId, action, payload) {
  const ws = connectedChargers.get(chargerId)
  if (!ws || ws.readyState !== 1) {
    throw new Error(`Charger ${chargerId} not connected`)
  }
  const uid = `${Date.now()}`
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('OCPP command timeout')),
      10000,
    )
    ws.once('message', (raw) => {
      clearTimeout(timeout)
      const [type, id, body] = JSON.parse(raw)
      if (type === 3 && id === uid) resolve(body)
    })
    ws.send(JSON.stringify([2, uid, action, payload]))
  })
}

async function remoteStart(chargerId, connectorId, idTag) {
  return sendCommand(chargerId, 'RemoteStartTransaction', {
    connectorId,
    idTag,
  })
}

async function remoteStop(chargerId, transactionId) {
  return sendCommand(chargerId, 'RemoteStopTransaction', { transactionId })
}

async function changeConfig(chargerId, key, value) {
  return sendCommand(chargerId, 'ChangeConfiguration', { key, value })
}

module.exports = { connectedChargers, remoteStart, remoteStop, changeConfig }
```

### Handler files

Implement each handler in `backend/src/ocpp/handlers/`:

**`bootNotification.js`**

```js
const db = require('../../db/pool')
module.exports = async function bootNotification(chargerId, payload, respond) {
  await db.query(
    `UPDATE charger_units SET last_seen=NOW() WHERE charger_id=?`,
    [chargerId],
  )
  respond({
    status: 'Accepted',
    currentTime: new Date().toISOString(),
    interval: 60,
  })
}
```

**`heartbeat.js`**

```js
const db = require('../../db/pool')
module.exports = async function heartbeat(chargerId, respond) {
  await db.query(
    `UPDATE charger_units SET last_seen=NOW() WHERE charger_id=?`,
    [chargerId],
  )
  respond({ currentTime: new Date().toISOString() })
}
```

**`statusNotification.js`**

```js
const db = require('../../db/pool')
module.exports = async function statusNotification(
  chargerId,
  payload,
  respond,
) {
  const col = payload.connectorId === 1 ? 'status_a' : 'status_b'
  await db.query(`UPDATE charger_units SET ${col}=? WHERE charger_id=?`, [
    payload.status,
    chargerId,
  ])
  respond({})
}
```

**`authorize.js`**

```js
const db = require('../../db/pool')
module.exports = async function authorize(chargerId, payload, respond) {
  const [rows] = await db.query(
    `SELECT r.user_id, (a.kwh_assigned - a.kwh_used) AS remaining
     FROM rfid_cards r
     JOIN kwh_allocations a ON a.user_id = r.user_id
     WHERE r.card_uid=? AND r.is_active=1`,
    [payload.idTag],
  )
  const status = rows.length && rows[0].remaining > 0 ? 'Accepted' : 'Invalid'
  respond({ idTagInfo: { status } })
}
```

**`startTransaction.js`**

```js
const db = require('../../db/pool')
module.exports = async function startTransaction(chargerId, payload, respond) {
  // Parse idTag: format AGT-{userId}-{ref} or RFID-{uid}
  let userId = null
  const match = payload.idTag?.match(/^AGT-(\d+)-/)
  if (match) {
    userId = parseInt(match[1])
  } else {
    const [
      r,
    ] = await db.query(
      `SELECT user_id FROM rfid_cards WHERE card_uid=? AND is_active=1`,
      [payload.idTag],
    )
    if (r.length) userId = r[0].user_id
  }

  if (!userId) {
    respond({ transactionId: 0, idTagInfo: { status: 'Invalid' } })
    return
  }

  const connector = payload.connectorId === 1 ? 'A' : 'B'
  const [
    alloc,
  ] = await db.query(
    `SELECT id, price_per_kwh, (kwh_assigned-kwh_used) AS remaining FROM kwh_allocations WHERE user_id=?`,
    [userId],
  )
  if (!alloc.length || alloc[0].remaining <= 0) {
    respond({ transactionId: 0, idTagInfo: { status: 'Invalid' } })
    return
  }

  const [result] = await db.query(
    `INSERT INTO sessions (user_id, charger_id, connector, connector_id, id_tag, price_per_kwh, status, start_time)
     VALUES (?,?,?,?,?,?,  'active', NOW())`,
    [
      userId,
      chargerId,
      connector,
      payload.connectorId,
      payload.idTag,
      alloc[0].price_per_kwh,
    ],
  )
  const sessionId = result.insertId

  // Use session ID as OCPP transaction ID for simplicity
  await db.query(`UPDATE sessions SET transaction_id=? WHERE id=?`, [
    sessionId,
    sessionId,
  ])
  respond({ transactionId: sessionId, idTagInfo: { status: 'Accepted' } })
}
```

**`stopTransaction.js`**

```js
const db = require('../../db/pool')
module.exports = async function stopTransaction(chargerId, payload, respond) {
  const kwh = payload.meterStop ? payload.meterStop / 1000 : 0 // Wh → kWh if meter in Wh
  const [rows] = await db.query(
    `SELECT s.*, a.price_per_kwh FROM sessions s
     JOIN kwh_allocations a ON a.user_id = s.user_id
     WHERE s.transaction_id=? AND s.status='active'`,
    [payload.transactionId],
  )
  if (!rows.length) {
    respond({ idTagInfo: { status: 'Accepted' } })
    return
  }

  const session = rows[0]
  const finalKwh = session.kwh_consumed > 0 ? session.kwh_consumed : kwh
  const totalFrw = finalKwh * session.price_per_kwh

  await db.query(
    `UPDATE sessions SET kwh_consumed=?, total_frw=?, status='completed', end_time=NOW() WHERE id=?`,
    [finalKwh, totalFrw, session.id],
  )
  await db.query(
    `UPDATE kwh_allocations SET kwh_used = kwh_used + ? WHERE user_id=?`,
    [finalKwh, session.user_id],
  )
  await db.query(
    `INSERT INTO inventory_log (type, user_id, session_id, kwh, price_per_kwh, total_frw)
     VALUES ('sale',?,?,?,?,?)`,
    [session.user_id, session.id, finalKwh, session.price_per_kwh, totalFrw],
  )
  respond({ idTagInfo: { status: 'Accepted' } })
}
```

**`meterValues.js`**

```js
const db = require('../../db/pool')
const { remoteStop } = require('../commands')

module.exports = async function meterValues(chargerId, payload, respond) {
  const sampled = payload.meterValue?.[0]?.sampledValue || []
  const energySample = sampled.find(
    (s) => s.measurand === 'Energy.Active.Import.Register',
  )
  if (!energySample) {
    respond({})
    return
  }

  const kwh = parseFloat(energySample.value)
  const [rows] = await db.query(
    `SELECT s.*, a.price_per_kwh FROM sessions s
     JOIN kwh_allocations a ON a.user_id = s.user_id
     WHERE s.transaction_id=? AND s.status='active'`,
    [payload.transactionId],
  )
  if (!rows.length) {
    respond({})
    return
  }

  const session = rows[0]
  const frwSoFar = kwh * session.price_per_kwh
  await db.query(`UPDATE sessions SET kwh_consumed=? WHERE id=?`, [
    kwh,
    session.id,
  ])

  if (session.budget_frw && frwSoFar >= session.budget_frw) {
    try {
      await remoteStop(chargerId, payload.transactionId)
    } catch (_) {}
  }
  respond({})
}
```

---

## Part 3 — REST API

### `backend/src/api/app.js`

```js
const express = require('express')
const cors = require('cors')
const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/auth', require('./routes/auth'))
app.use('/api/users', require('./routes/users'))
app.use('/api/chargers', require('./routes/chargers'))
app.use('/api/sessions', require('./routes/sessions'))
app.use('/api/allocations', require('./routes/allocations'))
app.use('/api/invoices', require('./routes/invoices'))
app.use('/api/reports', require('./routes/reports'))

app.listen(3000, () => console.log('[API] REST server listening on :3000'))
```

### Middleware

**`authenticate.js`** — verifies JWT from `Authorization: Bearer <token>` header.

**`authorize.js`** — factory: `authorize('admin')` or `authorize('admin','accountant')` — checks `req.user.role` against allowed roles and returns 403 if not allowed.

### Routes to implement

| File             | Endpoints                                                                       | Key logic                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth.js`        | `POST /login`                                                                   | bcrypt compare, sign JWT `{userId, role, name}`, return token                                                                              |
| `users.js`       | `GET /` `POST /` `PATCH /:id`                                                   | Admin only. Hash password on create                                                                                                        |
| `chargers.js`    | `GET /` `GET /:id/status` `POST /:id/config`                                    | Reads `charger_units`; sends `ChangeConfiguration` via commands.js                                                                         |
| `sessions.js`    | `POST /start` `POST /stop` `GET /live/:chargerId/:connector` `GET /:id` `GET /` | Start validates quota, calls `remoteStart`. Stop calls `remoteStop`. Live is public — returns `kwh_consumed`, `total_frw`, elapsed, status |
| `allocations.js` | `POST /` `GET /:userId`                                                         | Admin creates allocation; also writes `inventory_log` purchase entry                                                                       |
| `invoices.js`    | `POST /` `GET /:id` `GET /`                                                     | Creates invoice record; generates PDF via pdfkit and saves to `/uploads/invoices/`                                                         |
| `reports.js`     | `GET /monthly` `GET /inventory`                                                 | Aggregates sessions and inventory_log with date filters                                                                                    |

---

## Part 4 — React Frontend

### Design Direction

Dark industrial theme — this is an operations dashboard for charging infrastructure. Use a dark navy/slate base (`#0f1623`), charger status shown with vivid green/amber/red status indicators, monospace font for live numbers (energy, FRW), clean sans-serif for labels. Think power grid control room: high information density, no decoration.

### `frontend/src/api/client.js`

```js
import axios from 'axios'

const client = axios.create({ baseURL: 'http://localhost:3000/api' })

client.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

export default client
```

### Pages to build

#### `Login.jsx`

Simple centered login form. POST to `/api/auth/login`. Store token in localStorage. Redirect to `/dashboard`.

---

#### `Dashboard.jsx` — Live Charger Status

This is the primary view. Layout: two large `ChargerCard` components side by side, then a row of summary metrics below.

**`ChargerCard.jsx`** props: `{ chargerId, displayName, statusA, statusB, lastSeen }`

Each card shows:

- Charger name and ID
- Two connector rows (Gun A, Gun B) each with a coloured status pill: `Available` (green), `Charging` (amber pulsing), `Faulted` (red), `Unavailable` (gray)
- If `Charging`: inline live kWh and FRW counter, polled every 30s from `/api/sessions/live/:chargerId/:connector`
- "Start Session" button per connector (opens a modal: select operator/agent, optional budget in FRW, then calls `POST /api/sessions/start`)
- "Stop Session" button when a session is active (calls `POST /api/sessions/stop`)
- Last heartbeat timestamp

Poll `GET /api/chargers` every 15 seconds to refresh charger status.

---

#### `Sessions.jsx`

Paginated table of all sessions. Columns: ID, Charger, Connector, Operator, Start, End, kWh, FRW, Status.
Filter by: date range, operator, charger, status.
Admin and accountant see all; agents see their own.
Row action: "Print Invoice" (opens invoice modal or downloads PDF).

---

#### `Operators.jsx` (Admin only)

List of users with role badge. "Add Operator" form (name, email, password, role). Toggle active/inactive per user.

---

#### `Allocations.jsx` (Admin only)

Per-agent quota management. Shows: `kWh Assigned`, `kWh Used`, `Remaining`, `Price/kWh (FRW)`.
Progress bar: used/assigned ratio. "Add Allocation" form for admin to top up an agent's quota.

---

#### `Invoices.jsx`

List of all invoices. Columns: Invoice ID, Session ID, Customer Name, Operator, Date, kWh, FRW. Download PDF button per row. Admin/Accountant see all; agents see their own.

---

#### `Reports.jsx`

Two tabs:

- **Monthly Sales** — select agent + month/year, show kWh sold, FRW collected, session count. Render as a simple bar chart (use Recharts).
- **Inventory** — total kWh purchased, total sold, remaining stock, FRW value of remaining.

---

### `hooks/useLiveSession.js`

```js
import { useState, useEffect } from 'react'
import client from '../api/client'

export function useLiveSession(chargerId, connector) {
  const [data, setData] = useState(null)
  useEffect(() => {
    if (!chargerId || !connector) return
    const fetch = () =>
      client
        .get(`/sessions/live/${chargerId}/${connector}`)
        .then((r) => setData(r.data))
        .catch(() => {})
    fetch()
    const id = setInterval(fetch, 30000)
    return () => clearInterval(id)
  }, [chargerId, connector])
  return data
}
```

---

## Part 5 — OCPP Test Simulator

Create `backend/simulator.js` to simulate a charger connecting and running a session. Use this when real hardware is not available.

```js
const WebSocket = require('ws')

const CHARGER_ID = 'KIGALI-DC160-001'
const SERVER = `ws://localhost:8887/ocpp/${CHARGER_ID}`

const ws = new WebSocket(SERVER, ['ocpp1.6'])
let txId = null
let kwhCounter = 0

ws.on('open', () => {
  console.log('[SIM] Connected to OCPP server')
  send('BootNotification', {
    chargePointModel: 'DC160KW',
    chargePointVendor: 'NingboYuyue',
  })
  setInterval(() => send('Heartbeat', {}), 30000)

  // Simulate Gun A becoming Available after boot
  setTimeout(() => {
    send('StatusNotification', {
      connectorId: 1,
      status: 'Available',
      errorCode: 'NoError',
    })
    send('StatusNotification', {
      connectorId: 2,
      status: 'Available',
      errorCode: 'NoError',
    })
  }, 2000)
})

ws.on('message', (raw) => {
  const msg = JSON.parse(raw)
  const [type, uid, actionOrBody, payload] = msg

  if (type === 3) {
    console.log('[SIM] CALLRESULT:', uid, actionOrBody)
    if (actionOrBody?.transactionId) txId = actionOrBody.transactionId
  }

  if (type === 2) {
    const action = actionOrBody
    if (action === 'RemoteStartTransaction') {
      ws.send(JSON.stringify([3, uid, { status: 'Accepted' }]))
      setTimeout(() => simulateStart(payload.connectorId, payload.idTag), 500)
    }
    if (action === 'RemoteStopTransaction') {
      ws.send(JSON.stringify([3, uid, { status: 'Accepted' }]))
      setTimeout(() => simulateStop(), 500)
    }
  }
})

function simulateStart(connectorId, idTag) {
  kwhCounter = 0
  send('StatusNotification', {
    connectorId,
    status: 'Charging',
    errorCode: 'NoError',
  })
  send('StartTransaction', {
    connectorId,
    idTag,
    meterStart: 0,
    timestamp: new Date().toISOString(),
  })
  const interval = setInterval(() => {
    if (!txId) return
    kwhCounter += 0.5
    send('MeterValues', {
      connectorId,
      transactionId: txId,
      meterValue: [
        {
          timestamp: new Date().toISOString(),
          sampledValue: [
            {
              value: kwhCounter.toString(),
              measurand: 'Energy.Active.Import.Register',
              unit: 'kWh',
              context: 'Sample.Periodic',
            },
          ],
        },
      ],
    })
  }, 5000) // fast interval for testing (5s)
  setTimeout(() => {
    clearInterval(interval)
    simulateStop()
  }, 60000)
}

function simulateStop() {
  if (!txId) return
  send('StopTransaction', {
    transactionId: txId,
    meterStop: Math.round(kwhCounter * 1000), // Wh
    timestamp: new Date().toISOString(),
    reason: 'Remote',
  })
  txId = null
}

let msgId = 1
function send(action, payload) {
  const uid = String(msgId++)
  ws.send(JSON.stringify([2, uid, action, payload]))
}
```

---

## Part 6 — Environment & Startup

### `backend/.env`

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=evcsims
JWT_SECRET=change_this_to_a_long_random_string
PORT_API=3000
PORT_OCPP=8887
```

### `backend/src/index.js`

```js
require('dotenv').config()
require('./ocpp/server') // starts :8887
require('./api/app') // starts :3000
```

### `package.json` scripts (backend)

```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "sim": "node simulator.js",
    "db:init": "mysql -u root -p evcsims < src/db/schema.sql"
  }
}
```

### `vite.config.js` (frontend)

```js
export default {
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
}
```

---

## Part 7 — idTag Convention (Critical — enforce in code)

The `idTag` field in OCPP (max 20 chars) is the bridge between the charger and the user database.

| Initiation method         | Format                         | Example         |
| ------------------------- | ------------------------------ | --------------- |
| Dashboard (RemoteStart)   | `AGT-{userId}-S{sessionRef}`   | `AGT-12-S0047`  |
| RFID card tap (Authorize) | `RFID-{first 12 chars of UID}` | `RFID-A3F2C1D4` |

The `StartTransaction` handler **must** parse this idTag to extract `userId` and link the session record.

---

## Part 8 — Success Checklist (Testing Phase)

Run through these after setting up the project:

- [ ] MySQL schema creates all 7 tables without errors
- [ ] Seed admin user inserted: `admin@simplecharge.rw` / `Admin@1234` (bcrypt hashed)
- [ ] Both charger records visible in `charger_units`
- [ ] `POST /api/auth/login` returns a valid JWT for the admin
- [ ] Simulator connects: OCPP server logs `[OCPP] Connected: KIGALI-DC160-001`
- [ ] `BootNotification` updates `charger_units.last_seen`
- [ ] `StatusNotification` updates `status_a` / `status_b` correctly
- [ ] Dashboard shows both chargers with Gun A and Gun B status
- [ ] `POST /api/sessions/start` triggers `RemoteStartTransaction` on the simulator
- [ ] Simulator sends `StartTransaction` → session created in DB
- [ ] Simulator sends `MeterValues` every 5s → `kwh_consumed` updates in DB
- [ ] `GET /api/sessions/live/KIGALI-DC160-001/A` returns live kWh and FRW
- [ ] Dashboard live counter updates (30s poll)
- [ ] `POST /api/sessions/stop` sends `RemoteStopTransaction` → session completes
- [ ] `POST /api/invoices` generates a PDF invoice for a completed session
- [ ] `GET /api/reports/monthly` returns correct kWh/FRW aggregates
- [ ] Quota guard: agent with 0 kWh remaining cannot start a session (402 response)

---

## Open Questions to Resolve Before Production

These are outstanding decisions from the Technical Feasibility Study (EV-TFS-2026-001 §11):

| #   | Question                                                                          | Impact                                                              |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Q1  | Is the customer QR tracking page in Phase 1 or Phase 2?                           | Determines if `/api/sessions/live` is public                        |
| Q2  | Confirm final charger ID format (`KIGALI-DC160-001` vs existing `00000000000002`) | Primary key used throughout — agree before first session            |
| Q3  | RFID auth in Phase 1 or Phase 2?                                                  | rfid_cards table is ready; just needs Authorize handler wired in    |
| Q4  | Is budget set by operator (dashboard) or customer (QR form)?                      | Determines if budget input is in session start modal                |
| Q5  | VAT treatment for invoices in Rwanda?                                             | Requires `vat_frw` column and invoice template update if applicable |
| Q6  | Single price per station or per agent?                                            | Current schema is per-agent; redesign needed for per-charger        |

---

## Pre-Conditions Before Go-Live (from TFS §12)

1. **APN correction** on both charger units: change from `cmnet` → correct Rwanda SIM provider APN (confirm with MTN or Airtel Rwanda). This is a 5-minute config change on the charger touchscreen Back Office screen.
2. **TLS / wss://** in production: deploy Nginx reverse proxy with Let's Encrypt certificate. Do NOT go live on unencrypted `ws://` — all billing data must be encrypted in transit.
3. **Charger OCPP URL** must be configured in each charger's Back Office: `wss://evcsims.yourdomain.rw/ocpp/KIGALI-DC160-001` and `…/KIGALI-DC160-002`.
4. **QR code URL** must be updated in each charger's Charger INFO screen to the live domain.

---

_Document compiled from EV-PROP-2026-001 and EV-TFS-2026-001 · Simple Charge, Kigali, Rwanda · May 2026_
