import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

export default function Login() {
  const navigate = useNavigate();
  const { login, register, isLoading } = useAuthStore();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [forgotMode, setForgotMode] = useState(false);

  const [username, setUsername] = useState(localStorage.getItem('vibelink_saved_username') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [code, setCode] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [sentCode, setSentCode] = useState('');
  const [emailCountdown, setEmailCountdown] = useState(0);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (countdown > 0 || emailCountdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown((c) => (c <= 1 ? 0 : c - 1));
        setEmailCountdown((c) => (c <= 1 ? 0 : c - 1));
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [countdown, emailCountdown]);

  const resetAll = () => {
    setUsername(localStorage.getItem('vibelink_saved_username') || '');
    setPassword('');
    setConfirmPassword('');
    setRecoveryEmail('');
    setCode('');
    setError('');
    setForgotMode(false);
  };

  // ---- Forgot Password ----
  const handleSendResetCode = async () => {
    if (!username.trim()) { setError('请输入用户名'); return; }
    if (countdown > 0) return;
    setError('');
    try {
      const res = await api.post('/auth/send-reset-code', { username: username.trim() });
      if (res.data && res.data.code) { setSentCode(res.data.code); }
      setCountdown(60);
    } catch (err: any) { setError(err.response?.data?.error || '发送失败'); }
  };

  const handleResetPassword = async () => {
    if (!password || password.length < 6) { setError('新密码至少6个字符'); return; }
    if (password !== confirmPassword) { setError('两次密码不一致'); return; }
    if (!code.trim()) { setError('请输入验证码'); return; }
    setError('');
    try {
      await api.post('/auth/reset-password', { username: username.trim(), code: code.trim(), newPassword: password });
      alert('密码重置成功，请重新登录');
      setForgotMode(false);
      resetAll();
      setMode('login');
    } catch (err: any) { setError(err.response?.data?.error || '重置失败'); }
  };

  // ---- Send email verification code ----
  const handleSendEmailCode = async () => {
    if (!recoveryEmail.trim()) { setError('请先输入邮箱'); return; }
    if (emailCountdown > 0) return;
    setError('');
    try {
      const res = await api.post('/auth/send-register-code', { email: recoveryEmail.trim() });
      const d = res.data;
      if (d && d.code) { setEmailCode(d.code); setSentCode(d.code); }
      setEmailCountdown(60);
    } catch (err: any) { setError('发送失败，请重试'); }
  };

  // ---- Login / Register ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!username.trim()) { setError('请输入用户名'); return; }
    if (!password || password.length < 6) { setError('密码至少6个字符'); return; }

    try {
      if (mode === 'register') {
        if (password !== confirmPassword) { setError('两次密码不一致'); return; }
        await register({ username: username.trim(), password, recoveryEmail: recoveryEmail.trim(), emailCode: emailCode.trim() });
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
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>{forgotMode ? '重置密码' : '更自由的跨设备文件传输'}</p>
        </div>

        <div className="card">
          {!forgotMode && (
            <div className="tabs">
              <button className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); resetAll(); }}>登录</button>
              <button className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); resetAll(); }}>注册</button>
            </div>
          )}

          {forgotMode ? (
            <form onSubmit={(e) => { e.preventDefault(); handleResetPassword(); }}>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                输入用户名获取验证码（需已绑定邮箱）
              </p>
              <div className="input-group"><label>用户名</label><input type="text" placeholder="输入用户名" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus /></div>
              <div className="input-group"><label>验证码</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input type="text" placeholder="验证码" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} style={{ flex: 1 }} />
                  <button type="button" onClick={handleSendResetCode} disabled={countdown > 0} style={{ whiteSpace: 'nowrap', padding: '0 16px', fontSize: 13, borderRadius: 6, border: '1.5px solid var(--primary)', cursor: countdown > 0 ? 'default' : 'pointer', background: countdown > 0 ? 'var(--border)' : 'var(--white)', color: countdown > 0 ? 'var(--text-secondary)' : 'var(--primary)' }}>{countdown > 0 ? `${countdown}s` : '获取验证码'}</button>
                </div>
              </div>
              <div className="input-group"><label>新密码</label><input type="password" placeholder="至少6个字符" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <div className="input-group"><label>确认新密码</label><input type="password" placeholder="再次输入" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
              {error && <div style={{ background: '#FFF0F0', color: 'var(--danger)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 14, marginBottom: 16 }}>{error}</div>}
              <button type="submit" className="btn btn-primary btn-block">重置密码</button>
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <button type="button" onClick={() => { setForgotMode(false); setError(''); setPassword(''); setConfirmPassword(''); setCode(''); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 14 }}>← 返回登录</button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="input-group"><label>用户名</label><input type="text" placeholder={mode === 'register' ? '设置用户名' : '输入用户名'} value={username} onChange={(e) => setUsername(e.target.value)} autoFocus /></div>
              <div className="input-group"><label>密码</label><input type="password" placeholder="至少6个字符" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              {mode === 'register' && (
                <>
                  <div className="input-group"><label>确认密码</label><input type="password" placeholder="再次输入密码" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
                  <div className="input-group"><label>绑定邮箱（用于找回密码）</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input type="email" placeholder="输入邮箱地址" value={recoveryEmail} onChange={(e) => { setRecoveryEmail(e.target.value); setSentCode(''); }} required style={{ flex: 1 }} />
                      <button type="button" onClick={handleSendEmailCode} disabled={emailCountdown > 0}
                        style={{ whiteSpace: 'nowrap', padding: '0 14px', fontSize: 13, borderRadius: 6, border: '1.5px solid var(--primary)', cursor: emailCountdown > 0 ? 'default' : 'pointer', background: emailCountdown > 0 ? 'var(--border)' : 'var(--white)', color: emailCountdown > 0 ? 'var(--text-secondary)' : 'var(--primary)' }}>
                        {emailCountdown > 0 ? `${emailCountdown}s` : '获取验证码'}
                      </button>
                    </div>
                  </div>
                  <div className="input-group"><label>邮箱验证码</label><input type="text" placeholder="输入邮箱验证码" value={emailCode} onChange={(e) => setEmailCode(e.target.value)} maxLength={6} />
                    {sentCode && <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 4, background: 'var(--primary-light)', padding: '6px 10px', borderRadius: 6 }}>验证码：<strong>{sentCode}</strong>（若未收到邮件，请使用此码）</div>}
                  </div>
                </>
              )}

              {mode === 'login' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />记住密码（30天免登录）
                </label>
              )}

              {error && <div style={{ background: '#FFF0F0', color: 'var(--danger)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 14, marginBottom: 16 }}>{error}</div>}
              <button type="submit" className="btn btn-primary btn-block" disabled={isLoading}>{isLoading ? '处理中...' : mode === 'login' ? '登录' : '注册'}</button>
            </form>
          )}

          {!forgotMode && (
            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-secondary)' }}>
              {mode === 'login' ? (
                <>还没有账号？<button onClick={() => { setMode('register'); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>立即注册</button></>
              ) : (
                <>已有账号？<button onClick={() => { setMode('login'); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>去登录</button></>
              )}
              {mode === 'login' && (
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => { setForgotMode(true); setError(''); setPassword(''); setConfirmPassword(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>忘记密码？</button>
                </div>
              )}
            </div>
          )}
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
            <span key={item.icon} style={{
              fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap',
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
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
