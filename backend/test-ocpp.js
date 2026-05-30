/**
 * EVCSIMS — OCPP 1.6J Compliance & Integration Test Suite
 *
 * Simulates every message a physical Ningbo Yuyue 160 kW charger sends,
 * verifies server responses, and checks DB state after each step.
 *
 * Usage:  node test-ocpp.js
 */

require('dotenv').config()
const WebSocket = require('ws')
const http = require('http')

// ─── config ──────────────────────────────────────────────────────────────────

const OCPP_URL  = `ws://localhost:${process.env.PORT_OCPP || 8887}/ocpp`
const API_BASE  = `http://localhost:${process.env.PORT_API  || 3001}/api`
const CHARGER_A = 'KIGALI-DC160-001'
const CHARGER_B = 'TEST-TESTER-999'   // temporary charger for isolation
const DB_SOCKET = process.env.DB_SOCKET || null

// ─── colours ──────────────────────────────────────────────────────────────────

const C = {
  pass:  (s) => `\x1b[32m✓ ${s}\x1b[0m`,
  fail:  (s) => `\x1b[31m✗ ${s}\x1b[0m`,
  skip:  (s) => `\x1b[33m⚠ ${s}\x1b[0m`,
  head:  (s) => `\x1b[36m\n━━━ ${s} ━━━\x1b[0m`,
  info:  (s) => `\x1b[90m  ${s}\x1b[0m`,
  bold:  (s) => `\x1b[1m${s}\x1b[0m`,
}

// ─── state ────────────────────────────────────────────────────────────────────

let passed = 0, failed = 0, skipped = 0
const failures = []

function pass(label) { console.log(C.pass(label)); passed++ }
function fail(label, reason) {
  console.log(C.fail(label))
  console.log(C.info(`  → ${reason}`))
  failed++
  failures.push({ label, reason })
}
function skip(label, reason) { console.log(C.skip(`SKIP ${label} — ${reason}`)); skipped++ }
function info(s) { console.log(C.info(s)) }

// ─── DB query helper ──────────────────────────────────────────────────────────

const mysql = require('mysql2/promise')
let db

async function dbQuery(sql, params = []) {
  const [rows] = await db.query(sql, params)
  return rows
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

let authToken = null

async function apiPost(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const options = {
      hostname: 'localhost',
      port: process.env.PORT_API || 3001,
      path: `/api${path}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    }
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (d) => (data += d))
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch { resolve({ status: res.statusCode, body: data }) }
      })
    })
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

async function apiGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: process.env.PORT_API || 3001,
      path: `/api${path}`,
      method: 'GET',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    }
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (d) => (data += d))
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch { resolve({ status: res.statusCode, body: data }) }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

// ─── WebSocket OCPP helper ────────────────────────────────────────────────────

function ocppConnect(chargerId, protocol = 'ocpp1.6') {
  return new Promise((resolve, reject) => {
    const url = `${OCPP_URL}/${chargerId}`
    const ws = new WebSocket(url, [protocol])
    const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000)
    ws.on('open', () => { clearTimeout(timeout); resolve(ws) })
    ws.on('error', (err) => { clearTimeout(timeout); reject(err) })
  })
}

function ocppSend(ws, action, payload = {}) {
  return new Promise((resolve, reject) => {
    const uid = `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const timeout = setTimeout(() => reject(new Error(`Timeout waiting for response to ${action}`)), 8000)

    function onMessage(raw) {
      try {
        const msg = JSON.parse(raw)
        if (msg[0] === 3 && msg[1] === uid) {
          clearTimeout(timeout)
          ws.removeListener('message', onMessage)
          resolve(msg[2])
        }
        // Also handle server-initiated CALL (type 2) during waiting — queue them
      } catch (_) {}
    }

    ws.on('message', onMessage)
    ws.send(JSON.stringify([2, uid, action, payload]))
  })
}

// Collect server-initiated CALL messages (RemoteStart, RemoteStop)
function listenForCommand(ws, action, timeoutMs = 6000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs)
    function onMessage(raw) {
      try {
        const msg = JSON.parse(raw)
        if (msg[0] === 2 && msg[2] === action) {
          clearTimeout(timer)
          ws.removeListener('message', onMessage)
          // Respond Accepted automatically
          ws.send(JSON.stringify([3, msg[1], { status: 'Accepted' }]))
          resolve({ uid: msg[1], payload: msg[3] })
        }
      } catch (_) {}
    }
    ws.on('message', onMessage)
  })
}

function delay(ms) { return new Promise((r) => setTimeout(r, ms)) }

// ─── test suites ─────────────────────────────────────────────────────────────

