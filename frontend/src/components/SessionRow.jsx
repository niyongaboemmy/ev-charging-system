export default function SessionRow({ session, onPrintInvoice }) {
  const statusColor = {
    active: '#f59e0b',
    completed: '#22c55e',
    pending: '#38bdf8',
    faulted: '#ef4444',
  }

  return (
    <tr style={{ borderBottom: '1px solid #1e293b' }}>
      <td style={td}>{session.id}</td>
      <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{session.charger_id}</td>
      <td style={td}>{session.connector}</td>
      <td style={td}>{session.operator_name}</td>
      <td style={td}>{session.start_time ? new Date(session.start_time).toLocaleString('en-RW') : '—'}</td>
      <td style={td}>{session.end_time ? new Date(session.end_time).toLocaleString('en-RW') : '—'}</td>
      <td style={{ ...td, fontFamily: 'monospace' }}>{parseFloat(session.kwh_consumed || 0).toFixed(3)}</td>
      <td style={{ ...td, fontFamily: 'monospace' }}>{parseFloat(session.total_frw || 0).toLocaleString()}</td>
      <td style={td}>
        <span style={{
          background: statusColor[session.status] + '22',
          color: statusColor[session.status],
          padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
        }}>
          {session.status}
        </span>
      </td>
      <td style={td}>
        {session.status === 'completed' && (
          <button
            onClick={() => onPrintInvoice(session)}
            style={{
              background: 'none', border: '1px solid #334155', color: '#94a3b8',
              borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
            }}
          >
            Invoice
          </button>
        )}
      </td>
    </tr>
  )
}

const td = {
  padding: '10px 12px', fontSize: 12, color: '#94a3b8', verticalAlign: 'middle',
}
