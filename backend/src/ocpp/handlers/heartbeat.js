const db = require('../../db/pool')

module.exports = async function heartbeat(chargerId, respond) {
  await db.query(
    `UPDATE charger_units SET last_seen=NOW() WHERE charger_id=?`,
    [chargerId],
  )
  respond({ currentTime: new Date().toISOString() })
}