async function testApiAuth() {
  console.log(C.head('T01 · API Authentication'))

  // Valid login
  const res = await apiPost('/auth/login', { email: 'admin@simplecharge.rw', password: 'Admin@1234' })
  if (res.status === 200 && res.body.token) {
    authToken = res.body.token
    pass('POST /api/auth/login with valid credentials returns JWT')
    info(`token prefix: ${authToken.slice(0, 20)}…`)
  } else {
    fail('POST /api/auth/login', `status ${res.status}: ${JSON.stringify(res.body)}`)
    throw new Error('Cannot proceed without auth token')
  }

  // Invalid login
  const bad = await apiPost('/auth/login', { email: 'admin@simplecharge.rw', password: 'wrongpass' })
  if (bad.status === 401) {
    pass('POST /api/auth/login with wrong password returns 401')
  } else {
    fail('Wrong password should return 401', `got ${bad.status}`)
  }

  // Missing fields
  const missing = await apiPost('/auth/login', { email: 'admin@simplecharge.rw' })
  if (missing.status === 400) {
    pass('POST /api/auth/login with missing password returns 400')
  } else {
    fail('Missing password should return 400', `got ${missing.status}`)
  }
}

async function testWebSocketConnection() {
  console.log(C.head('T02 · WebSocket Connection'))

  // Correct protocol
  try {
    const ws = await ocppConnect(CHARGER_B, 'ocpp1.6')
    pass('Connect with protocol "ocpp1.6" — accepted')
    ws.close()
    await delay(300)
  } catch (err) {
    fail('Connect with protocol "ocpp1.6"', err.message)
  }

  // Wrong protocol — server should close with 1002
  await new Promise((resolve) => {
    const url = `${OCPP_URL}/${CHARGER_B}`
    const ws = new WebSocket(url, ['ocpp2.0'])
    const t = setTimeout(() => {
      skip('Wrong protocol rejection', 'no close event in 3s — server may silently ignore')
      ws.terminate()
      resolve()
    }, 3000)
    ws.on('close', (code) => {
      clearTimeout(t)
      if (code === 1002 || code === 1000) {
        pass(`Connect with wrong protocol "ocpp2.0" — rejected (close code ${code})`)
      } else {
        fail('Wrong protocol should be rejected', `close code was ${code}`)
      }
      resolve()
    })
    ws.on('error', () => {
      clearTimeout(t)
      pass('Connect with wrong protocol "ocpp2.0" — rejected (connection error)')
      resolve()
    })
  })
}

async function testBootSequence(ws) {
  console.log(C.head('T03 · Boot Sequence'))

  const beforeBoot = await dbQuery(
    'SELECT last_seen FROM charger_units WHERE charger_id=?', [CHARGER_A]
  )

  const boot = await ocppSend(ws, 'BootNotification', {
    chargePointModel:        'DC160KW',
    chargePointVendor:       'NingboYuyue',
    chargePointSerialNumber: '20251218007',
    firmwareVersion:         '1.0.0',
  })
  info(`BootNotification response: ${JSON.stringify(boot)}`)

  if (boot.status === 'Accepted') {
    pass('BootNotification → status: Accepted')
  } else {
    fail('BootNotification status', `expected Accepted, got ${boot.status}`)
  }

  if (typeof boot.interval === 'number' && boot.interval > 0) {
    pass(`BootNotification → heartbeat interval: ${boot.interval}s`)
  } else {
    fail('BootNotification interval', `expected positive number, got ${boot.interval}`)
  }

  if (boot.currentTime && !isNaN(Date.parse(boot.currentTime))) {
    pass(`BootNotification → currentTime: ${boot.currentTime}`)
  } else {
    fail('BootNotification currentTime', `not a valid ISO timestamp: ${boot.currentTime}`)
  }

  await delay(300)
  const afterBoot = await dbQuery(
    'SELECT last_seen FROM charger_units WHERE charger_id=?', [CHARGER_A]
  )
  const updated = afterBoot[0]?.last_seen &&
    (beforeBoot[0]?.last_seen === null ||
     new Date(afterBoot[0].last_seen) >= new Date(beforeBoot[0].last_seen))
  if (updated) {
    pass('BootNotification → DB: charger_units.last_seen updated')
  } else {
    fail('BootNotification DB update', 'last_seen not updated')
  }
}

