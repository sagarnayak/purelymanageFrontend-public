import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { logout } from '../lib/auth'

const NAV = [
  { label: 'Dashboard', to: '/' },
  { label: 'Users', to: '/users' },
  { label: 'Domains', to: '/domains' },
  { label: 'Routing Rules', to: '/routing' },
  { label: 'Migration', to: '/migration' },
  { label: 'Settings', to: '/settings' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const user = JSON.parse(localStorage.getItem('user') ?? '{}')
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="layout-root">
      {/* Mobile header */}
      <div className="layout-mobile-header">
        <button
          onClick={() => setMenuOpen(o => !o)}
          style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: 4 }}
          aria-label="Toggle menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>PurelyManage</span>
      </div>

      {/* Overlay */}
      <div
        className={`layout-overlay${menuOpen ? ' open' : ''}`}
        onClick={() => setMenuOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`layout-sidebar${menuOpen ? ' open' : ''}`}>
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="#6366f1"/>
            <rect x="8" y="12" width="24" height="16" rx="2" fill="#4f46e5"/>
            <path d="M8 15L20 22L32 15" stroke="#e0e7ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>PurelyManage</span>
        </div>
        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(({ label, to }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMenuOpen(false)}
              style={({ isActive }) => ({
                padding: '9px 12px', borderRadius: 7, textDecoration: 'none', fontSize: 14, fontWeight: 500,
                color: isActive ? 'var(--text)' : 'var(--muted)',
                background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, marginBottom: 2 }}>{user.name}</p>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>{user.email}</p>
          <button onClick={logout} style={{ fontSize: 13, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="layout-main">
        {children}
      </main>
    </div>
  )
}
