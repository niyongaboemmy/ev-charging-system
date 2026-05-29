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
      try {
        const [type, id, body] = JSON.parse(raw)
        if (type === 3 && id === uid) resolve(body)
        else resolve({})
      } catch {
        resolve({})
      }
    })
    ws.send(JSON.stringify([2, uid, action, payload]))
  })
}

async function remoteStart(chargerId, connectorId, idTag) {
  return sendCommand(chargerId, 'RemoteStartTransaction', { connectorId, idTag })
}

async function remoteStop(chargerId, transactionId) {
  return sendCommand(chargerId, 'RemoteStopTransaction', { transactionId })
}

async function changeConfig(chargerId, key, value) {
  return sendCommand(chargerId, 'ChangeConfiguration', { key, value })
}

module.exports = { connectedChargers, remoteStart, remoteStop, changeConfig }