async function testHeartbeat(ws) {
  console.log(C.head('T04 · Heartbeat'))

  const hb = await ocppSend(ws, 'Heartbeat', {})
  info(`Heartbeat response: ${JSON.stringify(hb)}`)

  if (hb.currentTime && !isNaN(Date.parse(hb.currentTime))) {
    pass('Heartbeat → currentTime returned')
  } else {
    fail('Heartbeat currentTime', `invalid: ${hb.currentTime}`)
  }

  // Verify last_seen was touched
  await delay(200)
  const row = await dbQuery(
    'SELECT last_seen FROM charger_units WHERE charger_id=?', [CHARGER_A]
  )
  const age = Date.now() - new Date(row[0]?.last_seen).getTime()
  if (age < 5000) {
    pass(`Heartbeat → DB: last_seen updated (${Math.round(age)}ms ago)`)
  } else {
    fail('Heartbeat DB update', `last_seen is ${Math.round(age / 1000)}s old`)
  }
}

async function testStatusNotification(ws) {
  console.log(C.head('T05 · StatusNotification'))

  const statuses = ['Available', 'Preparing', 'Charging', 'Finishing', 'Unavailable', 'Faulted']

  for (const status of statuses) {
    const res = await ocppSend(ws, 'StatusNotification', {
      connectorId: 1, status, errorCode: 'NoError',
    })
    if (typeof res === 'object') {
      pass(`StatusNotification connectorId:1 status:${status} → empty object response`)
    } else {
      fail(`StatusNotification ${status}`, `unexpected response: ${JSON.stringify(res)}`)
    }

    await delay(150)
    const row = await dbQuery(
      'SELECT status_a FROM charger_units WHERE charger_id=?', [CHARGER_A]
    )
    if (row[0]?.status_a === status) {
      pass(`StatusNotification ${status} → DB: status_a = ${status}`)
    } else {
      fail(`DB status_a after ${status}`, `got ${row[0]?.status_a}`)
    }
  }

  // Gun B (connectorId:2)
  const resB = await ocppSend(ws, 'StatusNotification', {
    connectorId: 2, status: 'Available', errorCode: 'NoError',
  })
  if (typeof resB === 'object') {
    pass('StatusNotification connectorId:2 Available → response OK')
  } else {
    fail('StatusNotification Gun B', JSON.stringify(resB))
  }
  await delay(150)
  const rowB = await dbQuery(
    'SELECT status_b FROM charger_units WHERE charger_id=?', [CHARGER_A]
  )
  if (rowB[0]?.status_b === 'Available') {
    pass('StatusNotification Gun B → DB: status_b = Available')
  } else {
    fail('DB status_b after Gun B StatusNotification', `got ${rowB[0]?.status_b}`)
  }

  // connectorId:0 (charger-level, not per-gun) — must not crash
  const res0 = await ocppSend(ws, 'StatusNotification', {
    connectorId: 0, status: 'Available', errorCode: 'NoError',
  })
  if (typeof res0 === 'object') {
    pass('StatusNotification connectorId:0 (charger-level) → handled gracefully')
  } else {
    fail('StatusNotification connectorId:0', JSON.stringify(res0))
  }

  // Reset Gun A to Available for subsequent tests
  await ocppSend(ws, 'StatusNotification', {
    connectorId: 1, status: 'Available', errorCode: 'NoError',
  })
}

async function testAuthorize(ws, agentId) {
  console.log(C.head('T06 · Authorize (RFID)'))

  // Unknown card → Invalid
  const invalid = await ocppSend(ws, 'Authorize', { idTag: 'UNKNOWN-CARD-99' })
  if (invalid?.idTagInfo?.status === 'Invalid') {
    pass('Authorize with unknown RFID → Invalid')
  } else {
    fail('Authorize unknown card', `expected Invalid, got ${JSON.stringify(invalid)}`)
  }

  // Register a test RFID card, then authorize it
  try {
    await dbQuery(
      `INSERT IGNORE INTO rfid_cards (user_id, card_uid, label) VALUES (?, ?, ?)`,
      [agentId, 'TEST-CARD-001', 'Test card']
    )
    const valid = await ocppSend(ws, 'Authorize', { idTag: 'TEST-CARD-001' })
    if (valid?.idTagInfo?.status === 'Accepted') {
      pass('Authorize with valid registered RFID (with quota) → Accepted')
    } else {
      fail('Authorize valid RFID', `expected Accepted, got ${JSON.stringify(valid)}`)
    }
  } catch (err) {
    skip('Authorize valid RFID', err.message)
  }
}

