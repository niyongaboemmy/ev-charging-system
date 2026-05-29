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
