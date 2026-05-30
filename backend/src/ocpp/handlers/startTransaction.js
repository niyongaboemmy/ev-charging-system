const db = require('../../db/pool')
const { emit } = require('../events')

module.exports = async function startTransaction(chargerId, payload, respond) {
  let userId = null
  const match = payload.idTag?.match(/^AGT-(\d+)-/)
  if (match) {
    userId = parseInt(match[1])
  } else {
    const [r] = await db.query(
      `SELECT user_id FROM rfid_cards WHERE card_uid=? AND is_active=1`,
      [payload.idTag],
    )
    if (r.length) userId = r[0].user_id
  }

  if (!userId) {
    respond({ transactionId: 0, idTagInfo: { status: 'Invalid' } })
    emit('StartTransaction', { chargerId, idTag: payload.idTag, status: 'Invalid', summary: `StartTransaction rejected — unknown idTag: ${payload.idTag}` })
    return
  }

  const connector = payload.connectorId === 1 ? 'A' : 'B'
  const [alloc] = await db.query(
    `SELECT id, price_per_kwh, (kwh_assigned-kwh_used) AS remaining FROM kwh_allocations WHERE user_id=?`,
    [userId],
  )
  if (!alloc.length || alloc[0].remaining <= 0) {
    respond({ transactionId: 0, idTagInfo: { status: 'Invalid' } })
    emit('StartTransaction', { chargerId, idTag: payload.idTag, status: 'Invalid', summary: `StartTransaction rejected — no quota for user #${userId}` })
    return
  }

  const [result] = await db.query(
    `INSERT INTO sessions (user_id, charger_id, connector, connector_id, id_tag, price_per_kwh, status, start_time)
     VALUES (?,?,?,?,?,?, 'active', NOW())`,
    [userId, chargerId, connector, payload.connectorId, payload.idTag, alloc[0].price_per_kwh],
  )
  const sessionId = result.insertId
  await db.query(`UPDATE sessions SET transaction_id=? WHERE id=?`, [sessionId, sessionId])

  const [userRow] = await db.query(`SELECT name FROM users WHERE id=?`, [userId])
  const operatorName = userRow[0]?.name || `User #${userId}`

  respond({ transactionId: sessionId, idTagInfo: { status: 'Accepted' } })
  emit('StartTransaction', {
    chargerId,
    sessionId,
    transactionId: sessionId,
    connector,
    idTag: payload.idTag,
    userId,
    operatorName,
    pricePerKwh: alloc[0].price_per_kwh,
    status: 'Accepted',
    summary: `Session #${sessionId} started — Gun ${connector} — ${operatorName}`,
  })
}