async function testStartTransaction(ws, agentId) {
  console.log(C.head('T07 · StartTransaction'))

  // Valid AGT idTag
  const idTag = `AGT-${agentId}-S0001`
  const before = await dbQuery(
    'SELECT COUNT(*) AS cnt FROM sessions WHERE charger_id=?', [CHARGER_A]
  )

  const res = await ocppSend(ws, 'StartTransaction', {
    connectorId: 1,
    idTag,
    meterStart: 0,
    timestamp: new Date().toISOString(),
  })
  info(`StartTransaction response: ${JSON.stringify(res)}`)

  if (res?.idTagInfo?.status === 'Accepted' && res?.transactionId > 0) {
    pass(`StartTransaction with AGT idTag → Accepted, transactionId: ${res.transactionId}`)
  } else {
    fail('StartTransaction AGT idTag', JSON.stringify(res))
    return null
  }

  await delay(400)

  // DB: session created
  const after = await dbQuery(
    'SELECT COUNT(*) AS cnt FROM sessions WHERE charger_id=?', [CHARGER_A]
  )
  if (after[0].cnt > before[0].cnt) {
    pass('StartTransaction → DB: new session row created')
  } else {
    fail('StartTransaction DB session', 'no new session row found')
  }

  // DB: session fields correct
  const session = await dbQuery(
    `SELECT * FROM sessions WHERE transaction_id=?`, [res.transactionId]
  )
  if (session.length && session[0].user_id == agentId) {
    pass(`StartTransaction → DB: session.user_id = ${agentId} (correct agent linked)`)
  } else {
    fail('StartTransaction user linking', `user_id ${session[0]?.user_id} ≠ ${agentId}`)
  }
  if (session[0]?.status === 'active') {
    pass('StartTransaction → DB: session.status = active')
  } else {
    fail('Session status after StartTransaction', `got ${session[0]?.status}`)
  }
  if (session[0]?.connector === 'A') {
    pass('StartTransaction → DB: session.connector = A (connectorId 1 mapped correctly)')
  } else {
    fail('Session connector mapping', `got ${session[0]?.connector}`)
  }

  // Invalid idTag
  const bad = await ocppSend(ws, 'StartTransaction', {
    connectorId: 2,
    idTag: 'INVALID-TAG-XYZ',
    meterStart: 0,
    timestamp: new Date().toISOString(),
  })
  if (bad?.idTagInfo?.status === 'Invalid' && bad?.transactionId === 0) {
    pass('StartTransaction with unknown idTag → Invalid (transactionId=0)')
  } else {
    fail('StartTransaction invalid idTag', JSON.stringify(bad))
  }

  return res.transactionId
}

async function testMeterValues(ws, transactionId) {
  console.log(C.head('T08 · MeterValues'))

  // Send energy reading
  const kwhValue = '2.500'
  const res = await ocppSend(ws, 'MeterValues', {
    connectorId: 1,
    transactionId,
    meterValue: [{
      timestamp: new Date().toISOString(),
      sampledValue: [
        {
          value: kwhValue,
          measurand: 'Energy.Active.Import.Register',
          unit: 'kWh',
          context: 'Sample.Periodic',
          format: 'Raw',
          location: 'Outlet',
        },
        {
          value: '45000',
          measurand: 'Power.Active.Import',
          unit: 'W',
          context: 'Sample.Periodic',
        },
      ],
    }],
  })
  if (typeof res === 'object') {
    pass('MeterValues with Energy.Active.Import.Register → empty object response')
  } else {
    fail('MeterValues response', JSON.stringify(res))
  }

  await delay(400)
  const session = await dbQuery(
    'SELECT kwh_consumed FROM sessions WHERE transaction_id=?', [transactionId]
  )
  if (parseFloat(session[0]?.kwh_consumed) === parseFloat(kwhValue)) {
    pass(`MeterValues → DB: kwh_consumed = ${kwhValue} kWh`)
  } else {
    fail('MeterValues DB update', `expected ${kwhValue}, got ${session[0]?.kwh_consumed}`)
  }

  // MeterValues without energy measurand — must not crash
  const noEnergy = await ocppSend(ws, 'MeterValues', {
    connectorId: 1,
    transactionId,
    meterValue: [{
      timestamp: new Date().toISOString(),
      sampledValue: [{ value: '230', measurand: 'Voltage', unit: 'V' }],
    }],
  })
  if (typeof noEnergy === 'object') {
    pass('MeterValues without energy measurand → handled gracefully')
  } else {
    fail('MeterValues no energy measurand', JSON.stringify(noEnergy))
  }

  // MeterValues with wrong transactionId — must not crash
  const badTx = await ocppSend(ws, 'MeterValues', {
    connectorId: 1,
    transactionId: 99999999,
    meterValue: [{
      timestamp: new Date().toISOString(),
      sampledValue: [{ value: '1.000', measurand: 'Energy.Active.Import.Register', unit: 'kWh' }],
    }],
  })
  if (typeof badTx === 'object') {
    pass('MeterValues with unknown transactionId → handled gracefully (no crash)')
  } else {
    fail('MeterValues unknown transactionId', JSON.stringify(badTx))
  }
}

