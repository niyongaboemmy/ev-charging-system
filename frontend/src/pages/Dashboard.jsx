import { useState, useEffect, useCallback } from 'react'
import ChargerCard from '../components/ChargerCard'
import SetupGuide from '../components/SetupGuide'
import client from '../api/client'

export default function Dashboard() {
  const [chargers, setChargers] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total_sessions: 0, active: 0, total_kwh: 0, total_frw: 0 })

  const loadChargers = useCallback(async () => {
    const { data } = await client.get('/chargers')
    setChargers(data)
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      await loadChargers()
      const { data: u } = await client.get('/users')
      setUsers(u)
      try {
        const now = new Date()
        const { data: r } = await client.get(
          `/reports/monthly?year=${now.getFullYear()}&month=${now.getMonth() + 1}`,
        )
        setStats({
          total_sessions: r.summary.session_count,
          active: 0,
          total_kwh: parseFloat(r.summary.total_kwh || 0).toFixed(2),
          total_frw: parseFloat(r.summary.total_frw || 0).toLocaleString(),
        })
      } catch (_) {}
      setLoading(false)
    }
    init()
    const id = setInterval(loadChargers, 15000)
    return () => clearInterval(id)
  }, [loadChargers])

  if (loading) {
    return <div style={{ color: '#64748b', marginTop: 40, textAlign: 'center' }}>Loading…</div>
  }

  return (
    <div>
      <h1 style={{ color: '#e2e8f0', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        Live Dashboard
      </h1>
      <p style={{ color: '#475569', fontSize: 13, marginBottom: 20 }}>
        Real-time charger status · auto-refreshes every 15s
      </p>

      {/* Setup guide — shown until all steps complete (then shows ops tips, then dismissible) */}
      <SetupGuide />

      {/* Summary metrics */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Sessions This Month', value: stats.total_sessions, unit: '' },
          { label: 'Total Energy Sold', value: stats.total_kwh, unit: ' kWh' },
          { label: 'Total Revenue', value: stats.total_frw, unit: ' RWF' },
          { label: 'Online Chargers', value: `${chargers.filter(c => c.connected).length} / ${chargers.length}`, unit: '' },
        ].map((m) => (
          <div key={m.label} style={{
            flex: 1, background: '#111827', border: '1px solid #1e293b',
            borderRadius: 10, padding: '16px 20px',
          }}>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
              {m.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', color: '#38bdf8' }}>
              {m.value}{m.unit}
            </div>
          </div>
        ))}
      </div>

      {/* Charger cards */}
      <div style={{ display: 'flex', gap: 20 }}>
        {chargers.length === 0 && (
          <div style={{ color: '#475569', fontSize: 14 }}>No chargers found in database.</div>
        )}
        {chargers.map((c) => (
          <ChargerCard
            key={c.charger_id}
            charger={c}
            users={users}
            onRefresh={loadChargers}
          />
        ))}
      </div>
    </div>
  )
}
