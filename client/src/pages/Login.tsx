import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const navigate = useNavigate();
  const { login, register, isLoading } = useAuthStore();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState(localStorage.getItem('vibelink_saved_username') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!username.trim()) { setError('请输入用户名'); return; }
    if (!password || password.length < 6) { setError('密码至少6个字符'); return; }

    try {
      if (mode === 'register') {
        if (password !== confirmPassword) { setError('两次密码不一致'); return; }
        await register({ username: username.trim(), password });
      } else {
        await login({ username: username.trim(), password, rememberMe });
      }
      navigate('/chat', { replace: true });
    } catch (err: any) { setError(err.message); }
  };

  return (
    <div className="page-center">
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg, #5B9BD5, #4A8AC4)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" /></svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>VibeLink</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>更自由的跨设备文件传输</p>
        </div>

        <div className="card">
          <div className="tabs">
            <button className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError(''); }}>登录</button>
            <button className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setError(''); }}>注册</button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="input-group"><label>用户名</label><input type="text" placeholder={mode === 'register' ? '设置用户名' : '输入用户名'} value={username} onChange={(e) => setUsername(e.target.value)} autoFocus /></div>
            <div className="input-group"><label>密码</label><input type="password" placeholder="至少6个字符" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            {mode === 'register' && (
              <div className="input-group"><label>确认密码</label><input type="password" placeholder="再次输入密码" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
            )}

            {mode === 'login' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />记住密码（30天免登录）
              </label>
            )}

            {mode === 'register' && (
              <div style={{ background: '#FFF8E1', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#8D6E00', lineHeight: 1.6 }}>
                ⚠️ 用户名和密码是唯一凭证，遗失无法找回
              </div>
            )}

            {error && <div style={{ background: '#FFF0F0', color: 'var(--danger)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 14, marginBottom: 16 }}>{error}</div>}
            <button type="submit" className="btn btn-primary btn-block" disabled={isLoading}>{isLoading ? '处理中...' : mode === 'login' ? '登录' : '注册'}</button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-secondary)' }}>
            {mode === 'login' ? (
              <>还没有账号？<button onClick={() => { setMode('register'); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>立即注册</button></>
            ) : (
              <>已有账号？<button onClick={() => { setMode('login'); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>去登录</button></>
            )}
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { icon: '🔓', text: '独立账号，随时可用' },
            { icon: '🚀', text: '不限大小，跨网即传' },
            { icon: '📱', text: '全平台，不挑系统' },
            { icon: '🔐', text: '端到端加密，隐私安全' },
            { icon: '🖼️', text: '图片原画质，不压缩' },
            { icon: '🌐', text: '纯网页，无需安装' },
          ].map((item) => (
            <span key={item.icon} style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 12 }}>{item.icon}</span>
              {item.text}
            </span>
          ))}
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
          🔒 所有内容端到端加密，服务器无法查看你的数据
        </p>
      </div>
    </div>
  );
}
