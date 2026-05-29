require('dotenv').config()
const WebSocket = require('ws')

const CHARGER_ID = process.env.SIM_CHARGER_ID || 'KIGALI-DC160-001'
const SERVER = `ws://localhost:${process.env.PORT_OCPP || 8887}/ocpp/${CHARGER_ID}`

const ws = new WebSocket(SERVER, ['ocpp1.6'])
let txId = null
let kwhCounter = 0
let meterInterval = null

ws.on('open', () => {
  console.log(`[SIM] Connected to OCPP server as ${CHARGER_ID}`)
  send('BootNotification', {
    chargePointModel: 'DC160KW',
    chargePointVendor: 'NingboYuyue',
    chargePointSerialNumber: '20251218007',
    firmwareVersion: '1.0.0',
  })
  setInterval(() => send('Heartbeat', {}), 30000)

  setTimeout(() => {
    send('StatusNotification', { connectorId: 1, status: 'Available', errorCode: 'NoError' })
    send('StatusNotification', { connectorId: 2, status: 'Available', errorCode: 'NoError' })
    console.log('[SIM] Both guns set to Available')
  }, 2000)
})

ws.on('message', (raw) => {
  const msg = JSON.parse(raw)
  const [type, uid, actionOrBody, payload] = msg

  if (type === 3) {
    // CALLRESULT
    if (actionOrBody?.transactionId) {
      txId = actionOrBody.transactionId
      console.log(`[SIM] Transaction started: txId=${txId}`)
    }
  }

  if (type === 2) {
    const action = actionOrBody
    console.log(`[SIM] Received command: ${action}`)

    if (action === 'RemoteStartTransaction') {
      ws.send(JSON.stringify([3, uid, { status: 'Accepted' }]))
      setTimeout(() => simulateStart(payload.connectorId, payload.idTag), 500)
    }

    if (action === 'RemoteStopTransaction') {
      ws.send(JSON.stringify([3, uid, { status: 'Accepted' }]))
      setTimeout(() => simulateStop(), 500)
    }

    if (action === 'ChangeConfiguration') {
      ws.send(JSON.stringify([3, uid, { status: 'Accepted' }]))
    }
  }
})

function simulateStart(connectorId, idTag) {
  kwhCounter = 0
  console.log(`[SIM] Starting session on connector ${connectorId} with idTag ${idTag}`)

  send('StatusNotification', { connectorId, status: 'Preparing', errorCode: 'NoError' })

  setTimeout(() => {
    send('StatusNotification', { connectorId, status: 'Charging', errorCode: 'NoError' })
    send('StartTransaction', {
      connectorId,
      idTag,
      meterStart: 0,
      timestamp: new Date().toISOString(),
    })

    meterInterval = setInterval(() => {
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
                value: kwhCounter.toFixed(3),
                measurand: 'Energy.Active.Import.Register',
                unit: 'kWh',
                context: 'Sample.Periodic',
                format: 'Raw',
                location: 'Outlet',
              },
              {
                value: String(Math.round(kwhCounter * 1000 / ((kwhCounter / 0.5) * 5) * 3600)),
                measurand: 'Power.Active.Import',
                unit: 'W',
                context: 'Sample.Periodic',
              },
            ],
          },
        ],
      })
      console.log(`[SIM] MeterValue: ${kwhCounter.toFixed(3)} kWh (txId=${txId})`)
    }, 5000)

    // Auto-stop after 60s for demo
    setTimeout(() => {
      clearInterval(meterInterval)
      simulateStop()
    }, 60000)
  }, 1000)
}

function simulateStop() {
  if (!txId) return
  const stopTxId = txId
  txId = null
  clearInterval(meterInterval)

  console.log(`[SIM] Stopping transaction ${stopTxId}, kWh=${kwhCounter.toFixed(3)}`)
  send('StopTransaction', {
    transactionId: stopTxId,
    meterStop: Math.round(kwhCounter * 1000),
    timestamp: new Date().toISOString(),
    reason: 'Remote',
  })

  // Set connector back to Available
  setTimeout(() => {
    send('StatusNotification', { connectorId: 1, status: 'Available', errorCode: 'NoError' })
    send('StatusNotification', { connectorId: 2, status: 'Available', errorCode: 'NoError' })
  }, 1000)
}

ws.on('close', () => console.log('[SIM] Disconnected from OCPP server'))
ws.on('error', (err) => console.error('[SIM] Error:', err.message))

let msgId = 1
function send(action, payload) {
  const uid = String(msgId++)
  ws.send(JSON.stringify([2, uid, action, payload]))
}
