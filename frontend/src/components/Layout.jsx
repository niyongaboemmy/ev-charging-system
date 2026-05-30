import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/operators', label: 'Operators', roles: ['admin'] },
  { to: '/allocations', label: 'Allocations', roles: ['admin'] },
  { to: '/monitor', label: 'Monitor', roles: ['admin', 'accountant'] },
  { to: '/reports', label: 'Reports', roles: ['admin', 'accountant'] },
  { to: '/settings', label: 'Settings', roles: ['admin'] },
  { to: '/simulator', label: 'Simulator', roles: ['admin'], divider: true },
  { to: '/help', label: 'Help' },
]

const s = {
  shell: { display: 'flex', height: '100vh', overflow: 'hidden', background: '#0f1623' },
  sidebar: {
    width: 220, flexShrink: 0, background: '#111827', display: 'flex', flexDirection: 'column',
    borderRight: '1px solid #1e293b', padding: '24px 0',
    height: '100vh', overflowY: 'auto',
  },
  logo: {
    padding: '0 20px 24px', borderBottom: '1px solid #1e293b',
    fontSize: 15, fontWeight: 700, letterSpacing: 1, color: '#38bdf8',
    textTransform: 'uppercase',
  },
  sub: { fontSize: 10, color: '#64748b', fontWeight: 400, letterSpacing: 0 },
  nav: { flex: 1, marginTop: 12 },
  link: {
    display: 'block', padding: '10px 20px', color: '#94a3b8',
    textDecoration: 'none', fontSize: 13, fontWeight: 500,
    borderLeft: '3px solid transparent', transition: 'all .15s',
  },
  activeLink: { color: '#38bdf8', borderLeftColor: '#38bdf8', background: '#1e293b' },
  footer: { padding: '16px 20px', borderTop: '1px solid #1e293b' },
  userInfo: { fontSize: 12, color: '#64748b', marginBottom: 8 },
  logoutBtn: {
    background: 'none', border: '1px solid #334155', borderRadius: 4,
    color: '#94a3b8', padding: '6px 12px', cursor: 'pointer', fontSize: 12,
    width: '100%',
  },
  main: { flex: 1, overflow: 'auto', padding: 28 },
  header: {
    marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #1e293b',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  title: { fontSize: 20, fontWeight: 700, color: '#e2e8f0' },
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const visible = navItems.filter(
    (item) => !item.roles || item.roles.includes(user?.role),
  )

  return (
    <div style={s.shell}>
      <aside style={s.sidebar}>
        <div style={s.logo}>
          EVCSIMS
          <div style={s.sub}>Simple Charge · Kigali</div>
        </div>
        <nav style={s.nav}>
          {visible.map((item) => (
            <span key={item.to}>
              {item.divider && (
                <div style={{ height: 1, background: '#1e293b', margin: '8px 16px' }} />
              )}
              <NavLink
                to={item.to}
                style={({ isActive }) => ({ ...s.link, ...(isActive ? s.activeLink : {}) })}
              >
                {item.label}
              </NavLink>
            </span>
          ))}
        </nav>
        <div style={s.footer}>
          <div style={s.userInfo}>
            {user?.name}<br />
            <span style={{ textTransform: 'capitalize' }}>{user?.role}</span>
          </div>
          <button style={s.logoutBtn} onClick={handleLogout}>Sign Out</button>
        </div>
      </aside>
      <main style={s.main}>
        <Outlet />
      </main>
    </div>
  )
}