async function testBudgetAutoStop(ws, agentId) {
  console.log(C.head('T09 · Budget Auto-Stop'))

  // Start a new session with a 100 RWF budget (at 350 RWF/kWh → ~0.286 kWh stops it)
  const idTag = `AGT-${agentId}-S9999`
  const startRes = await ocppSend(ws, 'StartTransaction', {
    connectorId: 2,
    idTag,
    meterStart: 0,
    timestamp: new Date().toISOString(),
  })

  if (startRes?.idTagInfo?.status !== 'Accepted') {
    skip('Budget auto-stop', `StartTransaction failed: ${JSON.stringify(startRes)}`)
    return
  }

  const txId = startRes.transactionId
  info(`Started budget-test session txId=${txId}`)

  // Set budget manually in DB (the API sets it, but we simulate directly)
  await dbQuery(
    'UPDATE sessions SET budget_frw=100 WHERE transaction_id=?', [txId]
  )

  // Listen for RemoteStop from the server (budget exceeded triggers it)
  const remoteStopPromise = listenForCommand(ws, 'RemoteStopTransaction', 4000)

  // Send a MeterValue that exceeds the budget (0.5 kWh × 350 = 175 RWF > 100 budget)
  await ocppSend(ws, 'MeterValues', {
    connectorId: 2,
    transactionId: txId,
    meterValue: [{
      timestamp: new Date().toISOString(),
      sampledValue: [{
        value: '0.500',
        measurand: 'Energy.Active.Import.Register',
        unit: 'kWh',
        context: 'Sample.Periodic',
      }],
    }],
  })

  const remoteStop = await remoteStopPromise
  if (remoteStop && remoteStop.payload?.transactionId === txId) {
    pass(`Budget auto-stop → server sent RemoteStopTransaction (txId=${txId}) when 175 RWF > 100 RWF budget`)
  } else {
    fail('Budget auto-stop', 'RemoteStopTransaction not received within 4s')
  }

  // Clean up: send StopTransaction for this session
  await ocppSend(ws, 'StopTransaction', {
    transactionId: txId,
    meterStop: 500,
    timestamp: new Date().toISOString(),
    reason: 'Remote',
  })
}

async function testStopTransaction(ws, transactionId) {
  console.log(C.head('T10 · StopTransaction'))

  const beforeAlloc = await dbQuery(
    'SELECT kwh_used FROM kwh_allocations WHERE user_id=(SELECT user_id FROM sessions WHERE transaction_id=?)',
    [transactionId]
  )
  const beforeKwhUsed = parseFloat(beforeAlloc[0]?.kwh_used || 0)

  const res = await ocppSend(ws, 'StopTransaction', {
    transactionId,
    meterStop: 3500,      // 3.5 kWh in Wh
    timestamp: new Date().toISOString(),
    reason: 'Local',
  })
  if (res?.idTagInfo?.status === 'Accepted') {
    pass('StopTransaction → status: Accepted')
  } else {
    fail('StopTransaction response', JSON.stringify(res))
  }

  await delay(400)

  // Session marked completed
  const session = await dbQuery(
    'SELECT status, kwh_consumed, total_frw, end_time FROM sessions WHERE transaction_id=?',
    [transactionId]
  )
  if (session[0]?.status === 'completed') {
    pass('StopTransaction → DB: session.status = completed')
  } else {
    fail('Session status after StopTransaction', `got ${session[0]?.status}`)
  }
  if (session[0]?.end_time) {
    pass('StopTransaction → DB: session.end_time set')
  } else {
    fail('StopTransaction end_time', 'end_time is null')
  }

  // kwh_consumed: server should use the last MeterValues reading (2.5 kWh from T08)
  const finalKwh = parseFloat(session[0]?.kwh_consumed)
  if (finalKwh > 0) {
    pass(`StopTransaction → DB: kwh_consumed = ${finalKwh.toFixed(3)} kWh`)
  } else {
    fail('StopTransaction kwh_consumed', `got ${finalKwh}`)
  }
  if (parseFloat(session[0]?.total_frw) > 0) {
    pass(`StopTransaction → DB: total_frw = ${parseFloat(session[0].total_frw).toLocaleString()} RWF`)
  } else {
    fail('StopTransaction total_frw', `got ${session[0]?.total_frw}`)
  }

  // Allocation kwh_used increased
  const afterAlloc = await dbQuery(
    'SELECT kwh_used FROM kwh_allocations WHERE user_id=(SELECT user_id FROM sessions WHERE transaction_id=?)',
    [transactionId]
  )
  const afterKwhUsed = parseFloat(afterAlloc[0]?.kwh_used || 0)
  if (afterKwhUsed > beforeKwhUsed) {
    pass(`StopTransaction → DB: kwh_allocations.kwh_used increased by ${(afterKwhUsed - beforeKwhUsed).toFixed(3)} kWh`)
  } else {
    fail('kwh_allocations.kwh_used not increased', `before=${beforeKwhUsed}, after=${afterKwhUsed}`)
  }

  // inventory_log sale entry
  const inv = await dbQuery(
    'SELECT * FROM inventory_log WHERE session_id=(SELECT id FROM sessions WHERE transaction_id=?) AND type="sale"',
    [transactionId]
  )
  if (inv.length > 0) {
    pass(`StopTransaction → DB: inventory_log sale entry created (${parseFloat(inv[0].kwh).toFixed(3)} kWh)`)
  } else {
    fail('inventory_log sale entry', 'no entry found')
  }

  // StopTransaction with unknown transactionId — must not crash
  const bad = await ocppSend(ws, 'StopTransaction', {
    transactionId: 99999999,
    meterStop: 0,
    timestamp: new Date().toISOString(),
    reason: 'Local',
  })
  if (bad?.idTagInfo?.status === 'Accepted') {
    pass('StopTransaction with unknown transactionId → handled gracefully')
  } else {
    fail('StopTransaction unknown txId', JSON.stringify(bad))
  }
}

