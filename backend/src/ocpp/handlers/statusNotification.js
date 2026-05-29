const db = require('../../db/pool')

module.exports = async function statusNotification(chargerId, payload, respond) {
  if (payload.connectorId === 0) {
    respond({})
    return
  }
  const col = payload.connectorId === 1 ? 'status_a' : 'status_b'
  await db.query(`UPDATE charger_units SET ${col}=? WHERE charger_id=?`, [
    payload.status,
    chargerId,
  ])
  respond({})
}
