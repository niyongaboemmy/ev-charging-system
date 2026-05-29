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