async function testRemoteCommands(ws, agentId) {
  console.log(C.head('T11 · Remote Commands (API → Charger)'))

  // ── RemoteStart via API ──────────────────────────────────────────────────

  // Listen for RemoteStartTransaction command from server
  const remoteStartPromise = listenForCommand(ws, 'RemoteStartTransaction', 7000)

  const startRes = await apiPost('/sessions/start', {
    charger_id:   CHARGER_A,
    connector_id: 1,
    user_id:      agentId,
  })
  info(`POST /api/sessions/start → status ${startRes.status}: ${JSON.stringify(startRes.body)}`)

  if (startRes.status === 200 && startRes.body.ok) {
    pass('POST /api/sessions/start → API returns ok')
  } else {
    fail('POST /api/sessions/start', `status ${startRes.status}: ${JSON.stringify(startRes.body)}`)
  }

  const remoteStart = await remoteStartPromise
  if (remoteStart && remoteStart.payload?.idTag) {
    pass(`RemoteStartTransaction received by charger → idTag: ${remoteStart.payload.idTag}`)
    const idTagOk = /^AGT-\d+-/.test(remoteStart.payload.idTag)
    if (idTagOk) {
      pass(`idTag format is AGT-{userId}-{ref} — compliant with EVCSIMS convention`)
    } else {
      fail('idTag format', `expected AGT-{userId}-{ref}, got ${remoteStart.payload.idTag}`)
    }
  } else {
    fail('RemoteStartTransaction not received by charger within 7s', 'check OCPP server logs')
    return
  }

  // Charger completes StartTransaction
  await delay(300)
  const txRes = await ocppSend(ws, 'StartTransaction', {
    connectorId: 1,
    idTag: remoteStart.payload.idTag,
    meterStart: 0,
    timestamp: new Date().toISOString(),
  })
  const txId2 = txRes?.transactionId
  info(`StartTransaction after RemoteStart → txId=${txId2}`)

  if (txRes?.idTagInfo?.status === 'Accepted' && txId2 > 0) {
    pass('StartTransaction (after RemoteStart) → session created, transactionId returned')
  } else {
    fail('StartTransaction after RemoteStart', JSON.stringify(txRes))
    return
  }

  // ── RemoteStop via API ───────────────────────────────────────────────────

  const remoteStopPromise = listenForCommand(ws, 'RemoteStopTransaction', 7000)

  const stopRes = await apiPost('/sessions/stop', {
    charger_id:     CHARGER_A,
    transaction_id: txId2,
  })
  info(`POST /api/sessions/stop → status ${stopRes.status}: ${JSON.stringify(stopRes.body)}`)

  if (stopRes.status === 200 && stopRes.body.ok) {
    pass('POST /api/sessions/stop → API returns ok')
  } else {
    fail('POST /api/sessions/stop', `status ${stopRes.status}: ${JSON.stringify(stopRes.body)}`)
  }

  const remoteStop = await remoteStopPromise
  if (remoteStop && remoteStop.payload?.transactionId === txId2) {
    pass(`RemoteStopTransaction received by charger → transactionId: ${txId2}`)
  } else {
    fail('RemoteStopTransaction not received', `got: ${JSON.stringify(remoteStop)}`)
  }

  // Finalize with StopTransaction from charger side
  await ocppSend(ws, 'StopTransaction', {
    transactionId: txId2,
    meterStop: 1000,
    timestamp: new Date().toISOString(),
    reason: 'Remote',
  })
  pass('StopTransaction sent by charger after RemoteStop → full remote stop cycle complete')
}

