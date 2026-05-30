const db = require('../../db/pool')
const { emit } = require('../events')

module.exports = async function stopTransaction(chargerId, payload, respond) {
  const kwh = payload.meterStop ? payload.meterStop / 1000 : 0

  const [rows] = await db.query(
    `SELECT s.*, a.price_per_kwh, u.name AS operator_name
     FROM sessions s
     JOIN kwh_allocations a ON a.user_id = s.user_id
     JOIN users u ON u.id = s.user_id
     WHERE s.transaction_id=? AND s.status='active'`,
    [payload.transactionId],
  )
  if (!rows.length) {
    respond({ idTagInfo: { status: 'Accepted' } })
    return
  }

  const session = rows[0]
  const finalKwh = session.kwh_consumed > 0 ? parseFloat(session.kwh_consumed) : kwh
  const totalFrw = finalKwh * parseFloat(session.price_per_kwh)

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
  emit('StopTransaction', {
    chargerId,
    sessionId: session.id,
    transactionId: payload.transactionId,
    connector: session.connector,
    kwh: finalKwh,
    totalFrw,
    pricePerKwh: session.price_per_kwh,
    reason: payload.reason,
    operatorName: session.operator_name,
    summary: `Session #${session.id} completed — ${finalKwh.toFixed(3)} kWh — ${Math.round(totalFrw).toLocaleString()} RWF — ${session.operator_name}`,
  })
}
