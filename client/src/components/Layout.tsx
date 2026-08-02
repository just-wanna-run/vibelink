import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface Props {
  children: React.ReactNode;
}

const navItems = [
  {
    to: '/chat',
    label: '传输',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    to: '/history',
    label: '记录',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: '设置',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
  },
];

export default function Layout({ children }: Props) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const TopNav = () => (
    <div style={{
      display: 'flex',
      background: 'var(--white)',
      borderBottom: '1px solid var(--border)',
    }}>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => isActive ? 'active' : ''}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            padding: '10px 0',
            fontSize: 14,
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            borderBottom: '2px solid transparent',
            transition: 'color 0.15s, border-color 0.15s',
          }}
        >
          {({ isActive }) => (
            <>
              <span style={{ width: 18, height: 18, color: isActive ? 'var(--primary)' : 'var(--text-secondary)' }}>
                {item.icon}
              </span>
              <span style={{
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
              }}>
                {item.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top header bar */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'var(--white)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--primary)' }}>VibeLink</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email || user?.phone || ''}
          </span>
          <button
            onClick={handleLogout}
            style={{
              padding: '5px 12px', fontSize: 12, borderRadius: 4,
              border: '1px solid var(--border)', background: 'var(--white)',
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            退出
          </button>
        </div>
      </header>

      {/* Top tab nav (mobile) */}
      <div className="mobile-only" style={{ flexShrink: 0 }}>
        <TopNav />
      </div>

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Desktop sidebar */}
        <aside className="sidebar desktop-only">
          <div className="sidebar-logo">VibeLink</div>
          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