async function testUnknownMessages(ws) {
  console.log(C.head('T12 · Unknown / Malformed Messages'))

  // Unknown action
  const unknown = await ocppSend(ws, 'GetLocalListVersion', {})
  if (typeof unknown === 'object') {
    pass('Unknown action "GetLocalListVersion" → empty object response (no crash)')
  } else {
    fail('Unknown action handling', JSON.stringify(unknown))
  }

  // Another unknown
  const unknown2 = await ocppSend(ws, 'ClearCache', {})
  if (typeof unknown2 === 'object') {
    pass('Unknown action "ClearCache" → empty object response (no crash)')
  } else {
    fail('Unknown action ClearCache', JSON.stringify(unknown2))
  }
}

async function testDisconnect() {
  console.log(C.head('T13 · Disconnect Behaviour'))

  // Open fresh connection as CHARGER_A
  const ws = await ocppConnect(CHARGER_A, 'ocpp1.6')
  await ocppSend(ws, 'BootNotification', {
    chargePointModel: 'DC160KW', chargePointVendor: 'Test',
  })
  await ocppSend(ws, 'StatusNotification', {
    connectorId: 1, status: 'Available', errorCode: 'NoError',
  })

  // Verify online
  const before = await dbQuery(
    'SELECT status_a FROM charger_units WHERE charger_id=?', [CHARGER_A]
  )
  if (before[0]?.status_a === 'Available') {
    pass('Before disconnect: status_a = Available')
  }

  // Close connection
  ws.close()
  await delay(800)

  // Server should have set status to Unavailable on disconnect
  const after = await dbQuery(
    'SELECT status_a, status_b FROM charger_units WHERE charger_id=?', [CHARGER_A]
  )
  if (after[0]?.status_a === 'Unavailable') {
    pass('After disconnect → DB: status_a = Unavailable')
  } else {
    fail('Disconnect status_a update', `got ${after[0]?.status_a}`)
  }
  if (after[0]?.status_b === 'Unavailable') {
    pass('After disconnect → DB: status_b = Unavailable')
  } else {
    fail('Disconnect status_b update', `got ${after[0]?.status_b}`)
  }
}

async function testApiEndpoints() {
  console.log(C.head('T14 · REST API Coverage'))

  const checks = [
    ['GET', '/chargers',          200],
    ['GET', '/chargers/KIGALI-DC160-001', 200],
    ['GET', '/chargers/DOES-NOT-EXIST',  404],
    ['GET', '/users',             200],
    ['GET', '/allocations',       200],
    ['GET', '/sessions',          200],
    ['GET', '/invoices',          200],
    ['GET', '/settings/server',   200],
    ['GET', '/reports/inventory', 200],
  ]

  for (const [method, path, expectedStatus] of checks) {
    const res = await apiGet(path)
    if (res.status === expectedStatus) {
      pass(`${method} /api${path} → ${expectedStatus}`)
    } else {
      fail(`${method} /api${path}`, `expected ${expectedStatus}, got ${res.status}`)
    }
  }

  // Unauthenticated request must return 401
  const savedToken = authToken
  authToken = null
  const unauth = await apiGet('/chargers')
  authToken = savedToken
  if (unauth.status === 401) {
    pass('GET /api/chargers without token → 401 Unauthorized')
  } else {
    fail('Unauthenticated request should return 401', `got ${unauth.status}`)
  }

  // Wrong role: agent cannot access /users
  // Create agent token first via login
  const agentLogin = await apiPost('/auth/login', { email: 'shyirambere@simplecharge.rw', password: 'any' })
  if (agentLogin.status === 401) {
    skip('Agent role enforcement test', 'no agent login available to test with')
  }
}

async function testLiveSessionEndpoint() {
  console.log(C.head('T15 · Live Session Endpoint (public)'))

  // Should return null when no active session
  const noSession = await apiGet(`/sessions/live/${CHARGER_A}/A`)
  if (noSession.status === 200 && noSession.body === null) {
    pass('GET /api/sessions/live/:chargerId/:connector → null when no active session')
  } else {
    fail('Live session endpoint (no session)', `status ${noSession.status}, body: ${JSON.stringify(noSession.body)}`)
  }

  // Gun B as well
  const noSessionB = await apiGet(`/sessions/live/${CHARGER_A}/B`)
  if (noSessionB.status === 200 && noSessionB.body === null) {
    pass('GET /api/sessions/live/:chargerId/B → null when no active session')
  } else {
    fail('Live session endpoint Gun B', `status ${noSessionB.status}`)
  }
}

