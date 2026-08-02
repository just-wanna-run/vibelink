import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { wsClient } from '../services/ws';

interface Props {
  children: React.ReactNode;
}

export default function Layout({ children }: Props) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    wsClient.disconnect();
    await logout();
    navigate('/login', { replace: true });
  };

  const NavItems = () => (
    <>
      <NavLink to="/chat" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        传输
      </NavLink>
      <NavLink to="/history" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        记录
      </NavLink>
      <NavLink to="/settings" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
        设置
      </NavLink>
    </>
  );

  const MobileNavItems = () => (
    <>
      <NavLink to="/chat" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        传输
      </NavLink>
      <NavLink to="/history" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        记录
      </NavLink>
      <NavLink to="/settings" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
        设置
      </NavLink>
    </>
  );

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Desktop Sidebar */}
      <aside className="sidebar desktop-only">
        <div className="sidebar-logo">VibeLink</div>
        <nav className="sidebar-nav">
          <NavItems />
        </nav>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '4px 12px', marginBottom: 4 }}>
            {user?.email || user?.phone || '已登录'}
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)',
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: 'var(--text-secondary)', fontSize: 14, textAlign: 'left',
            }}
          >
            退出登录
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="mobile-nav mobile-only">
        <MobileNavItems />
      </nav>
    </div>
  );
}
