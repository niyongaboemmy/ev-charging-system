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
  const frwSoFar = kwh * parseFloat(session.price_per_kwh)
  await db.query(`UPDATE sessions SET kwh_consumed=? WHERE id=?`, [kwh, session.id])

  if (session.budget_frw && frwSoFar >= parseFloat(session.budget_frw)) {
    try {
      await remoteStop(chargerId, payload.transactionId)
    } catch (_) {}
  }
  respond({})
}