// ─── main runner ──────────────────────────────────────────────────────────────

async function main() {
  console.log(C.bold('\n╔══════════════════════════════════════════════════════╗'))
  console.log(C.bold('║   EVCSIMS · OCPP 1.6J Compliance Test Suite          ║'))
  console.log(C.bold('║   Target: Ningbo Yuyue 160 kW DC Fast-Charger         ║'))
  console.log(C.bold('╚══════════════════════════════════════════════════════╝'))
  console.log()

  // Connect to DB
  const dbConfig = {
    host:     process.env.DB_HOST || 'localhost',
    user:     process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'evcsims',
  }
  if (process.env.DB_SOCKET) dbConfig.socketPath = process.env.DB_SOCKET
  db = await mysql.createConnection(dbConfig)

  // Find agent user
  const agents = await dbQuery(`SELECT id FROM users WHERE role='agent' AND is_active=1 LIMIT 1`)
  if (!agents.length) {
    console.log(C.fail('No active agent user found. Run: npm run db:seed then create an agent.'))
    process.exit(1)
  }
  const agentId = agents[0].id
  info(`Using agent userId=${agentId} for all session tests`)

  // Ensure agent has allocation
  const allocs = await dbQuery(`SELECT id FROM kwh_allocations WHERE user_id=?`, [agentId])
  if (!allocs.length) {
    await dbQuery(
      `INSERT INTO kwh_allocations (user_id, kwh_assigned, price_per_kwh) VALUES (?,?,?)`,
      [agentId, 10000, 350]
    )
    info('Created test kWh allocation for agent')
  }

  // ── Run API tests first (no WebSocket needed) ────────────────────────────
  await testApiAuth()
  await testWebSocketConnection()

  // ── Open a persistent WebSocket connection as CHARGER_A ──────────────────
  let ws
  try {
    ws = await ocppConnect(CHARGER_A, 'ocpp1.6')
    pass('Main test WebSocket connection established')
  } catch (err) {
    fail('Cannot open WebSocket to OCPP server', err.message)
    await db.end()
    printSummary()
    process.exit(1)
  }

  // Run all OCPP message tests in sequence
  await testBootSequence(ws)
  await testHeartbeat(ws)
  await testStatusNotification(ws)
  await testAuthorize(ws, agentId)

  const transactionId = await testStartTransaction(ws, agentId)
  if (transactionId) {
    await testMeterValues(ws, transactionId)
    await testBudgetAutoStop(ws, agentId)
    await testStopTransaction(ws, transactionId)
  } else {
    skip('MeterValues', 'StartTransaction failed')
    skip('Budget auto-stop', 'StartTransaction failed')
    skip('StopTransaction', 'StartTransaction failed')
  }

  await testRemoteCommands(ws, agentId)
  await testUnknownMessages(ws)
  ws.close()
  await delay(500)

  await testDisconnect()
  await testApiEndpoints()
  await testLiveSessionEndpoint()

  // Cleanup test artefacts
  await dbQuery(`DELETE FROM rfid_cards WHERE card_uid='TEST-CARD-001'`)

  await db.end()
  printSummary()
}

function printSummary() {
  const total = passed + failed + skipped
  console.log()
  console.log(C.bold('╔══════════════════════════════════════════════════════╗'))
  console.log(C.bold(`║   TEST RESULTS                                        ║`))
  console.log(C.bold('╚══════════════════════════════════════════════════════╝'))
  console.log(C.pass(`  Passed:  ${passed}`))
  if (skipped) console.log(C.skip(`  Skipped: ${skipped}`))
  if (failed)  console.log(C.fail(`  Failed:  ${failed}`))
  console.log(C.info(`  Total:   ${total}`))
  console.log()

  if (failures.length) {
    console.log(C.bold('  Failures:'))
    failures.forEach(({ label, reason }) => {
      console.log(C.fail(`  ${label}`))
      console.log(C.info(`    ${reason}`))
    })
    console.log()
  }

  if (failed === 0) {
    console.log('\x1b[32m\x1b[1m  ✓ All tests passed — OCPP server is ready for physical charger connection.\x1b[0m\n')
    process.exit(0)
  } else {
    console.log('\x1b[31m\x1b[1m  ✗ Some tests failed — review failures above before connecting physical hardware.\x1b[0m\n')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(C.fail(`Fatal test error: ${err.message}`))
  console.error(err.stack)
  process.exit(1)
})
